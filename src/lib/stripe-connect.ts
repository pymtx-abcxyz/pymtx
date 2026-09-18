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
    return { ...toConnectStatus(updated), currentlyDue: [] as string[] };
  }

  if (!business.stripeAccountId && !account) {
    throw new Error("Business has no Stripe Connect account to sync");
  }

  const acct =
    account || (await stripe.accounts.retrieve(business.stripeAccountId!));

  // Refuse overwriting a live Connect binding with a different account id.
  if (
    business.stripeAccountId &&
    !isPlaceholderConnectAccount(business.stripeAccountId) &&
    business.stripeAccountId !== acct.id
  ) {
    throw new Error(
      `Connect rebind refused: business already bound to ${business.stripeAccountId}`,
    );
  }

  const chargesEnabled = !!acct.charges_enabled;
  const payoutsEnabled = !!acct.payouts_enabled;
  const detailsSubmitted = !!acct.details_submitted;
  const onboardingComplete = detailsSubmitted && chargesEnabled;
  const currentlyDue = [
    ...(acct.requirements?.currently_due || []),
    ...(acct.requirements?.past_due || []),
  ];

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

  return { ...toConnectStatus(updated), currentlyDue };
}

/** Seed / local placeholders that are not real Stripe Connect accounts. */
export function isPlaceholderConnectAccount(accountId: string | null | undefined) {
  if (!accountId?.trim()) return true;
  return accountId.startsWith("acct_demo_");
}

type MerchantDashboard = "express" | "none";

/**
 * Create a Connect merchant account via Accounts v2 (required for new platforms).
 * Returns the connected account id (still `acct_…`, interoperable with v1 Direct Charges).
 */
async function createConnectedMerchantAccountV2(params: {
  business: {
    id: string;
    email: string;
    legalName: string;
    tradeName: string;
    phone: string | null;
    supportEmail: string | null;
    province: string;
    ontarioCorpNumber: string | null;
  };
  dashboard: MerchantDashboard;
  provision?: string;
  /** Custom/provision accounts may attest ToS; Express leaves that to Stripe-hosted onboarding. */
  attestTermsOfService?: boolean;
}): Promise<string> {
  const { business, dashboard, provision, attestTermsOfService = false } =
    params;
  const nowIso = new Date().toISOString();

  try {
    const account = await stripe.v2.core.accounts.create({
      contact_email: business.email,
      contact_phone: business.phone || "+14165550100",
      display_name: business.tradeName,
      dashboard,
      defaults: {
        currency: "cad",
        locales: ["en-CA"],
        responsibilities: {
          // Path B Direct Charges: platform sets application_fee_amount.
          fees_collector: "application",
          losses_collector: "application",
        },
        profile: {
          business_url: "https://pymtx.com",
          doing_business_as: business.tradeName,
          product_description:
            "Accounts receivable settlement — consumer installment PADs (Payments Canada Rule H1)",
        },
      },
      identity: {
        country: "ca",
        entity_type: "company",
        business_details: {
          registered_name: business.legalName,
          phone: business.phone || "+14165550100",
          structure: "private_corporation",
          address: {
            line1: "100 Main Street",
            city: "Toronto",
            state: "ON",
            postal_code: "M5V 2T6",
            country: "CA",
          },
        },
        ...(attestTermsOfService
          ? {
              attestations: {
                terms_of_service: {
                  account: {
                    date: nowIso,
                    ip: "127.0.0.1",
                    user_agent: "Pymtx/smoke",
                  },
                },
              },
            }
          : {}),
      },
      configuration: {
        merchant: {
          capabilities: {
            card_payments: { requested: true },
            acss_debit_payments: { requested: true },
          },
          mcc: "8099",
          support: {
            email: business.supportEmail || business.email,
            phone: business.phone || "+14165550100",
          },
        },
      },
      metadata: {
        pymtx_business_id: business.id,
        pymtx_path: "B_zero_custody",
        province: business.province || "ON",
        ...(business.ontarioCorpNumber
          ? { ontario_corp_number: business.ontarioCorpNumber }
          : {}),
        ...(provision ? { pymtx_provision: provision } : {}),
      },
      include: [
        "configuration.merchant",
        "identity",
        "defaults",
        "requirements",
      ],
    });

    return account.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/signed up for Connect|platform profile|connect_profile_not_submitted/i.test(msg)) {
      throw new Error(
        "Stripe Connect platform profile incomplete — open https://dashboard.stripe.com/test/connect and complete Get started, then retry",
      );
    }
    if (/Accounts v1|feat_accounts_v1_support/i.test(msg)) {
      throw new Error(
        "Stripe requires Accounts v2 for this platform — ensure the app uses stripe.v2.core.accounts.create",
      );
    }
    throw e instanceof Error ? e : new Error(msg);
  }
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

  // Replace seed demo IDs so AccountLinks / Direct Charges can use a real acct_…
  if (isPlaceholderConnectAccount(accountId)) {
    accountId = null;
    await prisma.business.update({
      where: { id: businessId },
      data: {
        stripeAccountId: null,
        stripeOnboardingComplete: false,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        stripeDetailsSubmitted: false,
        stripeOnboardedAt: null,
      },
    });
  }

  if (!accountId) {
    accountId = await createConnectedMerchantAccountV2({
      business,
      dashboard: "express",
    });
    await prisma.business.update({
      where: { id: businessId },
      data: { stripeAccountId: accountId },
    });
  }

  // Account Links remain on v1 and work with v2-created accounts.
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

/**
 * Test-mode only: provision a Connect merchant account ready for
 * Direct Charges + ACSS without browser Express onboarding (E2E smoke).
 * Refuses to run against live Stripe keys.
 */
export async function provisionTestConnectAccount(businessId: string) {
  assertLiveStripeOrDemoAllowed("stripe connect provision_test");
  if (isStripeDemoMode()) {
    return syncConnectAccountFromStripe(businessId);
  }

  const key = (await import("./env")).stripeSecretKey();
  if (key.startsWith("sk_live_")) {
    throw new Error("provision_test is blocked on live Stripe keys");
  }

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
  });

  if (
    business.stripeAccountId &&
    !isPlaceholderConnectAccount(business.stripeAccountId)
  ) {
    try {
      const existing = await syncConnectAccountFromStripe(businessId);
      if (existing.readyForDebits) return existing;
      // Fall through and try to complete requirements on the existing account.
    } catch {
      /* recreate below */
    }
  }

  let accountId =
    business.stripeAccountId &&
    !isPlaceholderConnectAccount(business.stripeAccountId)
      ? business.stripeAccountId
      : null;

  if (!accountId) {
    accountId = await createConnectedMerchantAccountV2({
      business,
      dashboard: "none",
      provision: "test_smoke",
      attestTermsOfService: true,
    });
  }

  // Representative + bank via v1 APIs (still supported on v2 accounts).
  try {
    await stripe.accounts.createPerson(accountId, {
      first_name: "Smoke",
      last_name: "Owner",
      email: business.email,
      relationship: {
        representative: true,
        executive: true,
        owner: true,
        percent_ownership: 100,
        title: "Director",
      },
      address: {
        line1: "100 Main Street",
        city: "Toronto",
        state: "ON",
        postal_code: "M5V 2T6",
        country: "CA",
      },
      dob: { day: 1, month: 1, year: 1980 },
      phone: business.phone || "+14165550100",
      id_number: "000000000",
      ssn_last_4: "0000",
    });
  } catch (e) {
    // Person may already exist on retry — continue to bank / sync.
    console.warn(
      "[connect] createPerson:",
      e instanceof Error ? e.message : e,
    );
  }

  try {
    await stripe.accounts.createExternalAccount(accountId, {
      external_account: {
        object: "bank_account",
        country: "CA",
        currency: "cad",
        account_holder_name: business.legalName,
        account_holder_type: "company",
        routing_number: "11000-000",
        account_number: "000123456789",
      },
    });
  } catch (e) {
    console.warn(
      "[connect] createExternalAccount:",
      e instanceof Error ? e.message : e,
    );
  }

  await prisma.business.update({
    where: { id: businessId },
    data: { stripeAccountId: accountId },
  });

  // Prefer company tax id + company details via v1 for verification.
  try {
    await stripe.accounts.update(accountId, {
      company: {
        name: business.legalName,
        tax_id: "000000000",
        phone: business.phone || "+14165550100",
        address: {
          line1: "100 Main Street",
          city: "Toronto",
          state: "ON",
          postal_code: "M5V 2T6",
          country: "CA",
        },
        owners_provided: true,
        directors_provided: true,
        executives_provided: true,
      },
      business_type: "company",
      business_profile: {
        mcc: "8099",
        url: "https://pymtx.com",
        name: business.tradeName,
        product_description:
          "Accounts receivable settlement — consumer installment PADs (Payments Canada Rule H1)",
        support_email: business.supportEmail || business.email,
        support_phone: business.phone || "+14165550100",
      },
      tos_acceptance: {
        date: Math.floor(Date.now() / 1000),
        ip: "127.0.0.1",
      },
    });
  } catch (e) {
    console.warn(
      "[connect] accounts.update:",
      e instanceof Error ? e.message : e,
    );
  }

  const status = await syncConnectAccountFromStripe(businessId);
  if (!status.readyForDebits) {
    return {
      ...status,
      message: `Test Connect account created — charges not enabled yet (due: ${status.currentlyDue.join(", ") || "unknown"})`,
    };
  }
  return status;
}

/** Express Dashboard login link (post-onboarding). */
export async function createConnectLoginLink(businessId: string) {
  assertLiveStripeOrDemoAllowed("stripe connect login");
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
