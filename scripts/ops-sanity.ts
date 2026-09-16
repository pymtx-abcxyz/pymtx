/**
 * Ops sanity probe — non-secret DB + health snapshot for go-live checks.
 *
 *   npx tsx scripts/ops-sanity.ts
 *   BASE_URL=https://pymtx.com npx tsx scripts/ops-sanity.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = (process.env.BASE_URL || "https://pymtx.com").replace(/\/$/, "");

async function main() {
  const healthRes = await fetch(`${BASE}/api/health`);
  const health = await healthRes.json();
  console.log("health", healthRes.status, JSON.stringify(health, null, 2));

  const inngestPut = await fetch(`${BASE}/api/inngest`, { method: "PUT" });
  const inngestBody = await inngestPut.text();
  console.log("inngest register", inngestPut.status, inngestBody.slice(0, 200));

  const [
    businesses,
    connectReady,
    paymentPlans,
    padMandates,
    installments,
  ] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({
      where: { stripeChargesEnabled: true, stripeOnboardingComplete: true },
    }),
    prisma.paymentPlan.count(),
    prisma.padMandate.count(),
    prisma.installment.count(),
  ]);

  const webhookByType = await prisma.stripeWebhookEvent.groupBy({
    by: ["type"],
    _count: { _all: true },
  });
  const recentWebhooks = await prisma.stripeWebhookEvent.findMany({
    orderBy: { processedAt: "desc" },
    take: 5,
    select: { type: true, processedAt: true, summary: true },
  });
  const recentDebitJobs = await prisma.debitJobRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 3,
  });
  const caslByKind = await prisma.caslMessage.groupBy({
    by: ["kind"],
    _count: { _all: true },
  });
  const caslWithProvider = await prisma.caslMessage.count({
    where: { providerId: { not: null } },
  });
  const caslTotal = await prisma.caslMessage.count();

  console.log(
    JSON.stringify(
      {
        counts: {
          businesses,
          connectReady,
          paymentPlans,
          padMandates,
          installments,
        },
        webhookByType,
        recentWebhooks,
        recentDebitJobs,
        caslByKind,
        caslProviderCoverage: { withProvider: caslWithProvider, total: caslTotal },
      },
      null,
      2,
    ),
  );

  const rails = health.rails || {};
  const gaps: string[] = [];
  if (!rails.readyForMoneyRails) gaps.push("money rails not ready");
  if (rails.stripeSecret !== "live") gaps.push("still on test Stripe (expected until live cutover)");
  if (!rails.inngest && rails.inngest !== undefined) gaps.push("inngest not reported ready");
  if (recentDebitJobs[0] && recentDebitJobs[0].status !== "SUCCEEDED") {
    gaps.push(`latest debit job status=${recentDebitJobs[0].status}`);
  }
  if (caslWithProvider === 0) {
    gaps.push("no CaslMessage.providerId yet — Resend delivery not proven in DB");
  }
  if (!webhookByType.some((w) => w.type.startsWith("payment_intent."))) {
    gaps.push("no payment_intent webhooks processed");
  }

  console.log("\ngaps:", gaps.length ? gaps : ["none critical"]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
