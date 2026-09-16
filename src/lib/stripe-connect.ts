import type Stripe from "stripe";
import { prisma } from "./db";
import { assertLiveStripeOrDemoAllowed, isStripeDemoMode } from "./env";
import { stripe } from "./stripe";

export { isStripeDemoMode };

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export type ConnectStatus = {
  businessId: string;
  stripeAccountId: string | null;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardedAt: string | null;
  /** Ready for ACSS Debit Direct Charges as Merchant of Record. */
  readyForDebits: boolean;
  demo: boolean;
};

type BusinessConnectFields = {
  id: string;
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeDetailsSubmitted: boolean;
  stripeOnboardedAt: Date | null;
};

export function toConnectStatus(business: BusinessConnectFields): ConnectStatus {
  const readyForDebits =
    !!business.stripeAccountId &&
    business.stripeOnboardingComplete &&
    business.stripeChargesEnabled;

  return {
    businessId: business.id,
    stripeAccountId: business.stripeAccountId,
    onboardingComplete: business.stripeOnboardingComplete,
    chargesEnabled: business.stripeChargesEnabled,
    payoutsEnabled: business.stripePayoutsEnabled,
    detailsSubmitted: business.stripeDetailsSubmitted,
    onboardedAt: business.stripeOnboardedAt?.toISOString() ?? null,
    readyForDebits,
    demo: isStripeDemoMode(),
  };
}

/**
 * Persist Stripe Account capability flags onto Business.
 * Called after onboarding return and on `account.updated` webhooks.
 */
export async function syncConnectAccountFromStripe(
  businessId: string,
  account?: Stripe.Account,
) {
  assertLiveStripeOrDemoAllowed("stripe connect sync");
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
  });

  if (isStripeDemoMode()) {
    const updated = await prisma.business.update({
      where: { id: businessId },
      data: {
        stripeAccountId:
          business.stripeAccountId || `acct_demo_${businessId.slice(-8)}`,
        stripeOnboardingComplete: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        stripeDetailsSubmitted: true,
        stripeOnboardedAt: business.stripeOnboardedAt ?? new Date(),
      },
    });
    return toConnectStatus(updated);
  }

  if (!business.stripeAccountId && !account) {
    throw new Error("Business has no Stripe Connect account to sync");
  }

  const acct =
    account || (await stripe.accounts.retrieve(business.stripeAccountId!));

  const chargesEnabled = !!acct.charges_enabled;
  const payoutsEnabled = !!acct.payouts_enabled;
  const detailsSubmitted = !!acct.details_submitted;
  const onboardingComplete = detailsSubmitted && chargesEnabled;

  const updated = await prisma.business.update({
    where: { id: businessId },
    data: {
      stripeAccountId: acct.id,
      stripeChargesEnabled: chargesEnabled,
      stripePayoutsEnabled: payoutsEnabled,
      stripeDetailsSubmitted: detailsSubmitted,
      stripeOnboardingComplete: onboardingComplete,
      stripeOnboardedAt: onboardingComplete
        ? (business.stripeOnboardedAt ?? new Date())
        : business.stripeOnboardedAt,
    },
  });

  return toConnectStatus(updated);
}

/**
 * Create or resume Stripe Connect Express onboarding for an Ontario SMB.
 *
 * Path B:
 * - Business = Merchant of Record / legal creditor
 * - Pymtx never holds principal (application_fee_amount only)
 * - Rail: Canadian ACSS Debit via `acss_debit_payments`
 */
export async function startConnectOnboarding(businessId: string) {
  assertLiveStripeOrDemoAllowed("stripe connect onboard");
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
  });

  if (isStripeDemoMode()) {
    const status = await syncConnectAccountFromStripe(businessId);
    return {
      ...status,
      url: null as string | null,
      message:
        "Demo mode: Connect account marked ready. Set STRIPE_SECRET_KEY for live Express onboarding.",
    };
  }

  let accountId = business.stripeAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "CA",
      email: business.email,
      business_type: "company",
      company: { name: business.legalName },
      capabilities: {
        acss_debit_payments: { requested: true },
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      business_profile: {
        name: business.tradeName,
        product_description:
          "Accounts receivable settlement — consumer installment PADs (Payments Canada Rule H1)",
        mcc: "8099",
      },
      metadata: {
        pymtx_business_id: businessId,
        pymtx_path: "B_zero_custody",
        province: business.province,
        ontario_corp_number: business.ontarioCorpNumber || "",
      },
    });

    accountId = account.id;
    await prisma.business.update({
      where: { id: businessId },
      data: { stripeAccountId: accountId },
    });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl()}/business/settings?stripe=refresh&businessId=${businessId}`,
    return_url: `${appUrl()}/business/settings?stripe=return&businessId=${businessId}`,
    type: "account_onboarding",
    collect: "eventually_due",
  });

  return {
    ...toConnectStatus({ ...business, stripeAccountId: accountId }),
    url: link.url as string | null,
    message: "Redirect the business to Stripe-hosted Express onboarding.",
  };
}

/** Express Dashboard login link (post-onboarding). */
export async function createConnectLoginLink(businessId: string) {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
  });

  if (isStripeDemoMode()) {
    return {
      url: null as string | null,
      demo: true,
      message: "Demo mode — no Express Dashboard URL.",
    };
  }

  if (!business.stripeAccountId) {
    throw new Error("Connect account not created yet");
  }

  const login = await stripe.accounts.createLoginLink(business.stripeAccountId);
  return { url: login.url, demo: false, message: null as string | null };
}

export async function findBusinessByStripeAccount(stripeAccountId: string) {
  return prisma.business.findUnique({ where: { stripeAccountId } });
}

/** Backward-compatible alias. */
export async function createConnectAccount(businessId: string) {
  return startConnectOnboarding(businessId);
}
