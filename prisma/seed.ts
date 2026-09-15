import { PrismaClient } from "@prisma/client";
import { addDays, addMonths, subDays } from "date-fns";
import {
  PAD_CANCELLATION_TERMS,
  PAD_RECOURSE_TERMS,
  agingBucket,
} from "../src/lib/compliance";
import { hashPassword } from "../src/lib/auth";
import {
  CaslMessageKind,
  UserRole,
  InstallmentStatus,
  InvoiceStatus,
  PadMandateType,
  PaymentPlanStatus,
} from "../src/lib/domain";

const prisma = new PrismaClient();

async function main() {
  await prisma.stripeWebhookEvent.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.debitAttempt.deleteMany();
  await prisma.skipRequest.deleteMany();
  await prisma.transactionMetric.deleteMany();
  await prisma.caslMessage.deleteMany();
  await prisma.debitJobRun.deleteMany();
  await prisma.installment.deleteMany();
  await prisma.padMandate.deleteMany();
  await prisma.paymentPlan.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.business.deleteMany();
  await prisma.platformSettings.deleteMany();

  await prisma.platformSettings.create({
    data: {
      id: "platform",
      applicationFeeBps: 250,
      skipNoticeBusinessDays: 3,
      skipCooldownDays: 180,
      nsfRetryMax: 1,
      nsfRetryWindowDays: 30,
    },
  });

  const business = await prisma.business.create({
    data: {
      legalName: "Maple Ridge Dental Professional Corp.",
      tradeName: "Maple Ridge Dental",
      email: "billing@mapleridgedental.example",
      phone: "+1-416-555-0142",
      ontarioCorpNumber: "ON-10293847",
      stripeAccountId: "acct_demo_maple",
      stripeOnboardingComplete: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeDetailsSubmitted: true,
      stripeOnboardedAt: subDays(new Date(), 14),
      caslConsentAt: new Date(),
    },
  });

  const [adminHash, businessHash] = await Promise.all([
    hashPassword("harbor-admin-demo"),
    hashPassword("harbor-business-demo"),
  ]);

  await prisma.user.create({
    data: {
      email: "admin@harbor.example",
      passwordHash: adminHash,
      name: "Harbor Admin",
      role: UserRole.ADMIN,
    },
  });

  await prisma.user.create({
    data: {
      email: "billing@mapleridgedental.example",
      passwordHash: businessHash,
      name: "Maple Ridge Billing",
      role: UserRole.BUSINESS,
      businessId: business.id,
    },
  });

  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        businessId: business.id,
        firstName: "Aisha",
        lastName: "Rahman",
        email: "aisha.rahman@example.com",
        phone: "+1-647-555-0198",
        invitedAt: subDays(new Date(), 5),
        activatedAt: subDays(new Date(), 2),
      },
    }),
    prisma.customer.create({
      data: {
        businessId: business.id,
        firstName: "Jordan",
        lastName: "Nguyen",
        email: "jordan.nguyen@example.com",
        invitedAt: subDays(new Date(), 3),
      },
    }),
    prisma.customer.create({
      data: {
        businessId: business.id,
        firstName: "Elena",
        lastName: "Kostas",
        email: "elena.kostas@example.com",
      },
    }),
  ]);

  const specs = [
    {
      customerId: customers[0].id,
      externalRef: "INV-88421",
      description: "Orthodontic treatment balance",
      originalAmountCents: 240_000,
      balanceCents: 240_000,
      dueDate: subDays(new Date(), 45),
      status: InvoiceStatus.PLAN_ACTIVE,
    },
    {
      customerId: customers[1].id,
      externalRef: "INV-88455",
      description: "Crown & bridge services",
      originalAmountCents: 180_000,
      balanceCents: 180_000,
      dueDate: subDays(new Date(), 72),
      status: InvoiceStatus.PAST_DUE,
    },
    {
      customerId: customers[2].id,
      externalRef: "INV-88502",
      description: "Emergency dental visit",
      originalAmountCents: 96_000,
      balanceCents: 96_000,
      dueDate: subDays(new Date(), 18),
      status: InvoiceStatus.PAST_DUE,
    },
  ];

  const invoices = [];
  for (const spec of specs) {
    invoices.push(
      await prisma.invoice.create({
        data: {
          businessId: business.id,
          ...spec,
          agingBucket: agingBucket(spec.dueDate),
        },
      }),
    );
  }

  const startDate = addDays(new Date(), 10);
  const monthly = Math.floor(240_000 / 12);
  const remainder = 240_000 - monthly * 12;

  const plan = await prisma.paymentPlan.create({
    data: {
      customerId: customers[0].id,
      invoiceId: invoices[0].id,
      termMonths: 12,
      originalTermMonths: 12,
      monthlyAmountCents: monthly,
      totalAmountCents: 240_000,
      status: PaymentPlanStatus.ACTIVE,
      startDate,
      padMandateAcceptedAt: subDays(new Date(), 1),
      padWrittenConfirmSentAt: subDays(new Date(), 1),
      stripeCustomerId: "cus_demo_aisha",
      stripePaymentMethodId: "pm_demo_aisha",
      stripeMandateId: "mandate_demo_aisha",
      installments: {
        create: Array.from({ length: 12 }, (_, i) => {
          const due = addMonths(startDate, i);
          return {
            sequence: i + 1,
            dueDate: due,
            originalDueDate: due,
            amountCents: monthly + (i === 11 ? remainder : 0),
            status: InstallmentStatus.SCHEDULED,
            idempotencyKey: `demo-aisha-${i + 1}`,
          };
        }),
      },
    },
  });

  await prisma.padMandate.create({
    data: {
      paymentPlanId: plan.id,
      mandateType: PadMandateType.PERSONAL_PAD,
      payorName: "Aisha Rahman",
      payorEmail: "aisha.rahman@example.com",
      bankLast4: "4821",
      institutionName: "TD Canada Trust",
      stripeMandateId: "mandate_demo_aisha",
      acceptedAt: subDays(new Date(), 1),
      confirmationSentAt: subDays(new Date(), 1),
      cancellationTerms: PAD_CANCELLATION_TERMS,
      recourseTerms: PAD_RECOURSE_TERMS,
    },
  });

  await prisma.caslMessage.create({
    data: {
      businessId: business.id,
      customerId: customers[0].id,
      kind: CaslMessageKind.INVITE,
      fromName: business.tradeName,
      toEmail: customers[0].email,
      subject: `Settle your balance with ${business.tradeName}`,
      bodyPreview: "White-labeled invite under business identity (CASL).",
    },
  });

  await prisma.transactionMetric.createMany({
    data: [
      {
        businessId: business.id,
        principalCents: 20_000,
        applicationFeeCents: 500,
        feeBps: 250,
        occurredAt: subDays(new Date(), 20),
      },
      {
        businessId: business.id,
        principalCents: 20_000,
        applicationFeeCents: 500,
        feeBps: 250,
        occurredAt: subDays(new Date(), 10),
      },
    ],
  });

  console.log("Seeded Harbor database schema (Step 1)");
  console.log(
    JSON.stringify(
      {
        businessId: business.id,
        tradeName: business.tradeName,
        inviteTokens: customers.map((c) => ({
          name: `${c.firstName} ${c.lastName}`,
          token: c.inviteToken,
        })),
        activePlanId: plan.id,
        demoLogins: {
          admin: { email: "admin@harbor.example", password: "harbor-admin-demo" },
          business: {
            email: "billing@mapleridgedental.example",
            password: "harbor-business-demo",
          },
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
