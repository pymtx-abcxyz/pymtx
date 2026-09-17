import { addDays, addMonths } from "date-fns";
import { prisma } from "./db";
import { businessDaysUntil, formatDate } from "./compliance";
import {
  InstallmentStatus,
  PaymentPlanStatus,
  SkipRequestStatus,
} from "./domain";
import { sendSkipConfirmationNotice } from "./notifications";

const DEFAULT_SKIP_NOTICE_BUSINESS_DAYS = 3;
const DEFAULT_SKIP_COOLDOWN_DAYS = 180;

export type SkipEligibility =
  | {
      ok: true;
      installmentId: string;
      dueDate: Date;
      sequence: number;
      amountCents: number;
      businessDaysNotice: number;
      noticeRequired: number;
      cooldownDays: number;
      nextSkipAvailableAt: Date | null;
    }
  | {
      ok: false;
      reason: string;
      noticeRequired: number;
      cooldownDays: number;
      nextSkipAvailableAt: Date | null;
    };

async function loadSkipPolicy() {
  const settings = await prisma.platformSettings.findUnique({
    where: { id: "platform" },
  });
  return {
    noticeRequired:
      settings?.skipNoticeBusinessDays ?? DEFAULT_SKIP_NOTICE_BUSINESS_DAYS,
    cooldownDays: settings?.skipCooldownDays ?? DEFAULT_SKIP_COOLDOWN_DAYS,
  };
}

export async function evaluateSkipEligibility(
  paymentPlanId: string,
): Promise<SkipEligibility> {
  const policy = await loadSkipPolicy();
  const plan = await prisma.paymentPlan.findUnique({
    where: { id: paymentPlanId },
    include: { installments: { orderBy: { sequence: "asc" } } },
  });

  const baseFail = {
    noticeRequired: policy.noticeRequired,
    cooldownDays: policy.cooldownDays,
    nextSkipAvailableAt: plan?.nextSkipAvailableAt ?? null,
  };

  if (!plan) {
    return { ok: false, reason: "Payment plan not found.", ...baseFail };
  }
  if (plan.status !== PaymentPlanStatus.ACTIVE) {
    return { ok: false, reason: "Plan is not active.", ...baseFail };
  }
  if (plan.nextSkipAvailableAt && plan.nextSkipAvailableAt > new Date()) {
    return {
      ok: false,
      reason: `Next skip available on ${plan.nextSkipAvailableAt.toISOString().slice(0, 10)}.`,
      ...baseFail,
      nextSkipAvailableAt: plan.nextSkipAvailableAt,
    };
  }

  const inFlight = plan.installments.find((i) =>
    (
      [InstallmentStatus.QUEUED, InstallmentStatus.PROCESSING] as string[]
    ).includes(i.status),
  );
  if (inFlight) {
    return {
      ok: false,
      reason:
        "A payment is already queued or processing. Wait for it to finish before skipping.",
      ...baseFail,
    };
  }

  const next = plan.installments.find(
    (i) => i.status === InstallmentStatus.SCHEDULED,
  );
  if (!next) {
    return {
      ok: false,
      reason: "No upcoming scheduled payment to skip.",
      ...baseFail,
    };
  }

  const days = businessDaysUntil(new Date(), next.dueDate);
  if (days < policy.noticeRequired) {
    return {
      ok: false,
      reason: `Skip requires at least ${policy.noticeRequired} business days' notice before the debit date (Rule H1).`,
      ...baseFail,
    };
  }

  return {
    ok: true,
    installmentId: next.id,
    dueDate: next.dueDate,
    sequence: next.sequence,
    amountCents: next.amountCents,
    businessDaysNotice: days,
    noticeRequired: policy.noticeRequired,
    cooldownDays: policy.cooldownDays,
    nextSkipAvailableAt: plan.nextSkipAvailableAt,
  };
}

export async function executeSkip(paymentPlanId: string) {
  const eligibility = await evaluateSkipEligibility(paymentPlanId);
  if (!eligibility.ok) {
    return { success: false as const, error: eligibility.reason };
  }

  const policy = await loadSkipPolicy();
  const now = new Date();
  const nextSkipAt = addDays(now, policy.cooldownDays);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const plan = await tx.paymentPlan.findUniqueOrThrow({
        where: { id: paymentPlanId },
        include: {
          installments: { orderBy: { sequence: "asc" } },
          customer: { include: { business: true } },
        },
      });

      if (plan.status !== PaymentPlanStatus.ACTIVE) {
        throw new Error("Plan is not active.");
      }
      if (plan.nextSkipAvailableAt && plan.nextSkipAvailableAt > now) {
        throw new Error(
          `Next skip available on ${plan.nextSkipAvailableAt.toISOString().slice(0, 10)}.`,
        );
      }

      const inFlight = plan.installments.find((i) =>
        (
          [InstallmentStatus.QUEUED, InstallmentStatus.PROCESSING] as string[]
        ).includes(i.status),
      );
      if (inFlight) {
        throw new Error(
          "A payment is already queued or processing. Wait for it to finish before skipping.",
        );
      }

      const target = plan.installments.find(
        (i) => i.id === eligibility.installmentId,
      );
      if (!target || target.status !== InstallmentStatus.SCHEDULED) {
        throw new Error("That installment is no longer eligible to skip.");
      }

      const notice = businessDaysUntil(now, target.dueDate);
      if (notice < policy.noticeRequired) {
        throw new Error(
          `Skip requires at least ${policy.noticeRequired} business days' notice before the debit date (Rule H1).`,
        );
      }

      const maxSeq = Math.max(...plan.installments.map((i) => i.sequence));
      const lastDue = plan.installments.reduce(
        (latest, i) => (i.dueDate > latest ? i.dueDate : latest),
        plan.installments[0].dueDate,
      );
      const appendedSequence = maxSeq + 1;
      const appendedDue = addMonths(lastDue, 1);

      await tx.installment.update({
        where: { id: target.id },
        data: { status: InstallmentStatus.SKIPPED },
      });

      await tx.installment.create({
        data: {
          paymentPlanId,
          sequence: appendedSequence,
          dueDate: appendedDue,
          originalDueDate: target.originalDueDate,
          amountCents: target.amountCents,
          status: InstallmentStatus.SCHEDULED,
          idempotencyKey: `${paymentPlanId}-skip-${appendedSequence}`,
        },
      });

      await tx.skipRequest.create({
        data: {
          paymentPlanId,
          installmentId: target.id,
          status: SkipRequestStatus.APPROVED,
          appendedSequence,
          businessDaysNotice: notice,
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

      return {
        skippedInstallmentId: target.id,
        skippedSequence: target.sequence,
        appendedSequence,
        appendedDue,
        amountCents: target.amountCents,
        nextSkipAvailableAt: nextSkipAt,
        cooldownDays: policy.cooldownDays,
        tradeName: plan.customer.business.tradeName,
        legalName: plan.customer.business.legalName,
        physicalAddress: plan.customer.business.physicalAddress,
        supportEmail:
          plan.customer.business.supportEmail || plan.customer.business.email,
        phone: plan.customer.business.phone,
        customerId: plan.customerId,
        businessId: plan.customer.business.id,
        customerEmail: plan.customer.email,
        skippedDue: target.dueDate,
      };
    });

    await sendSkipConfirmationNotice({
      businessId: result.businessId,
      customerId: result.customerId,
      tradeName: result.tradeName,
      legalName: result.legalName,
      physicalAddress: result.physicalAddress,
      supportEmail: result.supportEmail,
      phone: result.phone,
      toEmail: result.customerEmail,
      amountCents: result.amountCents,
      skippedDue: formatDate(result.skippedDue),
      appendedSequence: result.appendedSequence,
      appendedDue: formatDate(result.appendedDue),
      nextSkipAvailable: formatDate(result.nextSkipAvailableAt),
    }).catch((err) => {
      console.error("[skip] confirmation email failed", err);
    });

    return {
      success: true as const,
      skippedInstallmentId: result.skippedInstallmentId,
      skippedSequence: result.skippedSequence,
      appendedSequence: result.appendedSequence,
      appendedDue: result.appendedDue,
      amountCents: result.amountCents,
      nextSkipAvailableAt: result.nextSkipAvailableAt,
      cooldownDays: result.cooldownDays,
    };
  } catch (e) {
    return {
      success: false as const,
      error: e instanceof Error ? e.message : "Skip failed",
    };
  }
}
