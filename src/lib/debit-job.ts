import { format } from "date-fns";
import { addDays } from "date-fns";
import { prisma } from "./db";
import { assertLiveStripeOrDemoAllowed } from "./env";
import { chargeInstallment, findDueInstallments } from "./payments";
import { DebitJobRunStatus, InstallmentStatus } from "./domain";

export type DebitJobResult = {
  runId: string;
  runDate: string;
  status: string;
  scannedCount: number;
  queuedCount: number;
  succeededCount: number;
  failedCount: number;
  skippedCount: number;
  errors: { installmentId: string; message: string }[];
};

/**
 * Daily ACSS Debit presenter (Inngest cron or inline API).
 *
 * Path B + Rule H1:
 * - Direct Charges on connected accounts only
 * - Written PAD confirmation required
 * - NSF: max 1 retry within platform window (default 30 days)
 * - One DebitJobRun row per calendar day (idempotent on SUCCEEDED)
 *
 * Also exported as `processDailyInstallments` for Path B naming.
 */
export async function runDailyDebitJob(asOf = new Date()): Promise<DebitJobResult> {
  // Inngest cron / event path must honor the same lock as /api/charges.
  assertLiveStripeOrDemoAllowed("processDailyInstallments");

  const runDate = format(asOf, "yyyy-MM-dd");

  const existing = await prisma.debitJobRun.findUnique({ where: { runDate } });
  if (existing?.status === DebitJobRunStatus.SUCCEEDED) {
    return {
      runId: existing.id,
      runDate,
      status: existing.status,
      scannedCount: existing.scannedCount,
      queuedCount: existing.queuedCount,
      succeededCount: existing.succeededCount,
      failedCount: existing.failedCount,
      skippedCount: existing.skippedCount,
      errors: [],
    };
  }

  const run = existing
    ? await prisma.debitJobRun.update({
        where: { id: existing.id },
        data: {
          status: DebitJobRunStatus.RUNNING,
          startedAt: new Date(),
          finishedAt: null,
          errorSummary: null,
          scannedCount: 0,
          queuedCount: 0,
          succeededCount: 0,
          failedCount: 0,
          skippedCount: 0,
        },
      })
    : await prisma.debitJobRun.create({
        data: { runDate, status: DebitJobRunStatus.RUNNING },
      });

  const due = await findDueInstallments(asOf);
  const nsfRetries = await findEligibleNsfRetries(asOf);
  const candidates = dedupeById([...due, ...nsfRetries]);

  let succeededCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const errors: { installmentId: string; message: string }[] = [];

  for (const inst of due) {
    if (inst.status === InstallmentStatus.SCHEDULED) {
      await prisma.installment.update({
        where: { id: inst.id },
        data: { status: InstallmentStatus.QUEUED },
      });
    }
  }

  for (const inst of candidates) {
    try {
      const business = inst.paymentPlan.customer.business;
      if (!business.stripeAccountId || !business.stripeChargesEnabled) {
        skippedCount += 1;
        errors.push({
          installmentId: inst.id,
          message: "Skipped: connected account not charge-ready",
        });
        if (
          inst.status === InstallmentStatus.QUEUED ||
          inst.status === InstallmentStatus.SCHEDULED
        ) {
          await prisma.installment.update({
            where: { id: inst.id },
            data: { status: InstallmentStatus.SCHEDULED },
          });
        }
        continue;
      }

      await chargeInstallment(inst.id);
      succeededCount += 1;
    } catch (e) {
      failedCount += 1;
      const message = e instanceof Error ? e.message : "Unknown charge error";
      errors.push({ installmentId: inst.id, message });
      const current = await prisma.installment.findUnique({
        where: { id: inst.id },
      });
      if (
        current?.status === InstallmentStatus.QUEUED ||
        current?.status === InstallmentStatus.PROCESSING
      ) {
        await prisma.installment.update({
          where: { id: inst.id },
          data: {
            status: InstallmentStatus.FAILED,
            failureMessage: message,
            lastAttemptAt: new Date(),
          },
        });
      }
    }
  }

  const status =
    failedCount === 0 || candidates.length === 0
      ? DebitJobRunStatus.SUCCEEDED
      : succeededCount === 0
        ? DebitJobRunStatus.FAILED
        : DebitJobRunStatus.PARTIAL;

  const updated = await prisma.debitJobRun.update({
    where: { id: run.id },
    data: {
      status,
      finishedAt: new Date(),
      scannedCount: candidates.length,
      queuedCount: due.length,
      succeededCount,
      failedCount,
      skippedCount,
      errorSummary: errors.length
        ? errors
            .slice(0, 20)
            .map((e) => `${e.installmentId}: ${e.message}`)
            .join("\n")
        : null,
    },
  });

  return {
    runId: updated.id,
    runDate,
    status: updated.status,
    scannedCount: updated.scannedCount,
    queuedCount: updated.queuedCount,
    succeededCount: updated.succeededCount,
    failedCount: updated.failedCount,
    skippedCount: updated.skippedCount,
    errors,
  };
}

async function findEligibleNsfRetries(asOf: Date) {
  const settings = await prisma.platformSettings.findFirst();
  const windowDays = settings?.nsfRetryWindowDays ?? 30;

  const failed = await prisma.installment.findMany({
    where: {
      status: InstallmentStatus.FAILED_NSF,
      nsfRetryUsed: false,
      paymentPlan: {
        status: "ACTIVE",
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
  });

  return failed.filter((i) => {
    const anchor = i.originalPresentmentAt ?? i.lastAttemptAt;
    if (!anchor) return false;
    return asOf <= addDays(anchor, windowDays);
  });
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    if (seen.has(i.id)) return false;
    seen.add(i.id);
    return true;
  });
}

/** Path B alias for the daily Direct Charge presenter. */
export const processDailyInstallments = runDailyDebitJob;
