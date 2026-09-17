import Stripe from "stripe";
import { prisma } from "./db";
import { stripeSecretKey } from "./env";

export const stripe = new Stripe(stripeSecretKey() || "sk_test_placeholder", {
  // Use account default API version; cast keeps SDK types happy across releases.
  apiVersion: undefined as unknown as Stripe.LatestApiVersion,
  typescript: true,
});

/** Env fallback when PlatformSettings row is unavailable (sync callers / boot). */
export function platformFeeBpsFromEnv(): number {
  return Number(process.env.PLATFORM_FEE_BPS || 250);
}

/** @deprecated Prefer resolvePlatformFeeBps() — kept for sync metric display fallback. */
export function platformFeeBps(): number {
  return platformFeeBpsFromEnv();
}

/**
 * Canonical Path B take-rate: PlatformSettings.applicationFeeBps, else env, else 250.
 */
export async function resolvePlatformFeeBps(): Promise<number> {
  const settings = await prisma.platformSettings.findUnique({
    where: { id: "platform" },
    select: { applicationFeeBps: true },
  });
  if (settings?.applicationFeeBps != null && settings.applicationFeeBps >= 0) {
    return settings.applicationFeeBps;
  }
  return platformFeeBpsFromEnv();
}

export function applicationFeeCents(
  amountCents: number,
  bps = platformFeeBpsFromEnv(),
): number {
  return Math.round((amountCents * bps) / 10_000);
}

export async function resolveApplicationFeeCents(
  amountCents: number,
): Promise<{ feeCents: number; feeBps: number }> {
  const feeBps = await resolvePlatformFeeBps();
  return { feeCents: applicationFeeCents(amountCents, feeBps), feeBps };
}
