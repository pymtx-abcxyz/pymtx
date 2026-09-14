# Stripe webhook handler for ACSS Debit lifecycle on connected accounts.
# Configure Connect webhook endpoint to this route in production.

import { NextRequest, NextResponse } from "next/server";
import { stripe, platformFeeBps } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import Stripe from "stripe";

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

  if (
    event.type === "payment_intent.succeeded" ||
    event.type === "payment_intent.payment_failed"
  ) {
    const pi = event.data.object as Stripe.PaymentIntent;
    const installmentId = pi.metadata?.harbor_installment_id;
    if (!installmentId) {
      return NextResponse.json({ received: true });
    }

    if (event.type === "payment_intent.succeeded") {
      const installment = await prisma.installment.findUnique({
        where: { id: installmentId },
        include: { paymentPlan: true },
      });
      if (installment && installment.status !== "SUCCEEDED") {
        await prisma.$transaction([
          prisma.installment.update({
            where: { id: installmentId },
            data: {
              status: "SUCCEEDED",
              paidAt: new Date(),
              stripePaymentIntentId: pi.id,
              applicationFeeCents: pi.application_fee_amount || 0,
            },
          }),
          prisma.transactionMetric.create({
            data: {
              businessId: (
                await prisma.customer.findUniqueOrThrow({
                  where: { id: installment.paymentPlan.customerId },
                })
              ).businessId,
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
      const nsf = code.includes("insufficient") || code === "debit_not_authorized";
      await prisma.installment.update({
        where: { id: installmentId },
        data: {
          status: nsf ? "FAILED_NSF" : "FAILED",
          lastAttemptAt: new Date(),
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
