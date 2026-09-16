/**
 * Debtor PAD cancel + dispute freeze (settlement-terms / Rule H1 portal rights).
 * Cancelling PAD does not extinguish the underlying debt.
 */
import { prisma } from "./db";
import { InstallmentStatus, PaymentPlanStatus } from "./domain";

export async function freezePlanForDispute(params: {
  paymentPlanId: string;
  reason?: string;
}) {
  const plan = await prisma.paymentPlan.findUnique({
    where: { id: params.paymentPlanId },
  });
  if (!plan) throw new Error("Payment plan not found");
  if (plan.status !== PaymentPlanStatus.ACTIVE) {
    throw new Error("Only an active plan can be disputed");
  }
  if (plan.disputeFrozenAt) {
    return { alreadyFrozen: true as const, planId: plan.id, frozenAt: plan.disputeFrozenAt };
  }

  const frozenAt = new Date();
  await prisma.paymentPlan.update({
    where: { id: plan.id },
    data: {
      disputeFrozenAt: frozenAt,
      disputeReason: (params.reason || "Debtor registered a portal dispute").slice(0, 500),
    },
  });

  return { alreadyFrozen: false as const, planId: plan.id, frozenAt };
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
