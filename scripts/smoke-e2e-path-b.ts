/**
 * Path B end-to-end smoke against a deployed environment (default: https://pymtx.com).
 *
 * Flow: health → owner login → provision_test Connect → upload invoice →
 * checkout create_plan → accept_pad (ACSS test bank) → admin daily-debit.
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
      if (part.startsWith("pymtx_session=")) this.cookie = part;
    }
    // Node <20 fallback
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

  // 3. Provision test Connect (replaces acct_demo_*)
  const provision = await owner.req("POST", "/api/stripe/connect", {
    businessId,
    action: "provision_test",
  });
  ok(
    "provision_test",
    provision.status === 200 && provision.json.readyForDebits === true,
    {
      account: provision.json.stripeAccountId,
      charges: provision.json.chargesEnabled,
      error: provision.json.error,
    },
  );
  ok(
    "real connect account",
    typeof provision.json.stripeAccountId === "string" &&
      !String(provision.json.stripeAccountId).startsWith("acct_demo_"),
  );

  // 4. Upload fresh invoice + customer
  const stamp = Date.now().toString(36);
  const email = `smoke.${stamp}@example.com`;
  const externalRef = `SMOKE-${stamp}`;
  const upload = await owner.req("POST", `/api/businesses/${businessId}/invoices/upload`, {
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
  });
  ok("upload invoice", upload.status === 200 || upload.status === 201, upload.json);
  const items = (upload.json.items as Json[]) || [];
  ok("upload item", items.length >= 1, upload.json);
  const invoiceId = String(items[0]!.invoiceId);
  const inviteToken = String(items[0]!.inviteToken);
  ok("invite token", inviteToken.length > 8);

  // 5. Checkout preview
  const preview = await owner.req(
    "GET",
    `/api/checkout?token=${encodeURIComponent(inviteToken)}`,
  );
  ok("checkout preview", preview.status === 200, {
    connectReady: preview.json.connectReady,
    balance: preview.json.balanceCents,
    error: preview.json.error,
  });
  ok("connectReady on preview", preview.json.connectReady === true);

  // 6. Create plan
  const planRes = await owner.req("POST", "/api/checkout", {
    action: "create_plan",
    token: inviteToken,
    invoiceId,
    termMonths: 6,
  });
  ok("create_plan", planRes.status === 201 || planRes.status === 200, planRes.json);
  const planId = String(planRes.json.id);
  ok("plan pending mandate", planRes.json.status === "PENDING_MANDATE", planRes.json.status);

  // 7. Accept PAD (ACSS test bank)
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
  ok("accept_pad", pad.status === 200, {
    status: pad.json.status,
    error: pad.json.error,
  });
  ok("plan active", pad.json.status === "ACTIVE", pad.json.status);

  // 8. Status DTO
  const status = await owner.req("POST", "/api/checkout", {
    action: "status",
    token: inviteToken,
  });
  ok("checkout status", status.status === 200);
  const inv = ((status.json.invoices as Json[]) || [])[0];
  const plan = ((inv?.paymentPlans as Json[]) || [])[0];
  ok("status shows active plan", plan?.status === "ACTIVE", plan?.status);

  // 9. Admin daily debit (may present 0 if due dates are in the future — force via asOf far future after bumping is server-side)
  const adminLogin = await admin.req("POST", "/api/auth", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  ok("admin login", adminLogin.status === 200);

  // Present job for today — first installment may be ~10d out; still assert job runs clean.
  const debit = await admin.req("POST", "/api/jobs/daily-debit", {
    mode: "inline",
    asOf: new Date().toISOString(),
  });
  ok("daily-debit job", debit.status === 200, {
    presented: debit.json.presented,
    skipped: debit.json.skipped,
    errors: debit.json.errors,
    error: debit.json.error,
  });

  // 10. Stripe setup sanity
  const stripeSetup = await admin.req("GET", "/api/admin/stripe-setup");
  ok(
    "stripe account ping",
    stripeSetup.status === 200 && stripeSetup.json.mode === "test",
    {
      webhookConfigured: stripeSetup.json.webhookConfigured,
      account: (stripeSetup.json.account as Json)?.id,
    },
  );

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
          presented: debit.json.presented,
          skipped: debit.json.skipped,
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
