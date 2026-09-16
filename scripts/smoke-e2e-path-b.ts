/**
 * Path B end-to-end smoke against a deployed environment (default: https://pymtx.com).
 *
 * Flow: health → owner login → provision_test Connect → upload invoice →
 * checkout create_plan → accept_pad (ACSS test bank) → admin daily-debit.
 *
 * If the Stripe platform has not completed Connect signup, the smoke still
 * verifies fail-closed checkout and exits 2 (blocked) instead of 1 (failed).
 *
 *   BASE_URL=https://pymtx.com npm run smoke:e2e
 */
const BASE = (process.env.BASE_URL || "https://pymtx.com").replace(/\/$/, "");
const OWNER_EMAIL =
  process.env.SMOKE_OWNER_EMAIL || "billing@mapleridgedental.example";
const OWNER_PASSWORD =
  process.env.SMOKE_OWNER_PASSWORD || "pymtx-business-demo";
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || "admin@pymtx.example";
const ADMIN_PASSWORD =
  process.env.SMOKE_ADMIN_PASSWORD || "pymtx-admin-demo";

/** Stripe ACSS Debit test numbers (CA). */
const TEST_BANK = {
  transitNumber: "11000",
  institutionNumber: "000",
  accountNumber: "000123456789",
  bankLast4: "6789",
  institutionName: "Stripe Test Bank",
};

type Json = Record<string, unknown>;

class Api {
  cookie = "";

  async req(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; json: Json; raw: string }> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (this.cookie) headers.Cookie = this.cookie;
    let payload: string | undefined;
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(body);
    }
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: payload,
      redirect: "manual",
    });
    const setCookie = res.headers.getSetCookie?.() || [];
    for (const c of setCookie) {
      const part = c.split(";")[0];
      if (part?.startsWith("pymtx_session=")) this.cookie = part;
    }
    const sc = res.headers.get("set-cookie");
    if (sc && sc.includes("pymtx_session=")) {
      this.cookie = sc.split(";")[0]!;
    }
    const raw = await res.text();
    let json: Json = {};
    try {
      json = raw ? (JSON.parse(raw) as Json) : {};
    } catch {
      json = { raw };
    }
    return { status: res.status, json, raw };
  }
}

function ok(step: string, cond: unknown, detail?: unknown): asserts cond {
  if (!cond) {
    console.error(`FAIL ${step}`, detail ?? "");
    throw new Error(`Smoke failed at: ${step}`);
  }
  console.log(`ok  ${step}`, detail ?? "");
}

function isConnectSignupError(msg: unknown) {
  return /signed up for Connect/i.test(String(msg || ""));
}

async function main() {
  console.log("Path B E2E smoke →", BASE);
  const owner = new Api();
  const admin = new Api();

  // 1. Rails
  const health = await owner.req("GET", "/api/health");
  ok("health", health.status === 200 && health.json.ok === true, health.json.rails);
  const rails = health.json.rails as Json;
  ok("money rails ready", rails.readyForMoneyRails === true, rails);

  // 2. Owner login + business
  const login = await owner.req("POST", "/api/auth", {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  ok("owner login", login.status === 200 && (login.json.user as Json)?.role === "OWNER");

  const businesses = await owner.req("GET", "/api/businesses");
  ok("list businesses", businesses.status === 200 && Array.isArray(businesses.json));
  const biz = (businesses.json as unknown as Json[])[0];
  ok("business present", biz?.id, biz?.tradeName);
  const businessId = String(biz.id);

  // 3. Admin stripe-setup (Connect platform probe when deployed)
  const adminLogin = await admin.req("POST", "/api/auth", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  ok("admin login", adminLogin.status === 200);
  const stripeSetup = await admin.req("GET", "/api/admin/stripe-setup");
  ok("stripe-setup", stripeSetup.status === 200, {
    mode: stripeSetup.json.mode,
    connectPlatform: stripeSetup.json.connectPlatform,
    webhookConfigured: stripeSetup.json.webhookConfigured,
  });

  // 4. Provision test Connect
  const provision = await owner.req("POST", "/api/stripe/connect", {
    businessId,
    action: "provision_test",
  });
  const connectBlocked =
    provision.status !== 200 ||
    provision.json.readyForDebits !== true ||
    isConnectSignupError(provision.json.error);

  if (connectBlocked) {
    ok(
      "connect blocked (expected until platform profile)",
      isConnectSignupError(provision.json.error) ||
        stripeSetup.json.connectPlatform === "not_registered",
      provision.json,
    );

    // Fail-closed path: upload still works; checkout refuses plan without Connect.
    const stamp = Date.now().toString(36);
    const email = `smoke.${stamp}@example.com`;
    const upload = await owner.req(
      "POST",
      `/api/businesses/${businessId}/invoices/upload`,
      {
        invoices: [
          {
            externalRef: `SMOKE-${stamp}`,
            description: "Path B E2E smoke (fail-closed)",
            amountCents: 12_000,
            dueDate: "2026-08-01",
            customer: {
              firstName: "Smoke",
              lastName: "Tester",
              email,
              phone: "+1-416-555-0199",
            },
          },
        ],
      },
    );
    ok("upload invoice", upload.status === 200 || upload.status === 201, upload.json);
    const items = (upload.json.items as Json[]) || [];
    ok("upload item", items.length >= 1);
    const invoiceId = String(items[0]!.invoiceId);
    const inviteToken = String(items[0]!.inviteToken);

    const preview = await owner.req(
      "GET",
      `/api/checkout?token=${encodeURIComponent(inviteToken)}`,
    );
    ok("checkout preview", preview.status === 200, {
      connectReady: preview.json.connectReady,
    });
    ok("connectReady false", preview.json.connectReady === false);

    const planRes = await owner.req("POST", "/api/checkout", {
      action: "create_plan",
      token: inviteToken,
      invoiceId,
      termMonths: 6,
    });
    ok(
      "create_plan refused without Connect",
      planRes.status >= 400,
      planRes.json,
    );
    ok(
      "create_plan error mentions Connect/onboarding",
      /connect|onboard/i.test(String(planRes.json.error || "")),
      planRes.json.error,
    );

    // Daily debit control plane still reachable under money rails.
    const debit = await admin.req("POST", "/api/jobs/daily-debit", {
      mode: "inline",
      asOf: new Date().toISOString(),
    });
    ok("daily-debit job runs", debit.status === 200 && debit.json.status === "SUCCEEDED", {
      scanned: debit.json.scannedCount,
      skipped: debit.json.skippedCount,
      succeeded: debit.json.succeededCount,
      error: debit.json.error,
    });

    console.log("\nPath B E2E smoke BLOCKED on Stripe Connect platform signup");
    console.log(
      "Action: open https://dashboard.stripe.com/test/connect → Get started / complete platform profile,",
      "then re-run: npm run smoke:e2e",
    );
    process.exit(2);
  }

  ok(
    "provision_test",
    provision.status === 200 && provision.json.readyForDebits === true,
    {
      account: provision.json.stripeAccountId,
      charges: provision.json.chargesEnabled,
    },
  );
  ok(
    "real connect account",
    typeof provision.json.stripeAccountId === "string" &&
      !String(provision.json.stripeAccountId).startsWith("acct_demo_"),
  );

  // 5. Upload + checkout + PAD + debit
  const stamp = Date.now().toString(36);
  const email = `smoke.${stamp}@example.com`;
  const externalRef = `SMOKE-${stamp}`;
  const upload = await owner.req(
    "POST",
    `/api/businesses/${businessId}/invoices/upload`,
    {
      invoices: [
        {
          externalRef,
          description: "Path B E2E smoke invoice",
          amountCents: 12_000,
          dueDate: "2026-08-01",
          customer: {
            firstName: "Smoke",
            lastName: "Tester",
            email,
            phone: "+1-416-555-0199",
          },
        },
      ],
    },
  );
  ok("upload invoice", upload.status === 200 || upload.status === 201, upload.json);
  const items = (upload.json.items as Json[]) || [];
  ok("upload item", items.length >= 1, upload.json);
  const invoiceId = String(items[0]!.invoiceId);
  const inviteToken = String(items[0]!.inviteToken);

  const preview = await owner.req(
    "GET",
    `/api/checkout?token=${encodeURIComponent(inviteToken)}`,
  );
  ok("checkout preview", preview.status === 200 && preview.json.connectReady === true);

  const planRes = await owner.req("POST", "/api/checkout", {
    action: "create_plan",
    token: inviteToken,
    invoiceId,
    termMonths: 6,
  });
  ok("create_plan", planRes.status === 201 || planRes.status === 200, planRes.json);
  const planId = String(planRes.json.id);
  ok("plan pending mandate", planRes.json.status === "PENDING_MANDATE");

  const pad = await owner.req("POST", "/api/checkout", {
    action: "accept_pad",
    token: inviteToken,
    paymentPlanId: planId,
    payorName: "Smoke Tester",
    payorEmail: email,
    bankLast4: TEST_BANK.bankLast4,
    institutionName: TEST_BANK.institutionName,
    transitNumber: TEST_BANK.transitNumber,
    institutionNumber: TEST_BANK.institutionNumber,
    accountNumber: TEST_BANK.accountNumber,
  });
  ok("accept_pad", pad.status === 200 && pad.json.status === "ACTIVE", pad.json);

  const status = await owner.req("POST", "/api/checkout", {
    action: "status",
    token: inviteToken,
  });
  ok("checkout status", status.status === 200);

  const debit = await admin.req("POST", "/api/jobs/daily-debit", {
    mode: "inline",
    asOf: new Date().toISOString(),
  });
  ok("daily-debit job", debit.status === 200 && debit.json.status === "SUCCEEDED", {
    scanned: debit.json.scannedCount,
    skipped: debit.json.skippedCount,
    succeeded: debit.json.succeededCount,
    errors: debit.json.errors,
  });

  console.log("\nPath B E2E smoke PASSED");
  console.log(
    JSON.stringify(
      {
        businessId,
        connectAccount: provision.json.stripeAccountId,
        invoiceId,
        planId,
        customerEmail: email,
        debit: {
          scanned: debit.json.scannedCount,
          succeeded: debit.json.succeededCount,
          skipped: debit.json.skippedCount,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
