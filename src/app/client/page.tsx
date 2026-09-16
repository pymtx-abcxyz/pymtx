"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  PortalNav,
  PortalShell,
  PortalMain,
  PortalFooter,
  SectionHeading,
  SectionTitle,
  FieldLabel,
  StatusPill,
  Metric,
  LoadingScreen,
  FormError,
  FormNotice,
  formatCad,
} from "@/components/ui";
import { PAD_NSF_POLICY } from "@/lib/compliance";
import {
  PROVIDER,
  renderPadAgreement,
  renderSettlementTerms,
} from "@/lib/legal";

type CheckoutPreview = {
  customerId: string;
  firstName: string;
  lastName: string;
  email: string;
  customerAddress: string | null;
  inviteToken: string;
  invoiceId: string;
  businessTradeName: string;
  businessLegalName: string;
  businessPhysicalAddress: string | null;
  businessSupportEmail: string;
  businessPhone: string | null;
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
    <ol
      className="mb-10 flex flex-wrap gap-2 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.12em]"
      aria-label="Checkout progress"
    >
      {steps.map((s, i) => (
        <li
          key={s.id}
          aria-current={s.id === step ? "step" : undefined}
          className={`border-b-2 pb-1 ${
            i <= idx
              ? "border-action-primary text-text-primary"
              : "border-border-subtle text-text-muted"
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
    settlementAccepted: false,
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
    fetch(`/api/client/skip-payment?paymentPlanId=${plan.id}&token=${encodeURIComponent(token || "")}`)
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
    if (!plan || !preview || !pad.accepted || !pad.settlementAccepted) return;
    setBusy(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/pad-mandates/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
    const res = await fetch("/api/client/skip-payment", {
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
    <PortalShell>
      <PortalNav
        portal="Client"
        links={[
          { href: "/client", label: "Checkout" },
          { href: "/login/customer", label: "Sign in" },
          { href: "/", label: "About pymtx" },
        ]}
      />
      <PortalMain narrow>
        <SectionHeading
          title="Settle your balance"
          subtitle="Choose a plan and authorize a Personal PAD. Communications come from your creditor — 1001527397 ONTARIO INC. never holds your payment."
        />

        {!preview ? (
          <div className="max-w-md">
            <div>
              <FieldLabel htmlFor="client-invite-token">Invite token</FieldLabel>
              <input
                id="client-invite-token"
                className="input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste invite token from email"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "client-token-error" : undefined}
              />
            </div>
            <button
              className="btn-primary mt-4"
              type="button"
              onClick={() => loadPreview(token)}
              disabled={!token}
            >
              Open checkout
            </button>
            <div className="mt-3">
              <FormError id="client-token-error">{error}</FormError>
            </div>
          </div>
        ) : (
          <>
            <Stepper step={step} />

            <div className="mb-8 metric-tile">
              <p className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.12em] text-text-muted">
                Creditor (Merchant of Record)
              </p>
              <p className="mt-1 font-display text-[length:var(--text-2xl)] font-bold text-text-primary">
                {preview.businessTradeName}
              </p>
              <p className="text-[length:var(--text-sm)] text-text-secondary">
                Hi {preview.firstName} — invoice {preview.invoiceRef}
              </p>
            </div>

            {!preview.connectReady ? (
              <div className="mb-6">
                <FormNotice tone="warning">
                  Your creditor is still connecting their bank. Checkout will unlock when
                  Stripe Connect is ready.
                </FormNotice>
              </div>
            ) : null}

            {notice ? (
              <div className="mb-6">
                <FormNotice>{notice}</FormNotice>
              </div>
            ) : null}
            {error ? (
              <div className="mb-6">
                <FormError id="client-checkout-error">{error}</FormError>
              </div>
            ) : null}

            {(step === "review" || step === "plan") && !plan ? (
              <section>
                <div className="mb-8 grid gap-6 sm:grid-cols-2">
                  <Metric
                    label="Balance due"
                    value={formatCad(preview.balanceCents)}
                  />
                  <div className="metric-tile">
                    <div className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.12em] text-text-muted">
                      For
                    </div>
                    <div className="mt-2 text-text-secondary">{preview.description}</div>
                  </div>
                </div>

                <SectionTitle
                  title="Choose your plan"
                  subtitle="Monthly Pre-Authorized Debits (PAD) from your Canadian bank — 6, 12, or 18 months. One skip every 6 months."
                />

                <div className="mt-6 grid gap-3 sm:grid-cols-3" role="listbox" aria-label="Payment plan term">
                  {preview.terms.map((t) => (
                    <button
                      key={t.months}
                      type="button"
                      role="option"
                      aria-selected={term === t.months}
                      onClick={() => {
                        setTerm(t.months);
                        setStep("plan");
                      }}
                      className={`plan-option ${
                        term === t.months ? "plan-option-selected" : ""
                      }`}
                    >
                      <div className="font-display text-[length:var(--text-2xl)] font-bold text-text-primary">
                        {t.months} mo
                      </div>
                      <div className="mt-2 text-[length:var(--text-sm)] text-text-secondary">
                        {formatCad(t.monthlyCents)}/mo
                      </div>
                      <div className="mt-1 text-[length:var(--text-xs)] text-text-muted">
                        Total {formatCad(t.totalCents)}
                      </div>
                    </button>
                  ))}
                </div>

                <p className="mt-4 text-[length:var(--text-sm)] text-text-secondary">
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

            {step === "pad" && plan && preview ? (
              <section>
                <SectionTitle
                  title="Personal PAD agreement"
                  subtitle={`Payments Canada Rule H1 Personal PAD. Debits are drawn by ${preview.businessLegalName} as Merchant of Record. ${PROVIDER.legalName} is an automated technological conduit only.`}
                />

                <div className="mt-6 grid gap-3">
                  <div>
                    <FieldLabel htmlFor="pad-payor-name">Account holder name</FieldLabel>
                    <input
                      id="pad-payor-name"
                      className="input"
                      value={pad.payorName}
                      onChange={(e) => setPad({ ...pad, payorName: e.target.value })}
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="pad-institution">Institution</FieldLabel>
                    <input
                      id="pad-institution"
                      className="input"
                      value={pad.institutionName}
                      onChange={(e) => setPad({ ...pad, institutionName: e.target.value })}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="pad-last4">Account last 4</FieldLabel>
                    <input
                      id="pad-last4"
                      className="input"
                      maxLength={4}
                      inputMode="numeric"
                      value={pad.bankLast4}
                      onChange={(e) =>
                        setPad({ ...pad, bankLast4: e.target.value.replace(/\D/g, "") })
                      }
                      aria-describedby="pad-last4-hint"
                    />
                    <p id="pad-last4-hint" className="mt-1 text-[length:var(--text-xs)] text-text-muted">
                      Last four digits of the account to debit.
                    </p>
                  </div>
                  <details className="text-[length:var(--text-sm)] text-text-secondary" open>
                    <summary className="cursor-pointer font-semibold text-text-secondary">
                      Bank routing details (required for live Stripe)
                    </summary>
                    <div className="mt-3 grid gap-3">
                      <div>
                        <FieldLabel htmlFor="pad-transit">Transit number</FieldLabel>
                        <input
                          id="pad-transit"
                          className="input"
                          placeholder="5 digits"
                          value={pad.transitNumber}
                          onChange={(e) => setPad({ ...pad, transitNumber: e.target.value })}
                        />
                      </div>
                      <div>
                        <FieldLabel htmlFor="pad-fi">Institution number</FieldLabel>
                        <input
                          id="pad-fi"
                          className="input"
                          placeholder="3 digits"
                          value={pad.institutionNumber}
                          onChange={(e) =>
                            setPad({ ...pad, institutionNumber: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <FieldLabel htmlFor="pad-account">Account number</FieldLabel>
                        <input
                          id="pad-account"
                          className="input"
                          placeholder="Account number"
                          value={pad.accountNumber}
                          onChange={(e) => setPad({ ...pad, accountNumber: e.target.value })}
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </details>
                </div>

                <div className="legal-scroll mt-8">
                  <pre className="whitespace-pre-wrap font-sans">
                    {renderPadAgreement({
                      customerFullName:
                        pad.payorName || `${preview.firstName} ${preview.lastName}`,
                      customerAddress:
                        preview.customerAddress || "Ontario, Canada",
                      customerEmail: preview.email,
                      merchantLegalName: preview.businessLegalName,
                      merchantPhysicalAddress:
                        preview.businessPhysicalAddress || "Ontario, Canada",
                      merchantSupportEmail: preview.businessSupportEmail,
                      merchantPhone: preview.businessPhone || "—",
                      fiNumber: pad.institutionNumber || "—",
                      transitNumber: pad.transitNumber || "—",
                      accountLast4: pad.bankLast4 || "****",
                      totalPrincipalCad: formatCad(preview.balanceCents),
                      tenureMonths: plan.termMonths,
                      monthlyInstallmentCad: formatCad(plan.monthlyAmountCents),
                      firstDebitDate:
                        (plan.startDate && String(plan.startDate).slice(0, 10)) ||
                        new Date().toISOString().slice(0, 10),
                      dayOfMonth: "scheduled due day",
                    })}
                  </pre>
                </div>

                <div className="legal-scroll mt-4">
                  <pre className="whitespace-pre-wrap font-sans">
                    {renderSettlementTerms({
                      merchantLegalName: preview.businessLegalName,
                      customerFullName:
                        pad.payorName || `${preview.firstName} ${preview.lastName}`,
                      totalInvoiceBalanceCad: formatCad(preview.balanceCents),
                      monthlyAmountCad: formatCad(plan.monthlyAmountCents),
                      tenureMonths: plan.termMonths,
                    })}
                  </pre>
                </div>

                <p className="mt-4 text-[length:var(--text-sm)] text-text-secondary">
                  {PAD_NSF_POLICY}
                </p>

                <label className="checkbox-row mt-6" htmlFor="pad-accept">
                  <input
                    id="pad-accept"
                    type="checkbox"
                    checked={pad.accepted}
                    onChange={(e) => setPad({ ...pad, accepted: e.target.checked })}
                  />
                  <span>
                    I authorize {preview.businessLegalName} to debit my account under this
                    Personal PAD Agreement (Payments Canada Rule H1). I waive fixed-amount
                    pre-notification as described above. A confirmation PDF will be emailed
                    immediately.
                  </span>
                </label>
                <label className="checkbox-row mt-3" htmlFor="pad-settlement">
                  <input
                    id="pad-settlement"
                    type="checkbox"
                    checked={pad.settlementAccepted}
                    onChange={(e) =>
                      setPad({ ...pad, settlementAccepted: e.target.checked })
                    }
                  />
                  <span>
                    I acknowledge the Settlement Terms &amp; Cost of Credit Disclosure
                    (0% APR / $0 platform fees to me) and that {PROVIDER.legalName} owns no
                    interest in this debt.
                  </span>
                </label>

                <button
                  className="btn-primary mt-6"
                  type="button"
                  disabled={
                    busy ||
                    !pad.accepted ||
                    !pad.settlementAccepted ||
                    pad.bankLast4.length !== 4
                  }
                  onClick={acceptPad}
                >
                  Accept PAD &amp; activate plan
                </button>
              </section>
            ) : null}

            {step === "active" && plan ? (
              <section>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <SectionTitle
                    title={`${plan.termMonths}-month schedule`}
                    subtitle={`${formatCad(plan.monthlyAmountCents)} · ACSS Debit · 1 skip / 6 months${
                      plan.padMandate?.bankLast4
                        ? ` · •••• ${plan.padMandate.bankLast4}`
                        : ""
                    }`}
                  />
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
                  <div className="mt-3">
                    <FormNotice tone="warning">{skipInfo.reason}</FormNotice>
                  </div>
                ) : (
                  <p className="mt-3 text-[length:var(--text-sm)] text-text-muted">
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
                  <table className="data-table min-w-[520px]">
                    <caption className="sr-only">Installment schedule</caption>
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Due</th>
                        <th scope="col">Amount</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.installments.map((i) => (
                        <tr key={i.id} className="table-row">
                          <td>{i.sequence}</td>
                          <td>{new Date(i.dueDate).toLocaleDateString("en-CA")}</td>
                          <td>{formatCad(i.amountCents)}</td>
                          <td>
                            <StatusPill
                              tone={
                                i.status === "SUCCEEDED"
                                  ? "success"
                                  : i.status === "FAILED" || i.status === "FAILED_NSF"
                                    ? "danger"
                                    : i.status === "SKIPPED"
                                      ? "warning"
                                      : "default"
                              }
                            >
                              {i.status}
                            </StatusPill>
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
      </PortalMain>
      <PortalFooter narrow />
    </PortalShell>
  );
}

export default function ClientCheckoutPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading checkout…" />}>
      <ClientCheckoutInner />
    </Suspense>
  );
}
