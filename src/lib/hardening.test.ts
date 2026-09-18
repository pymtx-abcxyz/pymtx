import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { rateLimit, rateLimitBackend, pruneRateLimits } from "./rate-limit";
import {
  allowDemoMode,
  assertLiveStripeOrDemoAllowed,
  assertMoneyRailsReady,
  emailRailMode,
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
    const prev = {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      PYMTX_STRIPE_SECRET_KEY: process.env.PYMTX_STRIPE_SECRET_KEY,
      PYMTX_STRIPE_MCP_KEY: process.env.PYMTX_STRIPE_MCP_KEY,
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
      STRIPE_CONNECT_WEBHOOK_SECRET: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
      PYMTX_STRIPE_WEBHOOK_SECRET: process.env.PYMTX_STRIPE_WEBHOOK_SECRET,
    };
    process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
    delete process.env.PYMTX_STRIPE_SECRET_KEY;
    delete process.env.PYMTX_STRIPE_MCP_KEY;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_placeholder";
    delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    delete process.env.PYMTX_STRIPE_WEBHOOK_SECRET;

    expect(isStripeDemoMode()).toBe(true);
    expect(isWebhookDemoMode()).toBe(true);

    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
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
    expect(report).toHaveProperty("inngest");
    expect(Array.isArray(report.blockers)).toBe(true);
    expect(["missing", "placeholder", "test", "live", "unknown"]).toContain(
      report.stripeSecret,
    );
    const ids = report.checks.map((c) => c.id);
    expect(ids).toContain("redis");
    expect(ids).toContain("email");
    expect(ids).toContain("inngest");
  });

  it("emailRailMode requires EMAIL_FROM for resend readiness", () => {
    const prevProvider = process.env.EMAIL_PROVIDER;
    const prevKey = process.env.RESEND_API_KEY;
    const prevFrom = process.env.EMAIL_FROM;

    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_key";
    delete process.env.EMAIL_FROM;
    expect(emailRailMode()).toBe("resend_missing_from");

    process.env.EMAIL_FROM = "noreply@pymtx.com";
    expect(emailRailMode()).toBe("resend");

    if (prevProvider === undefined) delete process.env.EMAIL_PROVIDER;
    else process.env.EMAIL_PROVIDER = prevProvider;
    if (prevKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevKey;
    if (prevFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = prevFrom;
  });

  it("assertMoneyRailsReady requires Inngest under go-live lock", () => {
    const keys = [
      "NODE_ENV",
      "ALLOW_DEMO_MODE",
      "STRIPE_SECRET_KEY",
      "PYMTX_STRIPE_SECRET_KEY",
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
      "STRIPE_PUBLISHABLE_KEY",
      "PYMTX_STRIPE_PUBLISHABLE_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "PYMTX_STRIPE_WEBHOOK_SECRET",
      "STRIPE_CONNECT_WEBHOOK_SECRET",
      "REDIS_URL",
      "KV_URL",
      "EMAIL_PROVIDER",
      "RESEND_API_KEY",
      "EMAIL_FROM",
      "INNGEST_EVENT_KEY",
      "INNGEST_SIGNING_KEY",
      "REQUIRE_LIVE_STRIPE",
    ] as const;
    const prev: Record<string, string | undefined> = {};
    for (const k of keys) prev[k] = process.env[k];

    process.env.NODE_ENV = "production";
    process.env.ALLOW_DEMO_MODE = "false";
    process.env.STRIPE_SECRET_KEY = "sk_test_validshape1234567890";
    delete process.env.PYMTX_STRIPE_SECRET_KEY;
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY =
      "pk_test_validshape1234567890";
    delete process.env.STRIPE_PUBLISHABLE_KEY;
    delete process.env.PYMTX_STRIPE_PUBLISHABLE_KEY;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_validshape1234567890";
    delete process.env.PYMTX_STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    delete process.env.KV_URL;
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "noreply@pymtx.com";
    delete process.env.INNGEST_EVENT_KEY;
    delete process.env.INNGEST_SIGNING_KEY;
    delete process.env.REQUIRE_LIVE_STRIPE;

    expect(() => assertMoneyRailsReady("test")).toThrow(/INNGEST/);
    expect(goLiveReport().readyForMoneyRails).toBe(false);

    process.env.INNGEST_EVENT_KEY = "evt_test";
    process.env.INNGEST_SIGNING_KEY = "sign_test";
    expect(() => assertMoneyRailsReady("test")).not.toThrow();
    expect(goLiveReport().readyForMoneyRails).toBe(true);

    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
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

    const {
      classifyStripeSecret,
      classifyStripePublishable,
      stripeSecretKey,
      stripePublishableKey,
      stripeSecretMode,
      stripePublishableMode,
      isWebhookDemoMode: webhookDemo,
    } = await import("./env");

    expect(classifyStripeSecret(stripeSecretKey())).toBe("test");
    expect(classifyStripePublishable(stripePublishableKey())).toBe("test");
    expect(webhookDemo()).toBe(false);
    expect(stripeSecretMode()).toBe("test");
    expect(stripePublishableMode()).toBe("test");

    process.env = prev;
  });
});
