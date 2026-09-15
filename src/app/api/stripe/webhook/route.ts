import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import {
  assertLiveWebhookOrDemoAllowed,
  isWebhookDemoMode,
} from "@/lib/env";
import {
  findBusinessByStripeAccount,
  syncConnectAccountFromStripe,
} from "@/lib/stripe-connect";
import {
  applyInstallmentFailure,
  applyInstallmentSuccess,
} from "@/lib/settlement";

/**
 * Stripe webhook — Connect + ACSS Debit.
 * Enable connected-account events for Direct Charges.
 *
 * Hardening: live webhook secret required in production (unless ALLOW_DEMO_MODE);
 * Stripe event.id stored for idempotent retries.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  try {
    assertLiveWebhookOrDemoAllowed();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook misconfigured" },
      { status: 503 },
    );
  }

  if (isWebhookDemoMode()) {
    return NextResponse.json({ received: true, demo: true });
  }

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid signature" },
      { status: 400 },
    );
  }

  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { eventId: event.id },
  });
  if (existing) {
    return NextResponse.json({
      received: true,
      duplicate: true,
      eventId: event.id,
      type: event.type,
    });
  }

  let summary: string | null = null;

  try {
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      const business =
        (await findBusinessByStripeAccount(account.id)) ||
        (account.metadata?.pymtx_business_id
          ? await prisma.business.findUnique({
              where: { id: account.metadata.pymtx_business_id },
            })
          : null);
      if (business) {
        await syncConnectAccountFromStripe(business.id, account);
        summary = `synced business ${business.id}`;
      } else {
        summary = "account.updated unmatched";
      }
    } else if (
      event.type === "payment_intent.succeeded" ||
      event.type === "payment_intent.payment_failed"
    ) {
      const pi = event.data.object as Stripe.PaymentIntent;
      const installmentId = pi.metadata?.pymtx_installment_id;
      if (!installmentId) {
        summary = "payment_intent without pymtx_installment_id";
      } else {
        const attemptId = pi.metadata?.pymtx_attempt_id || null;
        if (event.type === "payment_intent.succeeded") {
          const result = await applyInstallmentSuccess({
            installmentId,
            paymentIntentId: pi.id,
            applicationFeeCents: pi.application_fee_amount || 0,
            attemptId,
          });
          summary = `success ${installmentId} settled=${!result.alreadySettled}`;
        } else {
          const result = await applyInstallmentFailure({
            installmentId,
            paymentIntentId: pi.id,
            attemptId,
            failureCode: pi.last_payment_error?.code || null,
            failureMessage: pi.last_payment_error?.message || null,
          });
          summary = result.ignored
            ? `failure ignored ${installmentId}`
            : `failure ${installmentId} nsf=${result.nsf}`;
        }
      }
    } else {
      summary = "ignored type";
    }

    await prisma.stripeWebhookEvent.create({
      data: { eventId: event.id, type: event.type, summary },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Webhook handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    received: true,
    type: event.type,
    eventId: event.id,
    summary,
  });
}
