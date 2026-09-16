import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { rateLimit, rateLimitBackend, pruneRateLimits } from "./rate-limit";
import {
  allowDemoMode,
  assertLiveStripeOrDemoAllowed,
  goLiveReport,
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
import { clientIp } from "./http";

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

  it("pruneRateLimits is safe to call", () => {
    expect(() => pruneRateLimits()).not.toThrow();
  });
});

describe("clientIp", () => {
  it("prefers x-real-ip over x-forwarded-for", () => {
    const req = new NextRequest("http://localhost/api", {
      headers: {
        "x-forwarded-for": "1.1.1.1, 2.2.2.2",
        "x-real-ip": "9.9.9.9",
      },
    });
    expect(clientIp(req)).toBe("9.9.9.9");
  });

  it("uses last XFF hop when real-ip missing", () => {
    const req = new NextRequest("http://localhost/api", {
      headers: { "x-forwarded-for": "1.1.1.1, 8.8.8.8" },
    });
    expect(clientIp(req)).toBe("8.8.8.8");
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
      expect(() => assertLiveStripeOrDemoAllowed("test")).not.toThrow();
    }
  });

  it("goLiveReport returns structured checks without secrets", () => {
    const report = goLiveReport();
    expect(report).toHaveProperty("locked");
    expect(report).toHaveProperty("checks");
    expect(Array.isArray(report.blockers)).toBe(true);
    expect(["missing", "placeholder", "test", "live", "unknown"]).toContain(
      report.stripeSecret,
    );
  });

  it("prefers valid-shaped Stripe keys over shadow junk", async () => {
    const prev = { ...process.env };
    process.env.STRIPE_SECRET_KEY = "not-a-stripe-key";
    process.env.PYMTX_STRIPE_SECRET_KEY = "sk_test_validshape1234567890";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_placeholder";
    process.env.STRIPE_PUBLISHABLE_KEY = "garbage-pub";
    process.env.PYMTX_STRIPE_PUBLISHABLE_KEY = "pk_test_validshape1234567890";
    process.env.STRIPE_WEBHOOK_SECRET = "placeholder_whsec";
    process.env.PYMTX_STRIPE_WEBHOOK_SECRET = "whsec_validshape1234567890";

    const { stripeSecretKey, stripePublishableKey, stripeWebhookSecret } =
      await import("./env");

    // Re-import won't refresh — call via goLiveReport classifications after
    // clearing module cache is heavy; assert through classify helpers instead.
    const {
      classifyStripeSecret,
      classifyStripePublishable,
      stripeSecretMode,
      stripePublishableMode,
      isWebhookDemoMode,
    } = await import("./env");

    expect(classifyStripeSecret(stripeSecretKey())).toBe("test");
    expect(classifyStripePublishable(stripePublishableKey())).toBe("test");
    expect(isWebhookDemoMode()).toBe(false);
    expect(stripeSecretMode()).toBe("test");
    expect(stripePublishableMode()).toBe("test");

    process.env = prev;
  });
});
