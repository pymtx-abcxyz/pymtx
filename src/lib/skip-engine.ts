import { addDays, addMonths } from "date-fns";
import { prisma } from "./db";
import { businessDaysUntil } from "./compliance";

const SKIP_NOTICE_BUSINESS_DAYS = 3;
const SKIP_COOLDOWN_DAYS = 180;

export type SkipEligibility =
  | { ok: true; installmentId: string; dueDate: Date }
  | { ok: false; reason: string };

/**
 * Rule H1–aware skip eligibility:
 * - 1 skip every 180 days
 * - request ≥ 3 business days before debit date
 * - only SCHEDULED installments can be skipped
 */
export async function evaluateSkipEligibility(paymentPlanId: string): Promise<SkipEligibility> {
  const plan = await prisma.paymentPlan.findUnique({
    where: { id: paymentPlanId },
    include: {
      installments: { orderBy: { sequence: "asc" } },
    },
  });

  if (!plan) return { ok: false, reason: "Payment plan not found." };
  if (plan.status !== "ACTIVE") return { ok: false, reason: "Plan is not active." };

  if (plan.nextSkipAvailableAt && plan.nextSkipAvailableAt > new Date()) {
    return {
      ok: false,
      reason: `Next skip available on ${plan.nextSkipAvailableAt.toISOString().slice(0, 10)}.`,
    };
  }

  const next = plan.installments.find((i) => i.status === "SCHEDULED");
  if (!next) return { ok: false, reason: "No upcoming scheduled payment to skip." };

  const days = businessDaysUntil(new Date(), next.dueDate);
  if (days < SKIP_NOTICE_BUSINESS_DAYS) {
    return {
      ok: false,
      reason: `Skip requires at least ${SKIP_NOTICE_BUSINESS_DAYS} business days' notice before the debit date (Rule H1).`,
    };
  }

  return { ok: true, installmentId: next.id, dueDate: next.dueDate };
}

/**
 * Skip moves the installment to the end of the schedule (extends term by 1 month)
 * and locks the next skip for 180 days.
 */
export async function executeSkip(paymentPlanId: string) {
  const eligibility = await evaluateSkipEligibility(paymentPlanId);
  if (!eligibility.ok) {
    return { success: false as const, error: eligibility.reason };
  }

  const plan = await prisma.paymentPlan.findUniqueOrThrow({
    where: { id: paymentPlanId },
    include: { installments: { orderBy: { sequence: "asc" } } },
  });

  const target = plan.installments.find((i) => i.id === eligibility.installmentId)!;
  const maxSeq = Math.max(...plan.installments.map((i) => i.sequence));
  const lastDue = plan.installments.reduce(
    (latest, i) => (i.dueDate > latest ? i.dueDate : latest),
    plan.installments[0].dueDate,
  );
  const appendedSequence = maxSeq + 1;
  const appendedDue = addMonths(lastDue, 1);
  const now = new Date();
  const nextSkipAt = addDays(now, SKIP_COOLDOWN_DAYS);

  await prisma.$transaction(async (tx) => {
    await tx.installment.update({
      where: { id: target.id },
      data: { status: "SKIPPED" },
    });

    const appended = await tx.installment.create({
      data: {
        paymentPlanId,
        sequence: appendedSequence,
        dueDate: appendedDue,
        amountCents: target.amountCents,
        status: "SCHEDULED",
      },
    });

    await tx.skipRequest.create({
      data: {
        paymentPlanId,
        installmentId: target.id,
        status: "APPROVED",
        appendedSequence: appended.sequence,
      },
    });

    await tx.paymentPlan.update({
      where: { id: paymentPlanId },
      data: {
        extendedByMonths: { increment: 1 },
        lastSkipAt: now,
        nextSkipAvailableAt: nextSkipAt,
      },
    });
  });

  return {
    success: true as const,
    skippedInstallmentId: target.id,
    appendedSequence,
    appendedDue,
    nextSkipAvailableAt: nextSkipAt,
  };
}
