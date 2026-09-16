import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { isAuthUser, requireUser } from "@/lib/auth";
import { UserRole } from "@/lib/domain";
import {
  appUrl,
  goLiveReport,
  stripePublishableKey,
  stripeSecretKey,
  stripeSecretMode,
  stripeWebhookSecret,
} from "@/lib/env";

export const dynamic = "force-dynamic";

const WEBHOOK_PATH = "/api/webhooks/stripe";
const EVENTS = [
  "payment_intent.processing",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "account.updated",
] as Stripe.WebhookEndpointCreateParams.EnabledEvent[];

/**
 * ADMIN Stripe cutover helper.
 * GET  — account ping + publishable key (public by design) + webhook status
 * POST — ensure Connect webhook endpoint; returns signing secret only when newly created
 */
export async function GET(req: NextRequest) {
  const user = await requireUser(req, { roles: [UserRole.ADMIN] });
  if (!isAuthUser(user)) return user;

  const secret = stripeSecretKey();
  const publishable = stripePublishableKey();
  const webhookConfigured = Boolean(
    stripeWebhookSecret() && !stripeWebhookSecret().includes("placeholder"),
  );
  const report = goLiveReport();

  let account: {
    id: string;
    country: string | null;
    charges_enabled: boolean;
  } | null = null;
  let accountError: string | undefined;
  let connectPlatform: "ready" | "not_registered" | "unknown" = "unknown";
  let connectPlatformDetail: string | undefined;

  if (secret && !secret.includes("placeholder") && SK_OK(secret)) {
    try {
      const stripe = new Stripe(secret, {
        apiVersion: undefined as unknown as Stripe.LatestApiVersion,
      });
      const acct = await (
        stripe.accounts.retrieve as (id?: string) => Promise<Stripe.Account>
      )();
      account = {
        id: acct.id,
        country: acct.country ?? null,
        charges_enabled: Boolean(acct.charges_enabled),
      };
      try {
        await stripe.accounts.list({ limit: 1 });
        connectPlatform = "ready";
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/signed up for Connect/i.test(msg)) {
          connectPlatform = "not_registered";
          connectPlatformDetail =
            "Complete Connect platform profile at https://dashboard.stripe.com/test/connect";
        } else {
          connectPlatform = "unknown";
          connectPlatformDetail = msg;
        }
      }
    } catch (e) {
      accountError = e instanceof Error ? e.message : "account retrieve failed";
    }
  }

  return NextResponse.json({
    mode: stripeSecretMode(),
    publishableKey: PK_OK(publishable) ? publishable : null,
    publishableMode: report.stripePublishable,
    webhookConfigured,
    webhookUrl: `${appUrl().replace(/\/$/, "")}${WEBHOOK_PATH}`,
    account,
    accountError,
    connectPlatform,
    connectPlatformDetail,
    rails: {
      readyForMoneyRails: report.readyForMoneyRails,
      blockers: report.blockers,
    },
  });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req, { roles: [UserRole.ADMIN] });
  if (!isAuthUser(user)) return user;

  const secret = stripeSecretKey();
  if (!secret || secret.includes("placeholder") || !SK_OK(secret)) {
    return NextResponse.json(
      { error: "Stripe secret key missing or not sk_test_/sk_live_" },
      { status: 400 },
    );
  }

  const stripe = new Stripe(secret, {
    apiVersion: undefined as unknown as Stripe.LatestApiVersion,
  });
  const webhookUrl = `${appUrl().replace(/\/$/, "")}${WEBHOOK_PATH}`;

  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  let endpoint = existing.data.find(
    (e) => e.url === webhookUrl && e.status === "enabled",
  );

  let webhookSecret: string | null = null;
  let created = false;

  if (!endpoint) {
    endpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: EVENTS,
      connect: true,
      description: "Pymtx Path B Connect + ACSS Debit",
    });
    webhookSecret = endpoint.secret || null;
    created = true;
  }

  return NextResponse.json({
    created,
    endpointId: endpoint.id,
    webhookUrl,
    /** Present only when Stripe just created the endpoint (shown once). */
    webhookSecret,
    publishableKey: PK_OK(stripePublishableKey())
      ? stripePublishableKey()
      : null,
    hint: webhookSecret
      ? "Set STRIPE_CONNECT_WEBHOOK_SECRET + STRIPE_WEBHOOK_SECRET on Vercel, then redeploy."
      : "Endpoint already exists — paste signing secret from Stripe Dashboard → Webhooks, or delete the endpoint and POST again.",
  });
}

function SK_OK(k: string) {
  return /^sk_(test|live)_/.test(k);
}
function PK_OK(k: string) {
  return /^pk_(test|live)_/.test(k);
}
