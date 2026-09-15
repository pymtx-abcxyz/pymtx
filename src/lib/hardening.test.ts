import { describe, expect, it } from "vitest";
import { rateLimit, rateLimitBackend } from "./rate-limit";
import {
  allowDemoMode,
  isProduction,
  isStripeDemoMode,
  isWebhookDemoMode,
} from "./env";
import {
  canManageConnect,
  canManageStaff,
  canUploadInvoices,
} from "./permissions";
import { UserRole } from "./domain";
import type { AuthUser } from "./auth";

describe("rateLimit", () => {
  it("allows up to limit then blocks", async () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    expect((await rateLimit({ key, limit: 2, windowMs: 60_000 })).ok).toBe(true);
    expect((await rateLimit({ key, limit: 2, windowMs: 60_000 })).ok).toBe(true);
    const third = await rateLimit({ key, limit: 2, windowMs: 60_000 });
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.retryAfterSec).toBeGreaterThan(0);
  });

  it("reports backend from REDIS_URL", () => {
    expect(["redis", "memory"]).toContain(rateLimitBackend());
  });
});

describe("permissions", () => {
  const owner: AuthUser = {
    id: "1",
    email: "o@x.com",
    name: "O",
    role: UserRole.OWNER,
    businessId: "b1",
    kind: "user",
  };
  const clerk: AuthUser = {
    ...owner,
    id: "2",
    role: UserRole.CLERK,
  };
  const admin: AuthUser = {
    ...owner,
    id: "3",
    role: UserRole.ADMIN,
    businessId: null,
  };

  it("owners manage Connect and staff; clerks do not", () => {
    expect(canManageConnect(owner)).toBe(true);
    expect(canManageStaff(owner)).toBe(true);
    expect(canUploadInvoices(owner)).toBe(true);
    expect(canManageConnect(clerk)).toBe(false);
    expect(canManageStaff(clerk)).toBe(false);
    expect(canUploadInvoices(clerk)).toBe(true);
    expect(canManageConnect(admin)).toBe(true);
  });
});

describe("env guards", () => {
  it("treats placeholder Stripe keys as demo", () => {
    expect(isStripeDemoMode()).toBe(true);
    expect(isWebhookDemoMode()).toBe(true);
  });

  it("allows demo outside production", () => {
    if (!isProduction()) {
      expect(allowDemoMode()).toBe(true);
    }
  });
});
