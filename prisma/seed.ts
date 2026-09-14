import { PrismaClient } from "@prisma/client";
import { addDays, subDays } from "date-fns";
import { agingBucket } from "../src/lib/compliance";

const prisma = new PrismaClient();

async function main() {
  await prisma.skipRequest.deleteMany();
  await prisma.transactionMetric.deleteMany();
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
      caslConsentAt: new Date(),
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

  const invoices = [
    {
      customerId: customers[0].id,
      externalRef: "INV-88421",
      description: "Orthodontic treatment balance",
      originalAmountCents: 240000,
      balanceCents: 240000,
      dueDate: subDays(new Date(), 45),
      status: "INVITED",
    },
    {
      customerId: customers[1].id,
      externalRef: "INV-88455",
      description: "Crown & bridge services",
      originalAmountCents: 180000,
      balanceCents: 180000,
      dueDate: subDays(new Date(), 72),
      status: "PAST_DUE",
    },
    {
      customerId: customers[2].id,
      externalRef: "INV-88502",
      description: "Emergency dental visit",
      originalAmountCents: 96000,
      balanceCents: 96000,
      dueDate: subDays(new Date(), 18),
      status: "PAST_DUE",
    },
  ];

  for (const inv of invoices) {
    await prisma.invoice.create({
      data: {
        businessId: business.id,
        ...inv,
        agingBucket: agingBucket(inv.dueDate),
      },
    });
  }

  // Active plan for Aisha with skip available
  const aishaInvoice = await prisma.invoice.findFirstOrThrow({
    where: { externalRef: "INV-88421" },
  });

  const startDate = addDays(new Date(), 10); // far enough for skip notice
  const monthly = Math.floor(240000 / 12);
  const remainder = 240000 - monthly * 12;

  const plan = await prisma.paymentPlan.create({
    data: {
      customerId: customers[0].id,
      invoiceId: aishaInvoice.id,
      termMonths: 12,
      monthlyAmountCents: monthly,
      totalAmountCents: 240000,
      status: "ACTIVE",
      startDate,
      padMandateAcceptedAt: subDays(new Date(), 1),
      padWrittenConfirmSentAt: subDays(new Date(), 1),
      stripeCustomerId: "cus_demo_aisha",
      stripePaymentMethodId: "pm_demo_aisha",
      installments: {
        create: Array.from({ length: 12 }, (_, i) => ({
          sequence: i + 1,
          dueDate: addDays(startDate, i * 30),
          amountCents: monthly + (i === 11 ? remainder : 0),
          status: "SCHEDULED",
        })),
      },
    },
  });

  await prisma.padMandate.create({
    data: {
      paymentPlanId: plan.id,
      payorName: "Aisha Rahman",
      payorEmail: "aisha.rahman@example.com",
      bankLast4: "4821",
      institutionName: "TD Canada Trust",
      acceptedAt: subDays(new Date(), 1),
      confirmationSentAt: subDays(new Date(), 1),
      cancellationTerms: "Rule H1 cancellation terms",
      recourseTerms: "Rule H1 recourse terms",
    },
  });

  await prisma.invoice.update({
    where: { id: aishaInvoice.id },
    data: { status: "PLAN_ACTIVE" },
  });

  // Sample take-rate metrics
  await prisma.transactionMetric.createMany({
    data: [
      {
        businessId: business.id,
        principalCents: 20000,
        applicationFeeCents: 500,
        feeBps: 250,
        occurredAt: subDays(new Date(), 20),
      },
      {
        businessId: business.id,
        principalCents: 20000,
        applicationFeeCents: 500,
        feeBps: 250,
        occurredAt: subDays(new Date(), 10),
      },
    ],
  });

  console.log("Seeded Harbor demo data");
  console.log({
    businessId: business.id,
    tradeName: business.tradeName,
    customerInviteTokens: customers.map((c) => ({
      name: `${c.firstName} ${c.lastName}`,
      token: c.inviteToken,
      email: c.email,
    })),
    activePlanId: plan.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
