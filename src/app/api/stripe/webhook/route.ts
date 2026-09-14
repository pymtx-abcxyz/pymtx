import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import {
  findBusinessByStripeAccount,
  syncConnectAccountFromStripe,
} from "@/lib/stripe-connect";
import {
  applyInstallmentFailure,
  applyInstallmentSuccess,
} from "@/lib/settlement";

/**
 * Stripe webhook — Connect + ACSS Debit events.
 * Enable "Listen to events on Connected accounts" for Direct Charges.
 *
 * Success / NSF failure share settlement helpers with chargeInstallment
 * so async ACSS outcomes match the sync presentment path.
 */
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || secret.includes("placeholder") || !sig) {
    return NextResponse.json({ received: true, demo: true });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid signature" },
      { status: 400 },
    );
  }

  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    const business =
      (await findBusinessByStripeAccount(account.id)) ||
      (account.metadata?.harbor_business_id
        ? await prisma.business.findUnique({
            where: { id: account.metadata.harbor_business_id },
          })
        : null);

    if (business) {
      await syncConnectAccountFromStripe(business.id, account);
    }
    return NextResponse.json({ received: true, type: event.type });
  }

  if (
    event.type === "payment_intent.succeeded" ||
    event.type === "payment_intent.payment_failed"
  ) {
    const pi = event.data.object as Stripe.PaymentIntent;
    const installmentId = pi.metadata?.harbor_installment_id;
    if (!installmentId) {
      return NextResponse.json({ received: true, skipped: "no_installment" });
    }

    const attemptId = pi.metadata?.harbor_attempt_id || null;

    if (event.type === "payment_intent.succeeded") {
      const result = await applyInstallmentSuccess({
        installmentId,
        paymentIntentId: pi.id,
        applicationFeeCents: pi.application_fee_amount || 0,
        attemptId,
      });
      return NextResponse.json({
        received: true,
        type: event.type,
        settlement: result,
      });
    }

    const result = await applyInstallmentFailure({
      installmentId,
      paymentIntentId: pi.id,
      attemptId,
      failureCode: pi.last_payment_error?.code || null,
      failureMessage: pi.last_payment_error?.message || null,
    });
    return NextResponse.json({
      received: true,
      type: event.type,
      settlement: result,
    });
  }

  return NextResponse.json({ received: true, type: event.type });
}
