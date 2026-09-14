/**
 * Integration-style skip + settlement smoke (uses seeded SQLite).
 * Run after `npm run db:seed`.
 */
import { addDays, addMonths } from "date-fns";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db";
import { evaluateSkipEligibility, executeSkip } from "./skip-engine";
import {
  applyInstallmentFailure,
  applyInstallmentSuccess,
} from "./settlement";
import {
  DebitAttemptKind,
  DebitAttemptStatus,
  InstallmentStatus,
  PaymentPlanStatus,
} from "./domain";

describe("skip-engine polish", () => {
  let planId: string;

  beforeAll(async () => {
    const plan = await prisma.paymentPlan.findFirst({
      where: { status: PaymentPlanStatus.ACTIVE },
      include: { installments: { orderBy: { sequence: "asc" } } },
    });
    if (!plan) throw new Error("Seed an ACTIVE plan first (npm run db:seed)");
    planId = plan.id;

    // Ensure first installment is far enough out for Rule H1 notice.
    const far = addMonths(new Date(), 1);
    await prisma.installment.updateMany({
      where: { paymentPlanId: planId, status: InstallmentStatus.SCHEDULED },
      data: {},
    });
    const first = plan.installments.find(
      (i) => i.status === InstallmentStatus.SCHEDULED,
    );
    if (first) {
      await prisma.installment.update({
        where: { id: first.id },
        data: { dueDate: far, status: InstallmentStatus.SCHEDULED },
      });
    }
    await prisma.paymentPlan.update({
      where: { id: planId },
      data: { nextSkipAvailableAt: null, lastSkipAt: null },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("allows skip with ≥3 business days notice", async () => {
    const elig = await evaluateSkipEligibility(planId);
    expect(elig.ok).toBe(true);
    if (!elig.ok) return;
    expect(elig.noticeRequired).toBe(3);
    expect(elig.cooldownDays).toBe(180);
  });

  it("denies skip when an installment is QUEUED", async () => {
    const next = await prisma.installment.findFirst({
      where: { paymentPlanId: planId, status: InstallmentStatus.SCHEDULED },
      orderBy: { sequence: "asc" },
    });
    expect(next).toBeTruthy();
    await prisma.installment.update({
      where: { id: next!.id },
      data: { status: InstallmentStatus.QUEUED },
    });
    const elig = await evaluateSkipEligibility(planId);
    expect(elig.ok).toBe(false);
    if (elig.ok) return;
    expect(elig.reason).toMatch(/queued or processing/i);
    await prisma.installment.update({
      where: { id: next!.id },
      data: { status: InstallmentStatus.SCHEDULED },
    });
  });

  it("executes skip, appends installment, locks cooldown, writes CASL", async () => {
    const before = await prisma.installment.count({ where: { paymentPlanId: planId } });
    const result = await executeSkip(planId);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const after = await prisma.installment.count({ where: { paymentPlanId: planId } });
    expect(after).toBe(before + 1);

    const skipped = await prisma.installment.findUnique({
      where: { id: result.skippedInstallmentId },
    });
    expect(skipped?.status).toBe(InstallmentStatus.SKIPPED);

    const plan = await prisma.paymentPlan.findUniqueOrThrow({ where: { id: planId } });
    expect(plan.nextSkipAvailableAt).toBeTruthy();
    expect(plan.nextSkipAvailableAt!.getTime()).toBeGreaterThan(
      addDays(new Date(), 170).getTime(),
    );

    const casl = await prisma.caslMessage.findFirst({
      where: { kind: "SKIP_CONFIRMATION", customerId: plan.customerId },
      orderBy: { sentAt: "desc" },
    });
    expect(casl).toBeTruthy();

    const again = await executeSkip(planId);
    expect(again.success).toBe(false);
  });
});

describe("settlement webhook parity", () => {
  it("marks NSF on failure and succeeds idempotently", async () => {
    const plan = await prisma.paymentPlan.findFirst({
      where: { status: PaymentPlanStatus.ACTIVE },
      include: {
        installments: {
          where: { status: InstallmentStatus.SCHEDULED },
          orderBy: { sequence: "asc" },
          take: 1,
        },
        customer: true,
      },
    });
    if (!plan?.installments[0]) return;

    const inst = plan.installments[0];
    const attempt = await prisma.debitAttempt.create({
      data: {
        installmentId: inst.id,
        attemptNumber: 1,
        kind: DebitAttemptKind.PRESENTMENT,
        status: DebitAttemptStatus.PENDING,
      },
    });
    await prisma.installment.update({
      where: { id: inst.id },
      data: { status: InstallmentStatus.PROCESSING },
    });

    const fail = await applyInstallmentFailure({
      installmentId: inst.id,
      paymentIntentId: `pi_test_fail_${inst.id}`,
      attemptId: attempt.id,
      failureCode: "insufficient_funds",
      failureMessage: "NSF",
    });
    expect(fail.ignored).toBe(false);
    if (fail.ignored) return;
    expect(fail.nsf).toBe(true);

    const afterFail = await prisma.installment.findUniqueOrThrow({
      where: { id: inst.id },
    });
    expect(afterFail.status).toBe(InstallmentStatus.FAILED_NSF);
    expect(afterFail.originalPresentmentAt).toBeTruthy();

    const attemptAfter = await prisma.debitAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });
    expect(attemptAfter.status).toBe(DebitAttemptStatus.FAILED_NSF);

    // NSF retry attempt then success via shared helper (webhook path).
    const retry = await prisma.debitAttempt.create({
      data: {
        installmentId: inst.id,
        attemptNumber: 2,
        kind: DebitAttemptKind.NSF_RETRY,
        status: DebitAttemptStatus.PENDING,
      },
    });
    await prisma.installment.update({
      where: { id: inst.id },
      data: { status: InstallmentStatus.PROCESSING, attemptCount: 2 },
    });

    const balBefore = (
      await prisma.invoice.findUniqueOrThrow({ where: { id: plan.invoiceId } })
    ).balanceCents;

    const ok1 = await applyInstallmentSuccess({
      installmentId: inst.id,
      paymentIntentId: `pi_test_ok_${inst.id}`,
      applicationFeeCents: 500,
      attemptId: retry.id,
    });
    expect(ok1.alreadySettled).toBe(false);

    const ok2 = await applyInstallmentSuccess({
      installmentId: inst.id,
      paymentIntentId: `pi_test_ok_${inst.id}`,
      applicationFeeCents: 500,
      attemptId: retry.id,
    });
    expect(ok2.alreadySettled).toBe(true);

    const balAfter = (
      await prisma.invoice.findUniqueOrThrow({ where: { id: plan.invoiceId } })
    ).balanceCents;
    expect(balBefore - balAfter).toBe(inst.amountCents);

    const metrics = await prisma.transactionMetric.count({
      where: { installmentId: inst.id },
    });
    expect(metrics).toBe(1);

    const settled = await prisma.installment.findUniqueOrThrow({
      where: { id: inst.id },
    });
    expect(settled.status).toBe(InstallmentStatus.SUCCEEDED);
    expect(settled.nsfRetryUsed).toBe(true);
  });
});
