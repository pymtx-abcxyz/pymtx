import { addDays } from "date-fns";
import { prisma } from "./db";
import { applicationFeeCents, platformFeeBps, stripe } from "./stripe";
import {
  DebitAttemptKind,
  DebitAttemptStatus,
  InstallmentStatus,
  InvoiceStatus,
  PaymentPlanStatus,
} from "./domain";

function isDemoMode() {
  return (
    !process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET_KEY.includes("placeholder")
  );
}

/**
 * Zero-custody Direct Charge on the connected business account.
 * Principal → business; Harbor only takes application_fee_amount.
 * Rail: Canadian ACSS Debit (PAD / EFT).
 */
export async function chargeInstallment(installmentId: string) {
  const installment = await prisma.installment.findUnique({
    where: { id: installmentId },
    include: {
      paymentPlan: {
        include: {
          customer: { include: { business: true } },
          invoice: true,
        },
      },
    },
  });

  if (!installment) throw new Error("Installment not found");

  const canCharge =
    installment.status === InstallmentStatus.SCHEDULED ||
    installment.status === InstallmentStatus.QUEUED ||
    installment.status === InstallmentStatus.FAILED_NSF;
  if (!canCharge) {
    throw new Error(`Cannot charge installment in status ${installment.status}`);
  }

  const plan = installment.paymentPlan;
  const business = plan.customer.business;

  if (!business.stripeAccountId || !business.stripeChargesEnabled) {
    throw new Error("Business Stripe Connect account is not ready for charges");
  }
  if (!plan.stripeCustomerId || !plan.stripePaymentMethodId) {
    throw new Error("Customer PAD payment method is not on file");
  }
  if (!plan.padWrittenConfirmSentAt) {
    throw new Error("Rule H1 written confirmation has not been sent before first debit");
  }

  if (installment.status === InstallmentStatus.FAILED_NSF) {
    if (installment.nsfRetryUsed) {
      throw new Error("NSF retry already used (Rule H1: max 1 re-try)");
    }
    const anchor = installment.originalPresentmentAt ?? installment.lastAttemptAt;
    if (!anchor) throw new Error("Missing presentment timestamp for NSF retry");
    if (new Date() > addDays(anchor, 30)) {
      throw new Error("NSF retry window expired (Rule H1: within 30 days)");
    }
  }

  const fee = applicationFeeCents(installment.amountCents);
  const attemptKind =
    installment.status === InstallmentStatus.FAILED_NSF
      ? DebitAttemptKind.NSF_RETRY
      : DebitAttemptKind.PRESENTMENT;
  const attemptNumber = installment.attemptCount + 1;
  const idempotencyKey =
    installment.idempotencyKey ||
    `inst_${installmentId}_attempt_${attemptNumber}`;

  const attempt = await prisma.debitAttempt.create({
    data: {
      installmentId,
      attemptNumber,
      kind: attemptKind,
      status: DebitAttemptStatus.PENDING,
      applicationFeeCents: fee,
    },
  });

  await prisma.installment.update({
    where: { id: installmentId },
    data: {
      status: InstallmentStatus.PROCESSING,
      lastAttemptAt: new Date(),
      attemptCount: attemptNumber,
      originalPresentmentAt: installment.originalPresentmentAt ?? new Date(),
      idempotencyKey,
    },
  });

  if (isDemoMode()) {
    await prisma.$transaction([
      prisma.installment.update({
        where: { id: installmentId },
        data: {
          status: InstallmentStatus.SUCCEEDED,
          paidAt: new Date(),
          applicationFeeCents: fee,
          stripePaymentIntentId: `pi_demo_${installmentId}`,
          nsfRetryUsed:
            attemptKind === DebitAttemptKind.NSF_RETRY
              ? true
              : installment.nsfRetryUsed,
        },
      }),
      prisma.debitAttempt.update({
        where: { id: attempt.id },
        data: {
          status: DebitAttemptStatus.SUCCEEDED,
          stripePaymentIntentId: `pi_demo_${installmentId}`,
          completedAt: new Date(),
        },
      }),
      prisma.transactionMetric.create({
        data: {
          businessId: business.id,
          installmentId,
          principalCents: installment.amountCents,
          applicationFeeCents: fee,
          feeBps: platformFeeBps(),
        },
      }),
      prisma.invoice.update({
        where: { id: plan.invoiceId },
        data: { balanceCents: { decrement: installment.amountCents } },
      }),
    ]);

    await maybeCompletePlan(plan.id);
    return {
      demo: true,
      paymentIntentId: `pi_demo_${installmentId}`,
      applicationFeeCents: fee,
      attemptId: attempt.id,
    };
  }

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: installment.amountCents,
      currency: "cad",
      customer: plan.stripeCustomerId,
      payment_method: plan.stripePaymentMethodId,
      payment_method_types: ["acss_debit"],
      confirm: true,
      application_fee_amount: fee,
      mandate: plan.stripeMandateId || undefined,
      metadata: {
        harbor_installment_id: installmentId,
        harbor_plan_id: plan.id,
        harbor_invoice_id: plan.invoiceId,
        harbor_attempt_id: attempt.id,
        zero_custody: "true",
      },
    },
    {
      stripeAccount: business.stripeAccountId,
      idempotencyKey,
    },
  );

  await prisma.debitAttempt.update({
    where: { id: attempt.id },
    data: { stripePaymentIntentId: paymentIntent.id },
  });

  await prisma.installment.update({
    where: { id: installmentId },
    data: {
      stripePaymentIntentId: paymentIntent.id,
      applicationFeeCents: fee,
      status:
        paymentIntent.status === "succeeded"
          ? InstallmentStatus.SUCCEEDED
          : InstallmentStatus.PROCESSING,
      paidAt: paymentIntent.status === "succeeded" ? new Date() : null,
      nsfRetryUsed:
        attemptKind === DebitAttemptKind.NSF_RETRY
          ? true
          : installment.nsfRetryUsed,
    },
  });

  if (paymentIntent.status === "succeeded") {
    await prisma.debitAttempt.update({
      where: { id: attempt.id },
      data: { status: DebitAttemptStatus.SUCCEEDED, completedAt: new Date() },
    });
    await prisma.transactionMetric.create({
      data: {
        businessId: business.id,
        installmentId,
        principalCents: installment.amountCents,
        applicationFeeCents: fee,
        feeBps: platformFeeBps(),
      },
    });
    await prisma.invoice.update({
      where: { id: plan.invoiceId },
      data: { balanceCents: { decrement: installment.amountCents } },
    });
    await maybeCompletePlan(plan.id);
  }

  return {
    demo: false,
    paymentIntentId: paymentIntent.id,
    applicationFeeCents: fee,
    attemptId: attempt.id,
  };
}

async function maybeCompletePlan(planId: string) {
  const remaining = await prisma.installment.count({
    where: {
      paymentPlanId: planId,
      status: {
        in: [
          InstallmentStatus.SCHEDULED,
          InstallmentStatus.QUEUED,
          InstallmentStatus.PROCESSING,
          InstallmentStatus.FAILED_NSF,
          InstallmentStatus.FAILED,
        ],
      },
    },
  });
  if (remaining === 0) {
    const plan = await prisma.paymentPlan.update({
      where: { id: planId },
      data: { status: PaymentPlanStatus.COMPLETED },
    });
    await prisma.invoice.update({
      where: { id: plan.invoiceId },
      data: { status: InvoiceStatus.SETTLED, balanceCents: 0 },
    });
  }
}

/** @deprecated Use startConnectOnboarding from @/lib/stripe-connect */
export { createConnectAccount, startConnectOnboarding } from "./stripe-connect";

/** Candidates for Inngest daily debit job — uses @@index([status, dueDate]). */
export async function findDueInstallments(asOf = new Date()) {
  return prisma.installment.findMany({
    where: {
      status: {
        in: [InstallmentStatus.SCHEDULED, InstallmentStatus.QUEUED],
      },
      dueDate: { lte: asOf },
      paymentPlan: {
        status: PaymentPlanStatus.ACTIVE,
        padWrittenConfirmSentAt: { not: null },
        stripePaymentMethodId: { not: null },
      },
    },
    include: {
      paymentPlan: {
        include: {
          customer: { include: { business: true } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });
}
