/**
 * Stripe go-live helper — validate keys, ensure Connect webhook, optionally push to Vercel.
 *
 *   STRIPE_SECRET_KEY=sk_… NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_… \
 *     npx tsx scripts/stripe-golive.ts [--apply-vercel] [--live-only]
 */
import { writeFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Stripe from "stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://pymtx.com";
const WEBHOOK_URL = `${APP_URL.replace(/\/$/, "")}/api/webhooks/stripe`;

const EVENTS = [
  "payment_intent.processing",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "account.updated",
] as Stripe.WebhookEndpointCreateParams.EnabledEvent[];

function modeOfSecret(k: string) {
  if (k.includes("placeholder")) return "placeholder";
  if (k.startsWith("sk_live_")) return "live";
  if (k.startsWith("sk_test_")) return "test";
  return "unknown";
}

function modeOfPub(k: string) {
  if (k.includes("placeholder")) return "placeholder";
  if (k.startsWith("pk_live_")) return "live";
  if (k.startsWith("pk_test_")) return "test";
  return "unknown";
}

function vercelSet(name: string, value: string) {
  const file = join(tmpdir(), `pymtx-env-${name}-${Date.now()}`);
  writeFileSync(file, value, { mode: 0o600 });
  try {
    try {
      execFileSync("vercel", ["env", "rm", name, "production", "--yes"], {
        stdio: "pipe",
        env: process.env,
      });
    } catch {
      /* missing is fine */
    }
    execFileSync("vercel", ["env", "add", name, "production"], {
      stdio: ["pipe", "inherit", "inherit"],
      env: process.env,
      input: value,
    });
  } finally {
    try {
      unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const applyVercel = process.argv.includes("--apply-vercel");
  const liveOnly = process.argv.includes("--live-only");

  const secret = process.env.STRIPE_SECRET_KEY?.trim() || "";
  const publishable =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ||
    process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
    "";

  if (!secret || secret.includes("placeholder")) {
    throw new Error("Set STRIPE_SECRET_KEY to sk_test_… or sk_live_… (not placeholder)");
  }
  if (!publishable || publishable.includes("placeholder")) {
    throw new Error(
      "Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to pk_test_… or pk_live_…",
    );
  }

  const secretMode = modeOfSecret(secret);
  const pubMode = modeOfPub(publishable);
  if (liveOnly && (secretMode !== "live" || pubMode !== "live")) {
    throw new Error(`--live-only requires live keys (got ${secretMode}/${pubMode})`);
  }
  if (
    (secretMode === "live" && pubMode !== "live") ||
    (secretMode === "test" && pubMode !== "test")
  ) {
    throw new Error(
      `Secret/publishable mode mismatch: secret=${secretMode} publishable=${pubMode}`,
    );
  }

  const stripe = new Stripe(secret, {
    apiVersion: undefined as unknown as Stripe.LatestApiVersion,
  });

  const account = await stripe.accounts.retrieve();
  console.log("Stripe account ok:", {
    id: account.id,
    country: account.country,
    charges_enabled: account.charges_enabled,
    mode: secretMode,
  });

  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  let endpoint = existing.data.find(
    (e) => e.url === WEBHOOK_URL && e.status === "enabled",
  );

  let webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim() || "";

  if (!endpoint) {
    endpoint = await stripe.webhookEndpoints.create({
      url: WEBHOOK_URL,
      enabled_events: EVENTS,
      connect: true,
      description: "Pymtx Path B Connect + ACSS Debit",
    });
    webhookSecret = endpoint.secret || "";
    console.log("Created Connect webhook:", endpoint.id, WEBHOOK_URL);
  } else {
    console.log("Webhook already exists:", endpoint.id, WEBHOOK_URL);
    if (!webhookSecret) {
      console.log(
        "Stripe will not re-show the signing secret. Paste it from Dashboard → Developers → Webhooks, or delete the endpoint and re-run this script.",
      );
    }
  }

  console.log("\nReady to set on Vercel production:");
  console.log(`  STRIPE_SECRET_KEY (${secretMode})`);
  console.log(`  STRIPE_PUBLISHABLE_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (${pubMode})`);
  console.log(
    webhookSecret
      ? "  STRIPE_CONNECT_WEBHOOK_SECRET + STRIPE_WEBHOOK_SECRET (new)"
      : "  STRIPE_CONNECT_WEBHOOK_SECRET (paste from Dashboard if endpoint already existed)",
  );
  console.log("  ALLOW_DEMO_MODE=false");
  console.log(
    `  REQUIRE_LIVE_STRIPE=${secretMode === "live" ? "true" : "false"}`,
  );

  if (!applyVercel) {
    console.log("\nRe-run with --apply-vercel to push these secrets (needs VERCEL_TOKEN).");
    return;
  }

  if (!process.env.VERCEL_TOKEN) {
    throw new Error("VERCEL_TOKEN required for --apply-vercel");
  }
  process.env.VERCEL_ORG_ID ||= "team_0E9QQc4gJv0zKV4Vt6OqspNy";
  process.env.VERCEL_PROJECT_ID ||= "prj_BYQ5OjJ9JmLNfRe7NJqKnaOgyf4t";

  for (const [name, value] of [
    ["STRIPE_SECRET_KEY", secret],
    ["STRIPE_PUBLISHABLE_KEY", publishable],
    ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", publishable],
    ["ALLOW_DEMO_MODE", "false"],
    ["REQUIRE_LIVE_STRIPE", secretMode === "live" ? "true" : "false"],
  ] as const) {
    console.log("Applying", name);
    vercelSet(name, value);
  }
  if (webhookSecret) {
    console.log("Applying STRIPE_CONNECT_WEBHOOK_SECRET + STRIPE_WEBHOOK_SECRET");
    vercelSet("STRIPE_CONNECT_WEBHOOK_SECRET", webhookSecret);
    vercelSet("STRIPE_WEBHOOK_SECRET", webhookSecret);
  }
  console.log("Done. Trigger a production redeploy so runtime picks up secrets.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
