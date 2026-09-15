import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";
import {
  allowDemoMode,
  isProduction,
  isStripeDemoMode,
  isWebhookDemoMode,
} from "./env";

describe("rateLimit", () => {
  it("allows up to limit then blocks", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    expect(rateLimit({ key, limit: 2, windowMs: 60_000 }).ok).toBe(true);
    expect(rateLimit({ key, limit: 2, windowMs: 60_000 }).ok).toBe(true);
    const third = rateLimit({ key, limit: 2, windowMs: 60_000 });
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.retryAfterSec).toBeGreaterThan(0);
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
