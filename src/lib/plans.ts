import { prisma } from "./db";
import {
  PAD_CANCELLATION_TERMS,
  PAD_RECOURSE_TERMS,
  buildInstallmentSchedule,
} from "./compliance";

export async function createPaymentPlan(params: {
  invoiceId: string;
  termMonths: 6 | 12 | 18;
  startDate: Date;
}) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: params.invoiceId },
    include: { customer: true },
  });

  if (invoice.balanceCents <= 0) throw new Error("Invoice has no balance");
  if (![6, 12, 18].includes(params.termMonths)) {
    throw new Error("Term must be 6, 12, or 18 months");
  }

  const schedule = buildInstallmentSchedule({
    totalCents: invoice.balanceCents,
    termMonths: params.termMonths,
    startDate: params.startDate,
  });

  const monthlyAmountCents = schedule[0].amountCents;

  const plan = await prisma.$transaction(async (tx) => {
    const created = await tx.paymentPlan.create({
      data: {
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        termMonths: params.termMonths,
        monthlyAmountCents,
        totalAmountCents: invoice.balanceCents,
        status: "PENDING_MANDATE",
        startDate: params.startDate,
        installments: {
          create: schedule.map((s) => ({
            sequence: s.sequence,
            dueDate: s.dueDate,
            amountCents: s.amountCents,
            status: "SCHEDULED",
          })),
        },
      },
      include: { installments: true },
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "PLAN_ACTIVE" },
    });

    return created;
  });

  return plan;
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
}) {
  const now = new Date();
  const isDemo = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes("placeholder");

  const plan = await prisma.$transaction(async (tx) => {
    await tx.padMandate.create({
      data: {
        paymentPlanId: params.paymentPlanId,
        payorName: params.payorName,
        payorEmail: params.payorEmail,
        bankLast4: params.bankLast4,
        institutionName: params.institutionName,
        acceptedAt: now,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        confirmationSentAt: now, // written confirmation before first debit (Rule H1)
        cancellationTerms: PAD_CANCELLATION_TERMS,
        recourseTerms: PAD_RECOURSE_TERMS,
      },
    });

    return tx.paymentPlan.update({
      where: { id: params.paymentPlanId },
      data: {
        status: "ACTIVE",
        padMandateAcceptedAt: now,
        padWrittenConfirmSentAt: now,
        stripeCustomerId: params.stripeCustomerId || (isDemo ? `cus_demo_${params.paymentPlanId.slice(-8)}` : undefined),
        stripePaymentMethodId:
          params.stripePaymentMethodId || (isDemo ? `pm_demo_${params.paymentPlanId.slice(-8)}` : undefined),
      },
      include: { installments: { orderBy: { sequence: "asc" } }, padMandate: true },
    });
  });

  return plan;
}
