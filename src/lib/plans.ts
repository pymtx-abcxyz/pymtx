import { prisma } from "./db";
import {
  PAD_CANCELLATION_TERMS,
  PAD_RECOURSE_TERMS,
  buildInstallmentSchedule,
} from "./compliance";
import {
  InstallmentStatus,
  InvoiceStatus,
  PadMandateType,
  PaymentPlanStatus,
  type PlanTermMonths,
} from "./domain";
import { assertMoneyRailsReady, isStripeDemoMode } from "./env";
import { assertConnectedAccountDirectCharge } from "./path-b";
import { clampCheckoutStartDate } from "./checkout-start";

export async function createPaymentPlan(params: {
  invoiceId: string;
  termMonths: PlanTermMonths;
  startDate: Date;
}) {
  if (![6, 12, 18].includes(params.termMonths)) {
    throw new Error("Term must be 6, 12, or 18 months");
  }

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: params.invoiceId },
    include: { customer: { include: { business: true } } },
  });
  if (invoice.balanceCents <= 0) throw new Error("Invoice has no balance");

  const business = invoice.customer.business;
  assertConnectedAccountDirectCharge(
    business.stripeAccountId,
    "plans createPaymentPlan",
  );
  if (!business.stripeOnboardingComplete || !business.stripeChargesEnabled) {
    throw new Error(
      "Creditor Connect account is not ready — use Path B checkout after onboarding",
    );
  }

  const startDate = clampCheckoutStartDate(params.startDate);
  const schedule = buildInstallmentSchedule({
    totalCents: invoice.balanceCents,
    termMonths: params.termMonths as 6 | 12 | 18,
    startDate,
  });

  return prisma.$transaction(async (tx) => {
    const plan = await tx.paymentPlan.create({
      data: {
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        termMonths: params.termMonths,
        originalTermMonths: params.termMonths,
        monthlyAmountCents: schedule[0].amountCents,
        totalAmountCents: invoice.balanceCents,
        status: PaymentPlanStatus.PENDING_MANDATE,
        startDate,
        installments: {
          create: schedule.map((s) => ({
            sequence: s.sequence,
            dueDate: s.dueDate,
            originalDueDate: s.dueDate,
            amountCents: s.amountCents,
            status: InstallmentStatus.SCHEDULED,
            idempotencyKey: `${invoice.id}-${params.termMonths}-${s.sequence}`,
          })),
        },
      },
      include: { installments: { orderBy: { sequence: "asc" } } },
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: InvoiceStatus.PLAN_ACTIVE },
    });

    return plan;
  });
}

export async function acceptPadMandate(params: {
  paymentPlanId: string;
  payorName: string;
  payorEmail: string;
  bankLast4: string;
  institutionName: string;
  ipAddress?: string;
  userAgent?: string;
  stripeCustomerId?: string;
  stripePaymentMethodId?: string;
  stripeMandateId?: string;
}) {
  assertMoneyRailsReady("plans accept_pad");
  const now = new Date();
  const demo = isStripeDemoMode();

  const existing = await prisma.paymentPlan.findUniqueOrThrow({
    where: { id: params.paymentPlanId },
    include: { customer: { include: { business: true } } },
  });
  assertConnectedAccountDirectCharge(
    existing.customer.business.stripeAccountId,
    "plans accept_pad",
  );

  if (!demo) {
    if (
      !params.stripeCustomerId ||
      !params.stripePaymentMethodId ||
      !params.stripeMandateId
    ) {
      throw new Error(
        "Live Stripe customer, payment method, and mandate ids are required",
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    await tx.padMandate.create({
      data: {
        paymentPlanId: params.paymentPlanId,
        mandateType: PadMandateType.PERSONAL_PAD,
        payorName: params.payorName,
        payorEmail: params.payorEmail,
        bankLast4: params.bankLast4,
        institutionName: params.institutionName,
        stripeMandateId:
          params.stripeMandateId ||
          (demo ? `mandate_demo_${params.paymentPlanId.slice(-8)}` : undefined),
        acceptedAt: now,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        confirmationSentAt: now,
        cancellationTerms: PAD_CANCELLATION_TERMS,
        recourseTerms: PAD_RECOURSE_TERMS,
      },
    });

    return tx.paymentPlan.update({
      where: { id: params.paymentPlanId },
      data: {
        status: PaymentPlanStatus.ACTIVE,
        padMandateAcceptedAt: now,
        padWrittenConfirmSentAt: now,
        stripeCustomerId:
          params.stripeCustomerId ||
          (demo ? `cus_demo_${params.paymentPlanId.slice(-8)}` : undefined),
        stripePaymentMethodId:
          params.stripePaymentMethodId ||
          (demo ? `pm_demo_${params.paymentPlanId.slice(-8)}` : undefined),
        stripeMandateId:
          params.stripeMandateId ||
          (demo ? `mandate_demo_${params.paymentPlanId.slice(-8)}` : undefined),
      },
      include: {
        installments: {
          orderBy: { sequence: "asc" },
          select: {
            id: true,
            sequence: true,
            dueDate: true,
            amountCents: true,
            status: true,
          },
        },
        padMandate: {
          select: {
            bankLast4: true,
            institutionName: true,
            acceptedAt: true,
          },
        },
      },
    });
  });
}
