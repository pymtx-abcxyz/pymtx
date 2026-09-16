import { prisma } from "./db";
import {
  PAD_AGREEMENT_VERSION,
  SETTLEMENT_TERMS_VERSION,
  renderPadAgreement,
  renderSettlementTerms,
} from "./legal";
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
import { assertLiveStripeOrDemoAllowed, isStripeDemoMode } from "./env";
import { sendPadConfirmationNotice } from "./notifications";
import { stripe } from "./stripe";

export type CheckoutPreview = {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  customerAddress: string | null;
  inviteToken: string;
  invoiceId: string;
  businessId: string;
  businessTradeName: string;
  businessLegalName: string;
  businessPhysicalAddress: string | null;
  businessSupportEmail: string;
  businessPhone: string | null;
  connectReady: boolean;
  stripeAccountId: string | null;
  balanceCents: number;
  invoiceRef: string;
  description: string;
  existingPlan: {
    id: string;
    status: string;
    termMonths: number;
    monthlyAmountCents: number;
  } | null;
  terms: { months: PlanTermMonths; monthlyCents: number; totalCents: number }[];
};

export async function getCheckoutByInvite(token: string): Promise<CheckoutPreview> {
  const customer = await prisma.customer.findUnique({
    where: { inviteToken: token },
    include: {
      business: true,
      invoices: {
        where: { status: { in: ["PAST_DUE", "INVITED", "PLAN_ACTIVE"] } },
        include: {
          paymentPlans: {
            where: { status: { in: ["PENDING_MANDATE", "ACTIVE"] } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { dueDate: "asc" },
        take: 1,
      },
    },
  });

  if (!customer) throw new Error("Invalid invite token");
  const invoice = customer.invoices[0];
  if (!invoice) throw new Error("No open invoice for this invite");

  if (!customer.activatedAt) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { activatedAt: new Date() },
    });
  }

  const connectReady =
    !!customer.business.stripeAccountId &&
    customer.business.stripeOnboardingComplete &&
    customer.business.stripeChargesEnabled;

  const total = invoice.balanceCents;
  const existing = invoice.paymentPlans[0] ?? null;

  return {
    customerId: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    customerAddress: customer.address,
    inviteToken: customer.inviteToken,
    invoiceId: invoice.id,
    businessId: customer.businessId,
    businessTradeName: customer.business.tradeName,
    businessLegalName: customer.business.legalName,
    businessPhysicalAddress: customer.business.physicalAddress,
    businessSupportEmail:
      customer.business.supportEmail || customer.business.email,
    businessPhone: customer.business.phone,
    connectReady,
    stripeAccountId: customer.business.stripeAccountId,
    balanceCents: total,
    invoiceRef: invoice.externalRef,
    description: invoice.description,
    existingPlan: existing
      ? {
          id: existing.id,
          status: existing.status,
          termMonths: existing.termMonths,
          monthlyAmountCents: existing.monthlyAmountCents,
        }
      : null,
    terms: ([6, 12, 18] as const).map((months) => {
      const schedule = buildInstallmentSchedule({
        totalCents: total,
        termMonths: months,
        startDate: new Date(),
      });
      const monthlyCents = schedule[0]?.amountCents ?? 0;
      // CDSSA: schedule sums exactly to principal — never inflate via ceil.
      return {
        months,
        monthlyCents,
        totalCents: schedule.reduce((s, i) => s + i.amountCents, 0),
      };
    }),
  };
}

export async function createCheckoutPlan(params: {
  invoiceId: string;
  termMonths: PlanTermMonths;
  startDate?: Date;
}) {
  assertLiveStripeOrDemoAllowed("checkout create_plan");
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: params.invoiceId },
    include: {
      customer: { include: { business: true } },
      paymentPlans: {
        where: { status: { in: ["PENDING_MANDATE", "ACTIVE"] } },
        take: 1,
      },
    },
  });

  if (invoice.balanceCents <= 0) throw new Error("Invoice has no balance");
  if (invoice.paymentPlans[0]) {
    throw new Error("An active or pending plan already exists for this invoice");
  }
  if (![6, 12, 18].includes(params.termMonths)) {
    throw new Error("Term must be 6, 12, or 18 months");
  }

  const business = invoice.customer.business;
  if (
    !business.stripeAccountId ||
    !business.stripeOnboardingComplete ||
    !business.stripeChargesEnabled
  ) {
    throw new Error(
      "Creditor has not finished Stripe Connect onboarding — checkout unavailable",
    );
  }

  const startDate = params.startDate ?? new Date(Date.now() + 10 * 86400000);
  const schedule = buildInstallmentSchedule({
    totalCents: invoice.balanceCents,
    termMonths: params.termMonths as 6 | 12 | 18,
    startDate,
  });

  let stripeCustomerId: string;
  if (isStripeDemoMode()) {
    stripeCustomerId = `cus_demo_${invoice.customerId.slice(-8)}`;
  } else {
    const cus = await stripe.customers.create(
      {
        email: invoice.customer.email,
        name: `${invoice.customer.firstName} ${invoice.customer.lastName}`,
        metadata: {
          pymtx_customer_id: invoice.customerId,
          pymtx_invoice_id: invoice.id,
        },
      },
      { stripeAccount: business.stripeAccountId },
    );
    stripeCustomerId = cus.id;
  }

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
        stripeCustomerId,
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

export async function completeCheckoutPad(params: {
  paymentPlanId: string;
  payorName: string;
  payorEmail: string;
  bankLast4: string;
  institutionName: string;
  transitNumber?: string;
  institutionNumber?: string;
  accountNumber?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  assertLiveStripeOrDemoAllowed("checkout accept_pad");
  if (!/^\d{4}$/.test(params.bankLast4)) {
    throw new Error("Bank last 4 digits required");
  }

  const plan = await prisma.paymentPlan.findUniqueOrThrow({
    where: { id: params.paymentPlanId },
    include: {
      customer: { include: { business: true } },
      invoice: true,
      padMandate: true,
    },
  });

  if (plan.status !== PaymentPlanStatus.PENDING_MANDATE) {
    throw new Error(`Plan is not awaiting mandate (status=${plan.status})`);
  }
  if (plan.padMandate) throw new Error("PAD mandate already accepted");

  const business = plan.customer.business;
  if (!business.stripeAccountId) {
    throw new Error("Creditor Connect account missing");
  }

  const now = new Date();
  let stripePaymentMethodId: string;
  let stripeMandateId: string;

  if (isStripeDemoMode()) {
    stripePaymentMethodId = `pm_demo_${plan.id.slice(-8)}`;
    stripeMandateId = `mandate_demo_${plan.id.slice(-8)}`;
  } else {
    if (
      !params.accountNumber ||
      !params.institutionNumber ||
      !params.transitNumber
    ) {
      throw new Error("Full bank details required for live ACSS Debit setup");
    }

    const pm = await stripe.paymentMethods.create(
      {
        type: "acss_debit",
        billing_details: {
          name: params.payorName,
          email: params.payorEmail,
        },
        acss_debit: {
          account_number: params.accountNumber,
          institution_number: params.institutionNumber,
          transit_number: params.transitNumber,
        },
      },
      { stripeAccount: business.stripeAccountId },
    );

    const setupIntent = await stripe.setupIntents.create(
      {
        customer: plan.stripeCustomerId!,
        payment_method: pm.id,
        payment_method_types: ["acss_debit"],
        confirm: true,
        mandate_data: {
          customer_acceptance: {
            type: "online",
            online: {
              ip_address: params.ipAddress || "0.0.0.0",
              user_agent: params.userAgent || "Pymtx/1.0",
            },
          },
        },
        payment_method_options: {
          acss_debit: {
            currency: "cad",
            mandate_options: {
              payment_schedule: "interval",
              interval_description: `Monthly installment (${plan.termMonths}-month plan)`,
              transaction_type: "personal",
            },
            verification_method: "automatic",
          },
        },
        metadata: {
          pymtx_plan_id: plan.id,
          pymtx_path: "B_zero_custody",
        },
      },
      { stripeAccount: business.stripeAccountId },
    );

    stripePaymentMethodId = pm.id;
    stripeMandateId =
      typeof setupIntent.mandate === "string"
        ? setupIntent.mandate
        : setupIntent.mandate?.id || `mandate_${pm.id}`;
  }

  const firstDebitDate =
    plan.startDate?.toISOString().slice(0, 10) ||
    now.toISOString().slice(0, 10);

  const formatCad = (cents: number) =>
    new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(cents / 100);

  const padAgreementText = renderPadAgreement({
    customerFullName: params.payorName,
    customerAddress: plan.customer.address || "Ontario, Canada",
    customerEmail: params.payorEmail,
    merchantLegalName: business.legalName,
    merchantPhysicalAddress: business.physicalAddress || "Ontario, Canada",
    merchantSupportEmail: business.supportEmail || business.email,
    merchantPhone: business.phone || "—",
    fiNumber: params.institutionNumber || "—",
    transitNumber: params.transitNumber || "—",
    accountLast4: params.bankLast4,
    totalPrincipalCad: formatCad(plan.invoice.balanceCents),
    tenureMonths: plan.termMonths,
    monthlyInstallmentCad: formatCad(plan.monthlyAmountCents),
    firstDebitDate,
    dayOfMonth: Number(firstDebitDate.slice(-2)) || "same day",
  });

  const settlementTermsText = renderSettlementTerms({
    merchantLegalName: business.legalName,
    customerFullName: params.payorName,
    totalInvoiceBalanceCad: formatCad(plan.invoice.balanceCents),
    monthlyAmountCad: formatCad(plan.monthlyAmountCents),
    tenureMonths: plan.termMonths,
  });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.padMandate.create({
      data: {
        paymentPlanId: plan.id,
        mandateType: PadMandateType.PERSONAL_PAD,
        payorName: params.payorName,
        payorEmail: params.payorEmail,
        bankLast4: params.bankLast4,
        institutionName: params.institutionName,
        stripeMandateId,
        acceptedAt: now,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        confirmationSentAt: now,
        cancellationTerms: PAD_CANCELLATION_TERMS,
        recourseTerms: PAD_RECOURSE_TERMS,
        agreementVersion: PAD_AGREEMENT_VERSION,
        settlementTermsVersion: SETTLEMENT_TERMS_VERSION,
        agreementText: padAgreementText,
        settlementTermsText,
      },
    });

    return tx.paymentPlan.update({
      where: { id: plan.id },
      data: {
        status: PaymentPlanStatus.ACTIVE,
        padMandateAcceptedAt: now,
        padWrittenConfirmSentAt: now,
        stripePaymentMethodId,
        stripeMandateId,
      },
      include: {
        installments: { orderBy: { sequence: "asc" } },
        padMandate: true,
        invoice: true,
        customer: { include: { business: true } },
      },
    });
  });

  // Rule H1 written confirmation — React Email + PDF under merchant From.
  await sendPadConfirmationNotice({
    businessId: business.id,
    customerId: plan.customerId,
    tradeName: business.tradeName,
    legalName: business.legalName,
    physicalAddress: business.physicalAddress,
    supportEmail: business.supportEmail || business.email,
    phone: business.phone,
    payorName: params.payorName,
    toEmail: params.payorEmail,
    customerAddress: plan.customer.address,
    invoiceRef: plan.invoice.externalRef,
    firstDebitDate,
    monthlyAmountCents: plan.monthlyAmountCents,
    totalPrincipalCents: plan.invoice.balanceCents,
    tenureMonths: plan.termMonths,
    bankLast4: params.bankLast4,
    institutionNumber: params.institutionNumber,
    transitNumber: params.transitNumber,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  }).catch((err) => {
    console.error("[checkout] PAD confirmation email failed", err);
  });

  return updated;
}
