"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PortalNav, SectionHeading, formatCad } from "@/components/ui";
import {
  PAD_CANCELLATION_TERMS,
  PAD_RECOURSE_TERMS,
  PAD_NSF_POLICY,
} from "@/lib/compliance";

type Installment = {
  id: string;
  sequence: number;
  dueDate: string;
  amountCents: number;
  status: string;
};

type Plan = {
  id: string;
  termMonths: number;
  monthlyAmountCents: number;
  status: string;
  nextSkipAvailableAt: string | null;
  installments: Installment[];
};

type Invoice = {
  id: string;
  externalRef: string;
  description: string;
  balanceCents: number;
  status: string;
  paymentPlans: Plan[];
};

type CustomerPayload = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  inviteToken: string;
  business: { tradeName: string; legalName: string };
  invoices: Invoice[];
};

function ClientPortalInner() {
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token") || "";
  const [token, setToken] = useState(tokenParam);
  const [customer, setCustomer] = useState<CustomerPayload | null>(null);
  const [error, setError] = useState("");
  const [term, setTerm] = useState<6 | 12 | 18>(12);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [pad, setPad] = useState({
    payorName: "",
    bankLast4: "",
    institutionName: "TD Canada Trust",
    accepted: false,
  });
  const [skipInfo, setSkipInfo] = useState<{ ok: boolean; reason?: string } | null>(null);

  const invoice = customer?.invoices[0];
  const plan = invoice?.paymentPlans[0];

  async function load(t: string) {
    setError("");
    const res = await fetch(`/api/client/invite?token=${encodeURIComponent(t)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Invite not found");
      setCustomer(null);
      return;
    }
    setCustomer(data);
    setPad((p) => ({
      ...p,
      payorName: `${data.firstName} ${data.lastName}`,
    }));
  }

  useEffect(() => {
    if (tokenParam) {
      setToken(tokenParam);
      load(tokenParam);
    }
  }, [tokenParam]);

  useEffect(() => {
    if (!plan?.id || plan.status !== "ACTIVE") {
      setSkipInfo(null);
      return;
    }
    fetch(`/api/skip?paymentPlanId=${plan.id}`)
      .then((r) => r.json())
      .then(setSkipInfo);
  }, [plan?.id, plan?.status, notice]);

  const monthlyPreview = useMemo(() => {
    if (!invoice) return 0;
    return Math.ceil(invoice.balanceCents / term);
  }, [invoice, term]);

  async function startPlan() {
    if (!invoice) return;
    setBusy(true);
    setNotice("");
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        invoiceId: invoice.id,
        termMonths: term,
        startDate: new Date(Date.now() + 10 * 86400000).toISOString(),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setNotice(data.error || "Could not create plan");
      return;
    }
    setNotice(`Created ${term}-month plan. Accept the Personal PAD mandate to activate.`);
    if (token) await load(token);
  }

  async function acceptPad() {
    if (!plan || !customer || !pad.accepted) return;
    setBusy(true);
    setNotice("");
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "accept_pad",
        paymentPlanId: plan.id,
        payorName: pad.payorName,
        payorEmail: customer.email,
        bankLast4: pad.bankLast4,
        institutionName: pad.institutionName,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setNotice(data.error || "PAD acceptance failed");
      return;
    }
    setNotice(
      "PAD accepted. Written confirmation recorded before first debit (Payments Canada Rule H1).",
    );
    if (token) await load(token);
  }

  async function requestSkip() {
    if (!plan) return;
    setBusy(true);
    setNotice("");
    const res = await fetch("/api/skip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentPlanId: plan.id }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setNotice(data.error || data.reason || "Skip denied");
      return;
    }
    setNotice(
      `Payment skipped. Month moved to end of schedule (seq ${data.appendedSequence}). Next skip locked until ${new Date(data.nextSkipAvailableAt).toLocaleDateString("en-CA")}.`,
    );
    if (token) await load(token);
  }

  return (
    <div className="portal-shell">
      <PortalNav
        portal="Client"
        links={[
          { href: "/client", label: "My balance" },
          { href: "/", label: "About Harbor" },
        ]}
      />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <SectionHeading
          title="Settle on your terms"
          subtitle="Choose a plan, authorize a Personal PAD, and manage skips — communications appear from your creditor, not a collection agency."
        />

        {!customer ? (
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
              onClick={() => load(token)}
              disabled={!token}
            >
              Open my account
            </button>
            {error ? <p className="mt-3 text-sm text-coral">{error}</p> : null}
          </div>
        ) : (
          <>
            <div className="mb-10 border-t border-ink/10 pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft/70">
                Creditor (Merchant of Record)
              </p>
              <p className="mt-1 font-display text-2xl font-bold">{customer.business.tradeName}</p>
              <p className="text-sm text-ink-soft/75">
                Hello {customer.firstName} — balance for {invoice?.externalRef}
              </p>
            </div>

            {invoice ? (
              <div className="mb-10 grid gap-6 sm:grid-cols-3">
                <div className="border-t border-ink/10 pt-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft/70">
                    Balance
                  </div>
                  <div className="mt-2 font-display text-3xl font-bold">
                    {formatCad(invoice.balanceCents)}
                  </div>
                </div>
                <div className="border-t border-ink/10 pt-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft/70">
                    Description
                  </div>
                  <div className="mt-2">{invoice.description}</div>
                </div>
                <div className="border-t border-ink/10 pt-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft/70">
                    Status
                  </div>
                  <div className="mt-2 status-pill">{invoice.status}</div>
                </div>
              </div>
            ) : null}

            {notice ? (
              <p className="mb-8 border-l-2 border-pine bg-mist/60 px-4 py-3 text-sm">{notice}</p>
            ) : null}

            {!plan ? (
              <section>
                <h2 className="font-display text-2xl font-bold">Choose a plan</h2>
                <p className="mt-1 text-sm text-ink-soft/75">
                  6, 12, or 18 monthly Pre-Authorized Debits from your Canadian bank.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {([6, 12, 18] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTerm(t)}
                      className={`border px-5 py-4 text-left transition ${
                        term === t
                          ? "border-pine bg-mist"
                          : "border-ink/15 hover:border-pine/50"
                      }`}
                    >
                      <div className="font-display text-2xl font-bold">{t} mo</div>
                      <div className="mt-1 text-sm text-ink-soft">
                        ~{formatCad(Math.ceil((invoice?.balanceCents || 0) / t))}/mo
                      </div>
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-sm text-ink-soft">
                  Selected: <strong>{term} months</strong> · about{" "}
                  <strong>{formatCad(monthlyPreview)}</strong> per debit
                </p>
                <button className="btn-primary mt-6" disabled={busy} onClick={startPlan}>
                  Continue to PAD agreement
                </button>
              </section>
            ) : null}

            {plan && plan.status === "PENDING_MANDATE" ? (
              <section className="mt-10 max-w-2xl">
                <h2 className="font-display text-2xl font-bold">Personal PAD agreement</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Payments Canada Rule H1 requires an electronic Personal PAD mandate with
                  recourse and cancellation terms, plus written confirmation before the first debit.
                </p>
                <div className="mt-4 space-y-3 text-sm text-ink-soft/90">
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
                      value={pad.bankLast4}
                      onChange={(e) => setPad({ ...pad, bankLast4: e.target.value })}
                    />
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={pad.accepted}
                      onChange={(e) => setPad({ ...pad, accepted: e.target.checked })}
                    />
                    I authorize {customer.business.tradeName} to debit my account for the scheduled
                    amounts under this Personal PAD Agreement.
                  </label>
                </div>
                <button
                  className="btn-primary mt-6"
                  disabled={busy || !pad.accepted || pad.bankLast4.length !== 4}
                  onClick={acceptPad}
                >
                  Accept PAD & activate plan
                </button>
              </section>
            ) : null}

            {plan && plan.status === "ACTIVE" ? (
              <section className="mt-10">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="font-display text-2xl font-bold">
                      {plan.termMonths}-month schedule
                    </h2>
                    <p className="mt-1 text-sm text-ink-soft/75">
                      {formatCad(plan.monthlyAmountCents)} · ACSS Debit · privilege: 1 skip / 6 months
                    </p>
                  </div>
                  <button
                    className="btn-ghost"
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
                    Skips require ≥3 business days&apos; notice. Skipped month moves to the end;
                    next skip locks for 180 days.
                  </p>
                )}

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
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

export default function ClientPortalPage() {
  return (
    <Suspense fallback={<div className="portal-shell p-10">Loading client portal…</div>}>
      <ClientPortalInner />
    </Suspense>
  );
}
