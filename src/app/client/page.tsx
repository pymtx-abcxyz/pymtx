"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PortalNav, SectionHeading, formatCad } from "@/components/ui";
import {
  PAD_CANCELLATION_TERMS,
  PAD_NSF_POLICY,
  PAD_RECOURSE_TERMS,
} from "@/lib/compliance";

type CheckoutPreview = {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  inviteToken: string;
  invoiceId: string;
  businessTradeName: string;
  businessLegalName: string;
  connectReady: boolean;
  balanceCents: number;
  invoiceRef: string;
  description: string;
  existingPlan: {
    id: string;
    status: string;
    termMonths: number;
    monthlyAmountCents: number;
  } | null;
  terms: { months: 6 | 12 | 18; monthlyCents: number; totalCents: number }[];
};

type PlanDetail = {
  id: string;
  status: string;
  termMonths: number;
  monthlyAmountCents: number;
  startDate: string | null;
  installments: {
    id: string;
    sequence: number;
    dueDate: string;
    amountCents: number;
    status: string;
  }[];
  padMandate?: { bankLast4: string | null; institutionName: string | null } | null;
};

type Step = "review" | "plan" | "pad" | "active";

function Stepper({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "review", label: "Balance" },
    { id: "plan", label: "Plan" },
    { id: "pad", label: "PAD" },
    { id: "active", label: "Active" },
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <ol className="mb-10 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.12em]">
      {steps.map((s, i) => (
        <li
          key={s.id}
          className={`border-b-2 pb-1 ${
            i <= idx ? "border-pine text-ink" : "border-ink/10 text-ink-soft/50"
          }`}
        >
          {i + 1}. {s.label}
        </li>
      ))}
    </ol>
  );
}

function ClientCheckoutInner() {
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token") || "";
  const [token, setToken] = useState(tokenParam);
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [term, setTerm] = useState<6 | 12 | 18>(12);
  const [step, setStep] = useState<Step>("review");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pad, setPad] = useState({
    payorName: "",
    bankLast4: "",
    institutionName: "TD Canada Trust",
    transitNumber: "",
    institutionNumber: "",
    accountNumber: "",
    accepted: false,
  });
  const [skipInfo, setSkipInfo] = useState<{
    ok: boolean;
    reason?: string;
    noticeRequired?: number;
    cooldownDays?: number;
    sequence?: number;
    amountCents?: number;
  } | null>(null);

  async function loadPreview(t: string) {
    setError("");
    const res = await fetch(`/api/checkout?token=${encodeURIComponent(t)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Invite not found");
      setPreview(null);
      return;
    }
    setPreview(data);
    setPad((p) => ({ ...p, payorName: `${data.firstName} ${data.lastName}` }));

    if (data.existingPlan) {
      await loadPlanStatus(t);
    } else {
      setStep("review");
      setPlan(null);
    }
  }

  async function loadPlanStatus(t: string) {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", token: t }),
    });
    const data = await res.json();
    if (!res.ok) return;
    const existing = data.invoices?.[0]?.paymentPlans?.[0] as PlanDetail | undefined;
    if (!existing) return;
    setPlan(existing);
    if (existing.status === "ACTIVE") setStep("active");
    else if (existing.status === "PENDING_MANDATE") setStep("pad");
    else setStep("plan");
  }

  useEffect(() => {
    if (tokenParam) {
      setToken(tokenParam);
      loadPreview(tokenParam);
    }
  }, [tokenParam]);

  useEffect(() => {
    if (!plan?.id || plan.status !== "ACTIVE") {
      setSkipInfo(null);
      return;
    }
    fetch(`/api/skip?paymentPlanId=${plan.id}&token=${encodeURIComponent(token || "")}`)
      .then((r) => r.json())
      .then(setSkipInfo);
  }, [plan?.id, plan?.status, notice]);

  const selectedTerm = useMemo(
    () => preview?.terms.find((t) => t.months === term),
    [preview, term],
  );

  async function createPlan() {
    if (!preview) return;
    if (!preview.connectReady) {
      setError("Creditor bank account is not connected yet. Please try again later.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_plan",
        token,
        invoiceId: preview.invoiceId,
        termMonths: term,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not create plan");
      return;
    }
    setPlan(data);
    setStep("pad");
    setNotice("Plan created. Authorize your Personal PAD to activate.");
  }

  async function acceptPad() {
    if (!plan || !preview || !pad.accepted) return;
    setBusy(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "accept_pad",
        token,
        paymentPlanId: plan.id,
        payorName: pad.payorName,
        payorEmail: preview.email,
        bankLast4: pad.bankLast4,
        institutionName: pad.institutionName,
        transitNumber: pad.transitNumber || undefined,
        institutionNumber: pad.institutionNumber || undefined,
        accountNumber: pad.accountNumber || undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "PAD acceptance failed");
      return;
    }
    setPlan(data);
    setStep("active");
    setNotice(
      "PAD accepted. Written confirmation sent from your creditor before the first debit (Rule H1).",
    );
  }

  async function requestSkip() {
    if (!plan) return;
    setBusy(true);
    setNotice("");
    const res = await fetch("/api/skip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentPlanId: plan.id, token }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setNotice(data.error || data.reason || "Skip denied");
      return;
    }
    setNotice(
      `Payment skipped (seq ${data.skippedSequence}). Replacement scheduled as seq ${data.appendedSequence} on ${new Date(data.appendedDue).toLocaleDateString("en-CA")}. Next skip locked until ${new Date(data.nextSkipAvailableAt).toLocaleDateString("en-CA")}.`,
    );
    if (token) await loadPlanStatus(token);
  }

  return (
    <div className="portal-shell">
      <PortalNav
        portal="Client"
        links={[
          { href: "/client", label: "Checkout" },
          { href: "/", label: "About Harbor" },
        ]}
      />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <SectionHeading
          title="Settle your balance"
          subtitle="Choose a plan and authorize a Personal PAD. Communications come from your creditor — Harbor never holds your payment."
        />

        {!preview ? (
          <div className="max-w-md">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink-soft">Invite token</span>
              <input
                className="input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste invite token from email"
              />
            </label>
            <button
              className="btn-primary mt-4"
              type="button"
              onClick={() => loadPreview(token)}
              disabled={!token}
            >
              Open checkout
            </button>
            {error ? <p className="mt-3 text-sm text-coral">{error}</p> : null}
          </div>
        ) : (
          <>
            <Stepper step={step} />

            <div className="mb-8 border-t border-ink/10 pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft/70">
                Creditor (Merchant of Record)
              </p>
              <p className="mt-1 font-display text-2xl font-bold">
                {preview.businessTradeName}
              </p>
              <p className="text-sm text-ink-soft/75">
                Hi {preview.firstName} — invoice {preview.invoiceRef}
              </p>
            </div>

            {!preview.connectReady ? (
              <p className="mb-6 border-l-2 border-warning bg-mist/60 px-4 py-3 text-sm">
                Your creditor is still connecting their bank. Checkout will unlock when
                Stripe Connect is ready.
              </p>
            ) : null}

            {notice ? (
              <p className="mb-6 border-l-2 border-pine bg-mist/60 px-4 py-3 text-sm">
                {notice}
              </p>
            ) : null}
            {error ? <p className="mb-6 text-sm text-coral">{error}</p> : null}

            {(step === "review" || step === "plan") && !plan ? (
              <section>
                <div className="mb-8 grid gap-6 sm:grid-cols-2">
                  <div className="border-t border-ink/10 pt-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft/70">
                      Balance due
                    </div>
                    <div className="mt-2 font-display text-4xl font-bold">
                      {formatCad(preview.balanceCents)}
                    </div>
                  </div>
                  <div className="border-t border-ink/10 pt-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft/70">
                      For
                    </div>
                    <div className="mt-2 text-ink-soft">{preview.description}</div>
                  </div>
                </div>

                <h2 className="font-display text-2xl font-bold">Choose your plan</h2>
                <p className="mt-1 text-sm text-ink-soft/75">
                  Monthly Pre-Authorized Debits (PAD) from your Canadian bank — 6, 12, or 18
                  months. One skip every 6 months.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {preview.terms.map((t) => (
                    <button
                      key={t.months}
                      type="button"
                      onClick={() => {
                        setTerm(t.months);
                        setStep("plan");
                      }}
                      className={`border px-4 py-5 text-left transition ${
                        term === t.months
                          ? "border-pine bg-mist"
                          : "border-ink/15 hover:border-pine/40"
                      }`}
                    >
                      <div className="font-display text-2xl font-bold">{t.months} mo</div>
                      <div className="mt-2 text-sm text-ink-soft">
                        {formatCad(t.monthlyCents)}/mo
                      </div>
                      <div className="mt-1 text-xs text-ink-soft/60">
                        Total {formatCad(t.totalCents)}
                      </div>
                    </button>
                  ))}
                </div>

                <p className="mt-4 text-sm text-ink-soft">
                  Selected: <strong>{term} months</strong>
                  {selectedTerm ? (
                    <>
                      {" "}
                      · <strong>{formatCad(selectedTerm.monthlyCents)}</strong> per debit
                    </>
                  ) : null}
                </p>

                <button
                  className="btn-primary mt-6"
                  type="button"
                  disabled={busy || !preview.connectReady}
                  onClick={createPlan}
                >
                  Continue to PAD agreement
                </button>
              </section>
            ) : null}

            {step === "pad" && plan ? (
              <section>
                <h2 className="font-display text-2xl font-bold">Personal PAD agreement</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Payments Canada Rule H1 requires an electronic Personal PAD mandate with
                  recourse and cancellation terms, plus written confirmation before the first
                  debit. Debits are drawn by{" "}
                  <strong>{preview.businessTradeName}</strong> (not Harbor).
                </p>

                <div className="mt-4 space-y-3 border-t border-ink/10 pt-4 text-sm leading-relaxed text-ink-soft/90">
                  <p>{PAD_RECOURSE_TERMS}</p>
                  <p>{PAD_CANCELLATION_TERMS}</p>
                  <p>{PAD_NSF_POLICY}</p>
                </div>

                <div className="mt-6 grid gap-3">
                  <label className="text-sm">
                    <span className="mb-1 block font-semibold">Account holder name</span>
                    <input
                      className="input"
                      value={pad.payorName}
                      onChange={(e) => setPad({ ...pad, payorName: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-semibold">Institution</span>
                    <input
                      className="input"
                      value={pad.institutionName}
                      onChange={(e) => setPad({ ...pad, institutionName: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block font-semibold">Account last 4</span>
                    <input
                      className="input"
                      maxLength={4}
                      inputMode="numeric"
                      value={pad.bankLast4}
                      onChange={(e) =>
                        setPad({ ...pad, bankLast4: e.target.value.replace(/\D/g, "") })
                      }
                    />
                  </label>
                  <details className="text-sm text-ink-soft">
                    <summary className="cursor-pointer font-semibold">
                      Full bank details (required for live Stripe)
                    </summary>
                    <div className="mt-3 grid gap-3">
                      <input
                        className="input"
                        placeholder="Transit number"
                        value={pad.transitNumber}
                        onChange={(e) => setPad({ ...pad, transitNumber: e.target.value })}
                      />
                      <input
                        className="input"
                        placeholder="Institution number"
                        value={pad.institutionNumber}
                        onChange={(e) =>
                          setPad({ ...pad, institutionNumber: e.target.value })
                        }
                      />
                      <input
                        className="input"
                        placeholder="Account number"
                        value={pad.accountNumber}
                        onChange={(e) => setPad({ ...pad, accountNumber: e.target.value })}
                      />
                    </div>
                  </details>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={pad.accepted}
                      onChange={(e) => setPad({ ...pad, accepted: e.target.checked })}
                    />
                    I authorize {preview.businessTradeName} to debit my account for the
                    scheduled amounts under this Personal PAD Agreement.
                  </label>
                </div>

                <button
                  className="btn-primary mt-6"
                  type="button"
                  disabled={busy || !pad.accepted || pad.bankLast4.length !== 4}
                  onClick={acceptPad}
                >
                  Accept PAD &amp; activate plan
                </button>
              </section>
            ) : null}

            {step === "active" && plan ? (
              <section>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="font-display text-2xl font-bold">
                      {plan.termMonths}-month schedule
                    </h2>
                    <p className="mt-1 text-sm text-ink-soft/75">
                      {formatCad(plan.monthlyAmountCents)} · ACSS Debit · 1 skip / 6 months
                      {plan.padMandate?.bankLast4
                        ? ` · •••• ${plan.padMandate.bankLast4}`
                        : ""}
                    </p>
                  </div>
                  <button
                    className="btn-ghost"
                    type="button"
                    disabled={busy || !skipInfo?.ok}
                    onClick={requestSkip}
                    title={skipInfo && !skipInfo.ok ? skipInfo.reason : "Skip next payment"}
                  >
                    Skip next payment
                  </button>
                </div>
                {skipInfo && !skipInfo.ok ? (
                  <p className="mt-3 text-sm text-warning">{skipInfo.reason}</p>
                ) : (
                  <p className="mt-3 text-sm text-ink-soft/70">
                    Skips need ≥{skipInfo?.noticeRequired ?? 3} business days&apos;
                    notice
                    {skipInfo?.sequence
                      ? ` (next eligible: seq ${skipInfo.sequence})`
                      : ""}
                    . Skipped month moves to the end; next skip locks for{" "}
                    {skipInfo?.cooldownDays ?? 180} days.
                  </p>
                )}

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-[0.1em] text-ink-soft/60">
                        <th className="pb-3 font-semibold">#</th>
                        <th className="pb-3 font-semibold">Due</th>
                        <th className="pb-3 font-semibold">Amount</th>
                        <th className="pb-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.installments.map((i) => (
                        <tr key={i.id} className="table-row">
                          <td className="py-3">{i.sequence}</td>
                          <td className="py-3">
                            {new Date(i.dueDate).toLocaleDateString("en-CA")}
                          </td>
                          <td className="py-3">{formatCad(i.amountCents)}</td>
                          <td className="py-3">
                            <span className="status-pill">{i.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

export default function ClientCheckoutPage() {
  return (
    <Suspense fallback={<div className="portal-shell p-10">Loading checkout…</div>}>
      <ClientCheckoutInner />
    </Suspense>
  );
}
