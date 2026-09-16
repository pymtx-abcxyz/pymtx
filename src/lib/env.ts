/**
 * Runtime environment guards for Pymtx.
 * Demo mode (placeholder Stripe keys) is allowed locally;
 * production must set real secrets unless ALLOW_DEMO_MODE=true.
 *
 * Go-live lock (production + ALLOW_DEMO_MODE≠true):
 * - No placeholder Stripe / webhook secrets
 * - Redis (or KV) required for distributed rate limits
 * - Resend required for Rule H1 written confirmations
 *
 * Real-money rails (optional REQUIRE_LIVE_STRIPE=true):
 * - Stripe secret must be sk_live_…
 * - Publishable key must be pk_live_…
 *
 * Env aliases (valid-shaped key preferred over garbage/shadow values):
 * - Secret: STRIPE_SECRET_KEY | PYMTX_STRIPE_SECRET_KEY | PYMTX_STRIPE_MCP_KEY
 * - Publishable: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | STRIPE_PUBLISHABLE_KEY |
 *                NEXT_PUBLIC_PYMTX_STRIPE_PUBLISHABLE_KEY | PYMTX_STRIPE_PUBLISHABLE_KEY
 * - Webhook: STRIPE_CONNECT_WEBHOOK_SECRET | STRIPE_WEBHOOK_SECRET | PYMTX_STRIPE_WEBHOOK_SECRET
 */

function firstReal(...candidates: (string | undefined | null)[]): string {
  for (const c of candidates) {
    const v = c?.trim();
    if (v && !v.includes("placeholder")) return v;
  }
  // Fall back to first non-empty even if placeholder (for local demo classification).
  for (const c of candidates) {
    const v = c?.trim();
    if (v) return v;
  }
  return "";
}

/** Prefer candidates that match a Stripe key shape; skip placeholders and junk. */
function firstMatching(
  re: RegExp,
  ...candidates: (string | undefined | null)[]
): string {
  for (const c of candidates) {
    const v = c?.trim();
    if (v && !v.includes("placeholder") && re.test(v)) return v;
  }
  return firstReal(...candidates);
}

const SK_RE = /^sk_(test|live)_/;
const PK_RE = /^pk_(test|live)_/;
const WHSEC_RE = /^whsec_/;

export function stripeSecretKey(): string {
  return firstMatching(
    SK_RE,
    process.env.STRIPE_SECRET_KEY,
    process.env.PYMTX_STRIPE_SECRET_KEY,
    process.env.PYMTX_STRIPE_MCP_KEY,
  );
}

export function stripePublishableKey(): string {
  return firstMatching(
    PK_RE,
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    process.env.STRIPE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_PYMTX_STRIPE_PUBLISHABLE_KEY,
    process.env.PYMTX_STRIPE_PUBLISHABLE_KEY,
  );
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function isStripeDemoMode() {
  const key = stripeSecretKey();
  return !key || key.includes("placeholder");
}

export type StripeKeyMode = "missing" | "placeholder" | "test" | "live" | "unknown";

export function classifyStripeSecret(key: string | undefined | null): StripeKeyMode {
  if (!key?.trim()) return "missing";
  if (key.includes("placeholder")) return "placeholder";
  if (key.startsWith("sk_live_")) return "live";
  if (key.startsWith("sk_test_")) return "test";
  return "unknown";
}

export function classifyStripePublishable(
  key: string | undefined | null,
): StripeKeyMode {
  if (!key?.trim()) return "missing";
  if (key.includes("placeholder")) return "placeholder";
  if (key.startsWith("pk_live_")) return "live";
  if (key.startsWith("pk_test_")) return "test";
  return "unknown";
}

export function stripeSecretMode(): StripeKeyMode {
  return classifyStripeSecret(stripeSecretKey());
}

export function stripePublishableMode(): StripeKeyMode {
  return classifyStripePublishable(stripePublishableKey());
}

/** Prefer Connect webhook secret (required for Path B Connect events). */
export function stripeWebhookSecret() {
  return firstMatching(
    WHSEC_RE,
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.PYMTX_STRIPE_WEBHOOK_SECRET,
    process.env.PYMTX_STRIPE_CONNECT_WEBHOOK_SECRET,
  );
}

export function isWebhookDemoMode() {
  const secret = stripeWebhookSecret();
  return !secret || secret.includes("placeholder");
}

export function allowDemoMode() {
  return process.env.ALLOW_DEMO_MODE === "true" || !isProduction();
}

/** Production with demo explicitly disabled — go-live lock. */
export function isGoLiveLocked() {
  return isProduction() && process.env.ALLOW_DEMO_MODE !== "true";
}

export function requireLiveStripe() {
  return process.env.REQUIRE_LIVE_STRIPE === "true";
}

export function hasRedisConfigured() {
  return Boolean(
    process.env.REDIS_URL?.trim() || process.env.KV_URL?.trim(),
  );
}

export function emailRailMode(): "resend" | "demo" | "resend_misconfigured" {
  const provider = (process.env.EMAIL_PROVIDER || "demo").toLowerCase();
  if (provider === "resend") {
    return process.env.RESEND_API_KEY?.trim()
      ? "resend"
      : "resend_misconfigured";
  }
  return "demo";
}

export type GoLiveCheck = {
  id: string;
  ok: boolean;
  detail: string;
};

export type GoLiveReport = {
  locked: boolean;
  requireLiveStripe: boolean;
  readyForMoneyRails: boolean;
  readyForLiveMoney: boolean;
  stripeSecret: StripeKeyMode;
  stripePublishable: StripeKeyMode;
  webhook: "ok" | "missing_or_placeholder";
  connectWebhookDedicated: boolean;
  email: ReturnType<typeof emailRailMode>;
  redis: boolean;
  inngest: boolean;
  appUrl: string;
  checks: GoLiveCheck[];
  blockers: string[];
};

/** Non-secret readiness snapshot for ops / admin. */
export function goLiveReport(): GoLiveReport {
  const locked = isGoLiveLocked();
  const liveRequired = requireLiveStripe();
  const stripeSecret = stripeSecretMode();
  const stripePublishable = stripePublishableMode();
  const webhookOk = !isWebhookDemoMode();
  const connectDedicated = Boolean(
    firstReal(
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
      process.env.PYMTX_STRIPE_CONNECT_WEBHOOK_SECRET,
    ),
  );
  const email = emailRailMode();
  const redis = hasRedisConfigured();
  const inngest = Boolean(
    process.env.INNGEST_EVENT_KEY?.trim() &&
      process.env.INNGEST_SIGNING_KEY?.trim(),
  );
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  const checks: GoLiveCheck[] = [
    {
      id: "demo_locked",
      ok: locked || !isProduction(),
      detail: locked
        ? "ALLOW_DEMO_MODE is off in production"
        : isProduction()
          ? "ALLOW_DEMO_MODE=true — demo settlement still allowed"
          : "Non-production — demo allowed",
    },
    {
      id: "stripe_secret",
      ok: stripeSecret === "live" || stripeSecret === "test",
      detail: `Stripe secret mode: ${stripeSecret}`,
    },
    {
      id: "stripe_publishable",
      ok: stripePublishable === "live" || stripePublishable === "test",
      detail: `Publishable key mode: ${stripePublishable}`,
    },
    {
      id: "stripe_webhook",
      ok: webhookOk,
      detail: webhookOk
        ? connectDedicated
          ? "Connect webhook secret configured"
          : "Using STRIPE_WEBHOOK_SECRET (prefer STRIPE_CONNECT_WEBHOOK_SECRET)"
        : "Webhook secret missing or placeholder",
    },
    {
      id: "redis",
      ok: redis || !locked,
      detail: redis
        ? "REDIS_URL / KV_URL configured"
        : "Redis required when go-live locked",
    },
    {
      id: "email",
      ok: email === "resend" || !locked,
      detail:
        email === "resend"
          ? "Resend configured"
          : email === "resend_misconfigured"
            ? "EMAIL_PROVIDER=resend but RESEND_API_KEY missing"
            : "Email still in demo mode",
    },
    {
      id: "inngest",
      ok: inngest || !locked,
      detail: inngest
        ? "Inngest keys configured"
        : "INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY recommended for locked prod",
    },
    {
      id: "app_url",
      ok: Boolean(appUrl.startsWith("https://")),
      detail: appUrl ? `NEXT_PUBLIC_APP_URL=${appUrl}` : "NEXT_PUBLIC_APP_URL missing",
    },
    {
      id: "live_stripe",
      ok: !liveRequired || (stripeSecret === "live" && stripePublishable === "live"),
      detail: liveRequired
        ? stripeSecret === "live" && stripePublishable === "live"
          ? "Live Stripe keys present"
          : "REQUIRE_LIVE_STRIPE=true but keys are not sk_live_/pk_live_"
        : "REQUIRE_LIVE_STRIPE not set (test keys allowed when non-placeholder)",
    },
  ];

  const blockers = checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`);

  const readyForMoneyRails =
    locked &&
    (stripeSecret === "live" || stripeSecret === "test") &&
    (stripePublishable === "live" || stripePublishable === "test") &&
    webhookOk &&
    redis &&
    email === "resend";

  const readyForLiveMoney =
    readyForMoneyRails &&
    stripeSecret === "live" &&
    stripePublishable === "live";

  return {
    locked,
    requireLiveStripe: liveRequired,
    readyForMoneyRails,
    readyForLiveMoney,
    stripeSecret,
    stripePublishable,
    webhook: webhookOk ? "ok" : "missing_or_placeholder",
    connectWebhookDedicated: connectDedicated,
    email,
    redis,
    inngest,
    appUrl,
    checks,
    blockers,
  };
}

/** Throws when production would run with placeholder Stripe keys. */
export function assertLiveStripeOrDemoAllowed(context: string) {
  if (isStripeDemoMode() && !allowDemoMode()) {
    throw new Error(
      `${context}: Stripe secret is placeholder but ALLOW_DEMO_MODE is not set in production`,
    );
  }
  if (isGoLiveLocked() && requireLiveStripe()) {
    const secret = stripeSecretMode();
    const pub = stripePublishableMode();
    if (secret !== "live" || pub !== "live") {
      throw new Error(
        `${context}: REQUIRE_LIVE_STRIPE=true needs sk_live_ / pk_live_ keys (got secret=${secret}, publishable=${pub})`,
      );
    }
  }
  if (isGoLiveLocked()) {
    const pub = stripePublishableMode();
    if (pub === "missing" || pub === "placeholder") {
      throw new Error(
        `${context}: Stripe publishable key is ${pub} under go-live lock`,
      );
    }
  }
}

export function assertLiveWebhookOrDemoAllowed() {
  if (isWebhookDemoMode() && !allowDemoMode()) {
    throw new Error(
      "Stripe webhook secret is placeholder but ALLOW_DEMO_MODE is not set in production",
    );
  }
}

/** Fail closed on money rails when go-live locked and critical infra missing. */
export function assertMoneyRailsReady(context: string) {
  assertLiveStripeOrDemoAllowed(context);
  assertLiveWebhookOrDemoAllowed();
  if (!isGoLiveLocked()) return;

  if (!hasRedisConfigured()) {
    throw new Error(
      `${context}: REDIS_URL or KV_URL required under go-live lock`,
    );
  }
  const email = emailRailMode();
  if (email !== "resend") {
    throw new Error(
      `${context}: EMAIL_PROVIDER=resend and RESEND_API_KEY required under go-live lock (got ${email})`,
    );
  }
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
