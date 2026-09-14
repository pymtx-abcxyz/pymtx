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
  });
  if (invoice.balanceCents <= 0) throw new Error("Invoice has no balance");

  const schedule = buildInstallmentSchedule({
    totalCents: invoice.balanceCents,
    termMonths: params.termMonths as 6 | 12 | 18,
    startDate: params.startDate,
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
        startDate: params.startDate,
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
  const now = new Date();
  const isDemo =
    !process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_SECRET_KEY.includes("placeholder");

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
          (isDemo ? `mandate_demo_${params.paymentPlanId.slice(-8)}` : undefined),
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
          (isDemo ? `cus_demo_${params.paymentPlanId.slice(-8)}` : undefined),
        stripePaymentMethodId:
          params.stripePaymentMethodId ||
          (isDemo ? `pm_demo_${params.paymentPlanId.slice(-8)}` : undefined),
        stripeMandateId:
          params.stripeMandateId ||
          (isDemo ? `mandate_demo_${params.paymentPlanId.slice(-8)}` : undefined),
      },
      include: {
        installments: { orderBy: { sequence: "asc" } },
        padMandate: true,
      },
    });
  });
}
