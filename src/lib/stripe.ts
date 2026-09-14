import Stripe from "stripe";

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
  {
    // Use account default API version; cast keeps SDK types happy across releases.
    apiVersion: undefined as unknown as Stripe.LatestApiVersion,
    typescript: true,
  },
);

/** Platform take-rate in basis points (default 2.5%). */
export function platformFeeBps(): number {
  return Number(process.env.PLATFORM_FEE_BPS || 250);
}

export function applicationFeeCents(
  amountCents: number,
  bps = platformFeeBps(),
): number {
  return Math.round((amountCents * bps) / 10_000);
}
