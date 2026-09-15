/**
 * Step 8 smoke: Redis/memory rate limit, roles, customer magic link.
 */
import { prisma } from "../src/lib/db";
import { rateLimit, rateLimitBackend } from "../src/lib/rate-limit";
import {
  canManageConnect,
  canManageStaff,
  canUploadInvoices,
} from "../src/lib/permissions";
import { UserRole, normalizeUserRole } from "../src/lib/domain";
import {
  consumeMagicLink,
  requestCustomerMagicLink,
} from "../src/lib/magic-link";
import type { AuthUser } from "../src/lib/auth";

async function main() {
  console.log("rateLimit backend:", rateLimitBackend());

  const key = `smoke8:${Date.now()}`;
  const a = await rateLimit({ key, limit: 2, windowMs: 60_000 });
  const b = await rateLimit({ key, limit: 2, windowMs: 60_000 });
  const c = await rateLimit({ key, limit: 2, windowMs: 60_000 });
  if (!a.ok || !b.ok || c.ok) throw new Error("rate limit expected 3rd to fail");
  console.log("rate limit: ok");

  expectRoleMatrix();

  const owner = await prisma.user.findFirst({ where: { role: UserRole.OWNER } });
  const clerk = await prisma.user.findFirst({ where: { role: UserRole.CLERK } });
  if (!owner || !clerk) throw new Error("Seed OWNER and CLERK users required");
  console.log("seed roles:", owner.email, clerk.email);

  const customer = await prisma.customer.findFirst({
    where: { email: "aisha.rahman@example.com" },
  });
  if (!customer) throw new Error("Seed customer aisha required");

  const requested = await requestCustomerMagicLink(customer.email);
  if (!requested.demoUrl) throw new Error("expected demoUrl in local/demo mode");
  const token = new URL(requested.demoUrl).searchParams.get("token");
  if (!token) throw new Error("demoUrl missing token");

  const consumed = await consumeMagicLink(token);
  if (consumed.customer.id !== customer.id) throw new Error("wrong customer");
  console.log("magic link consume: ok", consumed.inviteToken.slice(0, 8) + "…");

  let reused = false;
  try {
    await consumeMagicLink(token);
  } catch {
    reused = true;
  }
  if (!reused) throw new Error("expected used magic link to fail");
  console.log("magic link one-time: ok");

  console.log("Step 8 smoke passed");
}

function expectRoleMatrix() {
  const owner: AuthUser = {
    id: "o",
    email: "o@x.com",
    name: "O",
    role: UserRole.OWNER,
    businessId: "b",
    kind: "user",
  };
  const clerk: AuthUser = { ...owner, id: "c", role: UserRole.CLERK };
  if (!canManageConnect(owner) || canManageConnect(clerk)) {
    throw new Error("Connect permission matrix failed");
  }
  if (!canManageStaff(owner) || canManageStaff(clerk)) {
    throw new Error("Staff permission matrix failed");
  }
  if (!canUploadInvoices(owner) || !canUploadInvoices(clerk)) {
    throw new Error("Upload permission matrix failed");
  }
  if (normalizeUserRole(UserRole.BUSINESS) !== UserRole.OWNER) {
    throw new Error("legacy BUSINESS should normalize to OWNER");
  }
  console.log("permission matrix: ok");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
