/**
 * Runtime environment guards for Harbor.
 * Demo mode (placeholder Stripe keys) is allowed locally;
 * production must set real secrets unless ALLOW_DEMO_MODE=true.
 */

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function isStripeDemoMode() {
  const key = process.env.STRIPE_SECRET_KEY;
  return !key || key.includes("placeholder");
}

export function isWebhookDemoMode() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  return !secret || secret.includes("placeholder");
}

export function allowDemoMode() {
  return process.env.ALLOW_DEMO_MODE === "true" || !isProduction();
}

/** Throws when production would run with placeholder Stripe keys. */
export function assertLiveStripeOrDemoAllowed(context: string) {
  if (isStripeDemoMode() && !allowDemoMode()) {
    throw new Error(
      `${context}: STRIPE_SECRET_KEY is placeholder but ALLOW_DEMO_MODE is not set in production`,
    );
  }
}

export function assertLiveWebhookOrDemoAllowed() {
  if (isWebhookDemoMode() && !allowDemoMode()) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is placeholder but ALLOW_DEMO_MODE is not set in production",
    );
  }
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
