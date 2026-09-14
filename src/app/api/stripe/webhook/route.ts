import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { platformFeeBps, stripe } from "@/lib/stripe";
import {
  findBusinessByStripeAccount,
  syncConnectAccountFromStripe,
} from "@/lib/stripe-connect";
import { DebitAttemptStatus, InstallmentStatus } from "@/lib/domain";

/**
 * Stripe webhook — Connect + ACSS Debit events.
 * Enable "Listen to events on Connected accounts" for Direct Charges.
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
    if (!installmentId) return NextResponse.json({ received: true });

    if (event.type === "payment_intent.succeeded") {
      const installment = await prisma.installment.findUnique({
        where: { id: installmentId },
        include: { paymentPlan: { include: { customer: true } } },
      });
      if (installment && installment.status !== InstallmentStatus.SUCCEEDED) {
        await prisma.$transaction([
          prisma.installment.update({
            where: { id: installmentId },
            data: {
              status: InstallmentStatus.SUCCEEDED,
              paidAt: new Date(),
              stripePaymentIntentId: pi.id,
              applicationFeeCents: pi.application_fee_amount || 0,
            },
          }),
          prisma.transactionMetric.create({
            data: {
              businessId: installment.paymentPlan.customer.businessId,
              installmentId,
              principalCents: installment.amountCents,
              applicationFeeCents: pi.application_fee_amount || 0,
              feeBps: platformFeeBps(),
            },
          }),
          prisma.invoice.update({
            where: { id: installment.paymentPlan.invoiceId },
            data: { balanceCents: { decrement: installment.amountCents } },
          }),
        ]);
      }
    } else {
      const code = pi.last_payment_error?.code || "";
      const nsf =
        code.includes("insufficient") || code === "debit_not_authorized";
      await prisma.installment.update({
        where: { id: installmentId },
        data: {
          status: nsf ? InstallmentStatus.FAILED_NSF : InstallmentStatus.FAILED,
          lastAttemptAt: new Date(),
          failureCode: code || null,
          failureMessage: pi.last_payment_error?.message || null,
        },
      });
      if (pi.metadata?.harbor_attempt_id) {
        await prisma.debitAttempt.update({
          where: { id: pi.metadata.harbor_attempt_id },
          data: {
            status: nsf
              ? DebitAttemptStatus.FAILED_NSF
              : DebitAttemptStatus.FAILED,
            failureCode: code || null,
            failureMessage: pi.last_payment_error?.message || null,
            completedAt: new Date(),
          },
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
