/**
 * Admin-authenticated daily debit runner (replaces unauthenticated curl).
 * Usage: npm run job:daily-debit
 */
import { prisma } from "../src/lib/db";
import { createSession, verifyPassword } from "../src/lib/auth";
import { runDailyDebitJob } from "../src/lib/debit-job";

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@harbor.example";
  const password = process.env.ADMIN_PASSWORD || "harbor-admin-demo";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== "ADMIN") {
    throw new Error(`Admin user ${email} not found — run npm run db:seed`);
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new Error("Invalid admin password");
  }
  const session = await createSession(user.id);
  console.log("Authenticated admin session", session.token.slice(0, 8) + "…");
  const result = await runDailyDebitJob(new Date());
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
