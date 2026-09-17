import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import {
  assertLiveWebhookOrDemoAllowed,
  isWebhookDemoMode,
  stripeWebhookSecret,
} from "@/lib/env";
import {
  findBusinessByStripeAccount,
  syncConnectAccountFromStripe,
} from "@/lib/stripe-connect";
import {
  applyInstallmentFailure,
  applyInstallmentSuccess,
} from "@/lib/settlement";
import { InstallmentStatus } from "@/lib/domain";

/**
 * Reject Connect webhook settlement when event.account does not match the
 * installment's merchant Connect account (Path B zero-custody bind).
 */
async function assertWebhookAccountBind(
  installmentId: string,
  eventAccount: string | null | undefined,
): Promise<string | null> {
  if (!eventAccount) {
    // Platform-account events without Connect account are not Path B Direct Charges.
    return `rejected: payment_intent ${installmentId} missing event.account (Path B requires Connect)`;
  }
  const installment = await prisma.installment.findUnique({
    where: { id: installmentId },
    select: {
      paymentPlan: {
        select: {
          customer: {
            select: { business: { select: { stripeAccountId: true } } },
          },
        },
      },
    },
  });
  const expected =
    installment?.paymentPlan.customer.business.stripeAccountId || null;
  if (!expected) {
    return `rejected: installment ${installmentId} has no connected account`;
  }
  if (expected !== eventAccount) {
    return `rejected: event.account ${eventAccount} != business ${expected}`;
  }
  return null;
}

/**
 * Stripe webhook — Connect + ACSS Debit Direct Charges.
 * Enable connected-account events for Path B.
 *
 * Listens for:
 * - payment_intent.processing
 * - payment_intent.succeeded
 * - payment_intent.payment_failed
 * - account.updated
 *
 * Secret: STRIPE_CONNECT_WEBHOOK_SECRET || STRIPE_WEBHOOK_SECRET
 * Also mounted at /api/webhooks/stripe
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

  const secret = stripeWebhookSecret();
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
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
      event.type === "payment_intent.payment_failed" ||
      event.type === "payment_intent.processing"
    ) {
      // Path B: Connect events carry event.account — bind to merchant before settle.
      if (event.type === "payment_intent.processing") {
        const pi = event.data.object as Stripe.PaymentIntent;
        const installmentId = pi.metadata?.pymtx_installment_id;
        if (!installmentId) {
          summary = "payment_intent.processing without pymtx_installment_id";
        } else {
          const bindErr = await assertWebhookAccountBind(
            installmentId,
            event.account,
          );
          if (bindErr) {
            summary = bindErr;
          } else {
            await prisma.installment.updateMany({
              where: {
                id: installmentId,
                status: {
                  in: [
                    InstallmentStatus.QUEUED,
                    InstallmentStatus.SCHEDULED,
                    InstallmentStatus.PROCESSING,
                    InstallmentStatus.FAILED_NSF,
                  ],
                },
              },
              data: {
                status: InstallmentStatus.PROCESSING,
                stripePaymentIntentId: pi.id,
                lastAttemptAt: new Date(),
              },
            });
            if (pi.metadata?.pymtx_attempt_id) {
              await prisma.debitAttempt.updateMany({
                where: { id: pi.metadata.pymtx_attempt_id },
                data: { stripePaymentIntentId: pi.id },
              });
            }
            summary = `processing ${installmentId}`;
          }
        }
      } else {
        const pi = event.data.object as Stripe.PaymentIntent;
        const installmentId = pi.metadata?.pymtx_installment_id;
        if (!installmentId) {
          summary = "payment_intent without pymtx_installment_id";
        } else {
          const bindErr = await assertWebhookAccountBind(
            installmentId,
            event.account,
          );
          if (bindErr) {
            summary = bindErr;
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
