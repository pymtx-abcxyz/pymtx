/**
 * Debtor PAD cancel + dispute freeze + communication pause
 * (settlement-terms / Rule H1 / CDSSA counsel kill-switch).
 * Cancelling PAD does not extinguish the underlying debt.
 * Dispute freeze also pauses automated debtor notices.
 */
import { prisma } from "./db";
import { InstallmentStatus, PaymentPlanStatus } from "./domain";
import { suppressDeferredForCustomer } from "./deferred-notices";

async function pauseCustomerCommunications(params: {
  customerId: string;
  reason: string;
}) {
  const pausedAt = new Date();
  await prisma.customer.update({
    where: { id: params.customerId },
    data: {
      communicationPausedAt: pausedAt,
      communicationPauseReason: params.reason.slice(0, 500),
    },
  });
  await suppressDeferredForCustomer(params.customerId, params.reason);
  return { pausedAt };
}

export async function freezePlanForDispute(params: {
  paymentPlanId: string;
  reason?: string;
}) {
  const plan = await prisma.paymentPlan.findUnique({
    where: { id: params.paymentPlanId },
    select: {
      id: true,
      status: true,
      disputeFrozenAt: true,
      customerId: true,
    },
  });
  if (!plan) throw new Error("Payment plan not found");
  if (plan.status !== PaymentPlanStatus.ACTIVE) {
    throw new Error("Only an active plan can be disputed");
  }
  if (plan.disputeFrozenAt) {
    return {
      alreadyFrozen: true as const,
      planId: plan.id,
      frozenAt: plan.disputeFrozenAt,
    };
  }

  const frozenAt = new Date();
  const reason =
    params.reason || "Debtor registered a portal dispute";
  await prisma.paymentPlan.update({
    where: { id: plan.id },
    data: {
      disputeFrozenAt: frozenAt,
      disputeReason: reason.slice(0, 500),
    },
  });

  // CDSSA: dispute freeze also kills automated collection notices.
  await pauseCustomerCommunications({
    customerId: plan.customerId,
    reason: `dispute_freeze: ${reason}`.slice(0, 500),
  });

  return { alreadyFrozen: false as const, planId: plan.id, frozenAt };
}

/** Counsel / court communication pause — notices only (debits unchanged). */
export async function pauseCommunicationsForCounsel(params: {
  paymentPlanId: string;
  reason?: string;
}) {
  const plan = await prisma.paymentPlan.findUnique({
    where: { id: params.paymentPlanId },
    select: {
      id: true,
      customerId: true,
      customer: { select: { communicationPausedAt: true } },
    },
  });
  if (!plan) throw new Error("Payment plan not found");
  if (plan.customer.communicationPausedAt) {
    return {
      alreadyPaused: true as const,
      planId: plan.id,
      pausedAt: plan.customer.communicationPausedAt,
    };
  }
  const reason =
    params.reason ||
    "Debtor requested communication pause (counsel / court)";
  const { pausedAt } = await pauseCustomerCommunications({
    customerId: plan.customerId,
    reason,
  });
  return { alreadyPaused: false as const, planId: plan.id, pausedAt };
}

export async function resumeCommunications(params: {
  paymentPlanId: string;
}) {
  const plan = await prisma.paymentPlan.findUnique({
    where: { id: params.paymentPlanId },
    select: {
      id: true,
      customerId: true,
      disputeFrozenAt: true,
      customer: { select: { communicationPausedAt: true } },
    },
  });
  if (!plan) throw new Error("Payment plan not found");
  if (plan.disputeFrozenAt) {
    throw new Error(
      "Cannot resume communications while a dispute freeze is active",
    );
  }
  if (!plan.customer.communicationPausedAt) {
    return { alreadyResumed: true as const, planId: plan.id };
  }
  await prisma.customer.update({
    where: { id: plan.customerId },
    data: {
      communicationPausedAt: null,
      communicationPauseReason: null,
    },
  });
  return { alreadyResumed: false as const, planId: plan.id };
}

export async function cancelPadAuthorization(params: {
  paymentPlanId: string;
  reason?: string;
}) {
  const plan = await prisma.paymentPlan.findUnique({
    where: { id: params.paymentPlanId },
    include: { padMandate: true },
  });
  if (!plan) throw new Error("Payment plan not found");
  if (!plan.padMandate) throw new Error("No PAD mandate on this plan");
  if (plan.padMandate.cancelledAt) {
    return {
      alreadyCancelled: true as const,
      planId: plan.id,
      cancelledAt: plan.padMandate.cancelledAt,
    };
  }
  if (
    plan.status !== PaymentPlanStatus.ACTIVE &&
    plan.status !== PaymentPlanStatus.PENDING_MANDATE
  ) {
    throw new Error("Plan is not eligible for PAD cancellation");
  }

  const cancelledAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.padMandate.update({
      where: { id: plan.padMandate!.id },
      data: {
        cancelledAt,
        cancelReason: (
          params.reason ||
          "Payor cancelled PAD authorization in the client portal"
        ).slice(0, 500),
      },
    });
    await tx.paymentPlan.update({
      where: { id: plan.id },
      data: { status: PaymentPlanStatus.CANCELLED },
    });
    await tx.installment.updateMany({
      where: {
        paymentPlanId: plan.id,
        status: {
          in: [
            InstallmentStatus.SCHEDULED,
            InstallmentStatus.QUEUED,
            InstallmentStatus.FAILED_NSF,
          ],
        },
      },
      data: { status: InstallmentStatus.CANCELLED },
    });
  });

  return { alreadyCancelled: false as const, planId: plan.id, cancelledAt };
}
