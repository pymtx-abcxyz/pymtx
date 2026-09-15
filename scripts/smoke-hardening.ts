/**
 * Hardening smoke checks (invite binding + rate limit + env guards).
 */
import { prisma } from "../src/lib/db";
import {
  assertInviteOwnsInvoice,
  assertInviteOwnsPlan,
} from "../src/lib/invite-access";
import { rateLimit } from "../src/lib/rate-limit";
import {
  allowDemoMode,
  assertLiveStripeOrDemoAllowed,
  isStripeDemoMode,
} from "../src/lib/env";

async function main() {
  const customer = await prisma.customer.findFirst({
    include: {
      invoices: { take: 1 },
      paymentPlans: { take: 1 },
    },
  });
  if (!customer?.invoices[0]) throw new Error("Seed customer/invoice required");

  await assertInviteOwnsInvoice(customer.inviteToken, customer.invoices[0].id);
  console.log("invite owns invoice: ok");

  let denied = false;
  try {
    await assertInviteOwnsInvoice("bogus-token", customer.invoices[0].id);
  } catch {
    denied = true;
  }
  if (!denied) throw new Error("expected bogus invite to fail");
  console.log("bogus invite denied: ok");

  if (customer.paymentPlans[0]) {
    await assertInviteOwnsPlan(customer.inviteToken, customer.paymentPlans[0].id);
    console.log("invite owns plan: ok");
  }

  const key = `smoke:${Date.now()}`;
  const a = await rateLimit({ key, limit: 2, windowMs: 60_000 });
  const b = await rateLimit({ key, limit: 2, windowMs: 60_000 });
  const c = await rateLimit({ key, limit: 2, windowMs: 60_000 });
  if (!a.ok || !b.ok || c.ok) throw new Error("rate limit expected 3rd to fail");
  console.log("rate limit: ok");

  console.log("stripe demo mode", isStripeDemoMode(), "allowDemo", allowDemoMode());
  assertLiveStripeOrDemoAllowed("smoke");
  console.log("env guard: ok");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
