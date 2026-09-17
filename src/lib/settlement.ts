import { prisma } from "./db";
import { resolvePlatformFeeBps } from "./stripe";
import {
  DebitAttemptKind,
  DebitAttemptStatus,
  InstallmentStatus,
  InvoiceStatus,
  PaymentPlanStatus,
} from "./domain";
import {
  sendNsfAlertNotice,
  sendReceiptNotice,
} from "./notifications";

/** Stripe / ACSS failure codes that map to Rule H1 NSF. */
export function isNsfFailure(
  code?: string | null,
  message?: string | null,
): boolean {
  const c = (code || "").toLowerCase();
  const m = (message || "").toLowerCase();
  return (
    c.includes("insufficient") ||
    c === "debit_not_authorized" ||
    c.includes("nsf") ||
    m.includes("insufficient funds") ||
    m.includes("non-sufficient") ||
    m.includes("nsf")
  );
}

export type SettlementSuccessInput = {
  installmentId: string;
  paymentIntentId: string;
  applicationFeeCents: number;
  attemptId?: string | null;
};

export type SettlementFailureInput = {
  installmentId: string;
  paymentIntentId?: string | null;
  attemptId?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
};

/**
 * Idempotent success path shared by chargeInstallment (sync) and Stripe webhooks.
 * Safe to call twice for the same installment — invoice balance and metrics apply once.
 */
export async function applyInstallmentSuccess(input: SettlementSuccessInput) {
  const installment = await prisma.installment.findUnique({
    where: { id: input.installmentId },
    include: {
      paymentPlan: { include: { customer: true } },
      debitAttempts: { orderBy: { attemptNumber: "desc" }, take: 1 },
    },
  });
  if (!installment) throw new Error("Installment not found");

  if (installment.status === InstallmentStatus.SUCCEEDED) {
    await finalizeDebitAttempt({
      attemptId: input.attemptId,
      paymentIntentId: input.paymentIntentId,
      installmentId: input.installmentId,
      status: DebitAttemptStatus.SUCCEEDED,
    });
    return { alreadySettled: true as const, installmentId: installment.id };
  }

  const businessId = installment.paymentPlan.customer.businessId;
  const wasNsfRetry =
    installment.debitAttempts[0]?.kind === DebitAttemptKind.NSF_RETRY ||
    installment.status === InstallmentStatus.FAILED_NSF;

  await prisma.$transaction(async (tx) => {
    await tx.installment.update({
      where: { id: installment.id },
      data: {
        status: InstallmentStatus.SUCCEEDED,
        paidAt: new Date(),
        stripePaymentIntentId: input.paymentIntentId,
        applicationFeeCents: input.applicationFeeCents,
        failureCode: null,
        failureMessage: null,
        nsfRetryUsed: wasNsfRetry ? true : installment.nsfRetryUsed,
      },
    });

    const existingMetric = await tx.transactionMetric.findFirst({
      where: { installmentId: installment.id },
    });
    if (!existingMetric) {
      const feeBps = await resolvePlatformFeeBps();
      await tx.transactionMetric.create({
        data: {
          businessId,
          installmentId: installment.id,
          principalCents: installment.amountCents,
          applicationFeeCents: input.applicationFeeCents,
          feeBps,
        },
      });
      await tx.invoice.update({
        where: { id: installment.paymentPlan.invoiceId },
        data: { balanceCents: { decrement: installment.amountCents } },
      });
    }
  });

  await finalizeDebitAttempt({
    attemptId: input.attemptId,
    paymentIntentId: input.paymentIntentId,
    installmentId: input.installmentId,
    status: DebitAttemptStatus.SUCCEEDED,
  });

  await maybeCompletePlan(installment.paymentPlanId);
  await notifyReceipt(installment.id).catch((err) => {
    console.error("[settlement] receipt email failed", err);
  });

  return { alreadySettled: false as const, installmentId: installment.id };
}

/**
 * Idempotent failure / NSF path shared by charge errors and Stripe webhooks.
 */
export async function applyInstallmentFailure(input: SettlementFailureInput) {
  const installment = await prisma.installment.findUnique({
    where: { id: input.installmentId },
    include: {
      debitAttempts: { orderBy: { attemptNumber: "desc" }, take: 1 },
    },
  });
  if (!installment) throw new Error("Installment not found");

  if (installment.status === InstallmentStatus.SUCCEEDED) {
    return {
      ignored: true as const,
      reason: "already_succeeded",
      installmentId: installment.id,
    };
  }

  const nsf = isNsfFailure(input.failureCode, input.failureMessage);
  const latest = installment.debitAttempts[0];
  const wasNsfRetry = latest?.kind === DebitAttemptKind.NSF_RETRY;
  const status = nsf ? InstallmentStatus.FAILED_NSF : InstallmentStatus.FAILED;

  await prisma.installment.update({
    where: { id: installment.id },
    data: {
      status,
      lastAttemptAt: new Date(),
      originalPresentmentAt: installment.originalPresentmentAt ?? new Date(),
      failureCode: input.failureCode || null,
      failureMessage: input.failureMessage || null,
      stripePaymentIntentId:
        input.paymentIntentId || installment.stripePaymentIntentId,
      // Exhausted the single Rule H1 re-presentment if this attempt was the retry.
      nsfRetryUsed: wasNsfRetry ? true : installment.nsfRetryUsed,
    },
  });

  await finalizeDebitAttempt({
    attemptId: input.attemptId,
    paymentIntentId: input.paymentIntentId,
    installmentId: input.installmentId,
    status: nsf ? DebitAttemptStatus.FAILED_NSF : DebitAttemptStatus.FAILED,
    failureCode: input.failureCode,
    failureMessage: input.failureMessage,
  });

  if (nsf) {
    await notifyNsfAlert(installment.id, !wasNsfRetry).catch((err) => {
      console.error("[settlement] NSF alert email failed", err);
    });
  }

  return {
    ignored: false as const,
    nsf,
    status,
    installmentId: installment.id,
  };
}

async function finalizeDebitAttempt(params: {
  attemptId?: string | null;
  paymentIntentId?: string | null;
  installmentId: string;
  status: string;
  failureCode?: string | null;
  failureMessage?: string | null;
}) {
  let attemptId = params.attemptId || null;
  if (!attemptId && params.paymentIntentId) {
    const byPi = await prisma.debitAttempt.findFirst({
      where: { stripePaymentIntentId: params.paymentIntentId },
    });
    attemptId = byPi?.id ?? null;
  }
  if (!attemptId) {
    const latest = await prisma.debitAttempt.findFirst({
      where: {
        installmentId: params.installmentId,
        status: DebitAttemptStatus.PENDING,
      },
      orderBy: { attemptNumber: "desc" },
    });
    attemptId = latest?.id ?? null;
  }
  if (!attemptId) return;

  await prisma.debitAttempt.update({
    where: { id: attemptId },
    data: {
      status: params.status,
      stripePaymentIntentId: params.paymentIntentId || undefined,
      failureCode: params.failureCode ?? undefined,
      failureMessage: params.failureMessage ?? undefined,
      completedAt: new Date(),
    },
  });
}

export async function maybeCompletePlan(planId: string) {
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

async function notifyReceipt(installmentId: string) {
  const installment = await prisma.installment.findUnique({
    where: { id: installmentId },
    include: {
      paymentPlan: {
        include: {
          invoice: true,
          customer: { include: { business: true } },
        },
      },
    },
  });
  if (!installment) return;
  const { customer, invoice } = installment.paymentPlan;
  await sendReceiptNotice({
    businessId: customer.businessId,
    customerId: customer.id,
    tradeName: customer.business.tradeName,
    legalName: customer.business.legalName,
    physicalAddress: customer.business.physicalAddress,
    supportEmail: customer.business.supportEmail || customer.business.email,
    phone: customer.business.phone,
    toEmail: customer.email,
    invoiceRef: invoice.externalRef,
    amountCents: installment.amountCents,
    sequence: installment.sequence,
    paidAt: installment.paidAt || new Date(),
  });
}

async function notifyNsfAlert(installmentId: string, retryAvailable: boolean) {
  const installment = await prisma.installment.findUnique({
    where: { id: installmentId },
    include: {
      paymentPlan: {
        include: {
          invoice: true,
          customer: { include: { business: true } },
        },
      },
    },
  });
  if (!installment) return;
  const { customer, invoice } = installment.paymentPlan;
  await sendNsfAlertNotice({
    businessId: customer.businessId,
    customerId: customer.id,
    tradeName: customer.business.tradeName,
    legalName: customer.business.legalName,
    physicalAddress: customer.business.physicalAddress,
    supportEmail: customer.business.supportEmail || customer.business.email,
    phone: customer.business.phone,
    toEmail: customer.email,
    invoiceRef: invoice.externalRef,
    amountCents: installment.amountCents,
    sequence: installment.sequence,
    retryAvailable,
  });
}
