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
  await prisma.magicLink.deleteMany();
  await prisma.passwordResetToken.deleteMany();
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
      physicalAddress: "100 Main St, Whitby, ON L1N 1A1, Canada",
      supportEmail: "billing@mapleridgedental.example",
      stripeAccountId: "acct_demo_maple",
      stripeOnboardingComplete: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeDetailsSubmitted: true,
      stripeOnboardedAt: subDays(new Date(), 14),
      caslConsentAt: new Date(),
      saasAgreementAcceptedAt: new Date(),
      saasAgreementVersion: "2026-09-16-saas-v1",
    },
  });

  const [adminHash, ownerHash, clerkHash] = await Promise.all([
    hashPassword("pymtx-admin-demo"),
    hashPassword("pymtx-business-demo"),
    hashPassword("pymtx-clerk-demo"),
  ]);

  await prisma.user.create({
    data: {
      email: "admin@pymtx.example",
      passwordHash: adminHash,
      name: "Pymtx Admin",
      role: UserRole.ADMIN,
    },
  });

  await prisma.user.create({
    data: {
      email: "billing@mapleridgedental.example",
      passwordHash: ownerHash,
      name: "Maple Ridge Owner",
      role: UserRole.OWNER,
      businessId: business.id,
    },
  });

  await prisma.user.create({
    data: {
      email: "clerk@mapleridgedental.example",
      passwordHash: clerkHash,
      name: "Maple Ridge Clerk",
      role: UserRole.CLERK,
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
      description: "Past-due account balance",
      originalAmountCents: 240_000,
      balanceCents: 240_000,
      dueDate: subDays(new Date(), 45),
      status: InvoiceStatus.PLAN_ACTIVE,
    },
    {
      customerId: customers[1].id,
      externalRef: "INV-88455",
      description: "Past-due account balance",
      originalAmountCents: 180_000,
      balanceCents: 180_000,
      dueDate: subDays(new Date(), 72),
      status: InvoiceStatus.PAST_DUE,
    },
    {
      customerId: customers[2].id,
      externalRef: "INV-88502",
      description: "Past-due account balance",
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

  console.log("Seeded Pymtx database (Step 8 roles + magic link)");
  console.log(
    JSON.stringify(
      {
        businessId: business.id,
        tradeName: business.tradeName,
        inviteTokens: customers.map((c) => ({
          name: `${c.firstName} ${c.lastName}`,
          email: c.email,
          token: c.inviteToken,
        })),
        activePlanId: plan.id,
        demoLogins: {
          admin: { email: "admin@pymtx.example", password: "pymtx-admin-demo" },
          owner: {
            email: "billing@mapleridgedental.example",
            password: "pymtx-business-demo",
          },
          clerk: {
            email: "clerk@mapleridgedental.example",
            password: "pymtx-clerk-demo",
          },
          customerMagicLink: {
            email: "aisha.rahman@example.com",
            note: "POST /api/auth/magic-link — no password",
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
