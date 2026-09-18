import type Stripe from "stripe";
import { prisma } from "./db";
import { applicationFeeCents, resolvePlatformFeeBps } from "./stripe";

export type WebhookSettlementBindInput = {
  installmentId: string;
  eventAccount: string | null | undefined;
  paymentIntent: Pick<
    Stripe.PaymentIntent,
    "id" | "amount" | "application_fee_amount"
  >;
};

/**
 * Path B zero-custody webhook bind:
 * - event.account must match the merchant Connect account
 * - PI amount must match installment principal
 * - application_fee_amount must match expected / stored fee
 * - PI id must match any already-bound installment PI id
 */
export async function assertWebhookSettlementBind(
  input: WebhookSettlementBindInput,
): Promise<string | null> {
  const { installmentId, eventAccount, paymentIntent: pi } = input;

  if (!eventAccount) {
    return `rejected: payment_intent ${installmentId} missing event.account (Path B requires Connect)`;
  }

  const installment = await prisma.installment.findUnique({
    where: { id: installmentId },
    select: {
      amountCents: true,
      applicationFeeCents: true,
      stripePaymentIntentId: true,
      paymentPlan: {
        select: {
          customer: {
            select: { business: { select: { stripeAccountId: true } } },
          },
        },
      },
    },
  });

  if (!installment) {
    return `rejected: installment ${installmentId} not found`;
  }

  const expectedAccount =
    installment.paymentPlan.customer.business.stripeAccountId || null;
  if (!expectedAccount) {
    return `rejected: installment ${installmentId} has no connected account`;
  }
  if (expectedAccount !== eventAccount) {
    return `rejected: event.account ${eventAccount} != business ${expectedAccount}`;
  }

  if (pi.amount !== installment.amountCents) {
    return `rejected: PI amount ${pi.amount} != installment ${installment.amountCents}`;
  }

  const feeBps = await resolvePlatformFeeBps();
  const expectedFee =
    installment.applicationFeeCents ??
    applicationFeeCents(installment.amountCents, feeBps);
  const piFee = pi.application_fee_amount ?? 0;
  if (piFee !== expectedFee) {
    return `rejected: PI fee ${piFee} != expected ${expectedFee}`;
  }

  if (
    installment.stripePaymentIntentId &&
    installment.stripePaymentIntentId !== pi.id
  ) {
    return `rejected: PI id ${pi.id} != bound ${installment.stripePaymentIntentId}`;
  }

  return null;
}
