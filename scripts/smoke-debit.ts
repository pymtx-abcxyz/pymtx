import { format } from "date-fns";
import { prisma } from "../src/lib/db";
import { runDailyDebitJob } from "../src/lib/debit-job";

async function main() {
  const plan = await prisma.paymentPlan.findFirst({
    where: { status: "ACTIVE" },
    include: {
      installments: { orderBy: { sequence: "asc" }, take: 1 },
      customer: { include: { business: true } },
    },
  });
  if (!plan) throw new Error("no active plan");

  const biz = plan.customer.business;
  console.log("business connect", {
    charges: biz.stripeChargesEnabled,
    onboarded: biz.stripeOnboardingComplete,
    acct: biz.stripeAccountId,
  });

  const inst = plan.installments[0];
  const today = new Date();
  await prisma.installment.update({
    where: { id: inst.id },
    data: { dueDate: today, status: "SCHEDULED" },
  });

  const runDate = format(today, "yyyy-MM-dd");
  await prisma.debitJobRun.deleteMany({ where: { runDate } });

  const result = await runDailyDebitJob(today);
  console.log(JSON.stringify(result, null, 2));

  const after = await prisma.installment.findUnique({ where: { id: inst.id } });
  console.log("installment after", {
    status: after?.status,
    pi: after?.stripePaymentIntentId,
    paidAt: after?.paidAt,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
