"use client";

import { useEffect, useState } from "react";
import { PortalNav, SectionHeading, formatCad } from "@/components/ui";

type Business = {
  id: string;
  tradeName: string;
  legalName: string;
  email: string;
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
  _count?: { invoices: number; customers: number };
};

type Invoice = {
  id: string;
  externalRef: string;
  description: string;
  balanceCents: number;
  agingBucket: string;
  status: string;
  customer: { firstName: string; lastName: string; email: string; inviteToken: string };
};

export default function BusinessPortalPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function loadBusinesses() {
    const res = await fetch("/api/businesses");
    const data = await res.json();
    setBusinesses(data);
    if (data[0] && !selectedId) setSelectedId(data[0].id);
  }

  async function loadInvoices(businessId: string) {
    const res = await fetch(`/api/businesses/${businessId}/invoices`);
    if (res.ok) setInvoices(await res.json());
  }

  useEffect(() => {
    loadBusinesses();
  }, []);

  useEffect(() => {
    if (selectedId) loadInvoices(selectedId);
  }, [selectedId]);

  const selected = businesses.find((b) => b.id === selectedId);

  async function connectStripe() {
    if (!selectedId) return;
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/stripe/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: selectedId, action: "onboard" }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Connect failed");
      return;
    }
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    setMessage(
      data.message ||
        (data.readyForDebits
          ? `Demo Connect ready: ${data.stripeAccountId}. You are Merchant of Record.`
          : "Connect onboarding started."),
    );
    await loadBusinesses();
  }

  async function uploadSample() {
    if (!selectedId) return;
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/businesses", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: selectedId,
        invoices: [
          {
            externalRef: `INV-${Date.now().toString().slice(-5)}`,
            description: "Past-due consumer account",
            amountCents: 125000,
            dueDate: new Date(Date.now() - 40 * 86400000).toISOString(),
            customer: {
              firstName: "Sam",
              lastName: "Patel",
              email: `sam.patel.${Date.now()}@example.com`,
            },
          },
        ],
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Upload failed");
      return;
    }
    const invite = data.items?.[0];
    setMessage(
      `Uploaded & invited via CASL white-label from ${invite?.caslFrom}. Client link token: ${invite?.inviteToken}`,
    );
    await loadInvoices(selectedId);
  }

  return (
    <div className="portal-shell">
      <PortalNav
        portal="Business"
        links={[
          { href: "/business", label: "Dashboard" },
          { href: "/business/settings", label: "Settings" },
          { href: "/admin", label: "Admin" },
        ]}
      />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <SectionHeading
          title="Your receivables, your bank"
          subtitle="Connect a Canadian bank with Stripe, upload past-due accounts, and track aging — principal never routes through Harbor."
        />

        <div className="mb-8 flex flex-wrap items-end gap-4">
          <label className="block min-w-[240px] flex-1 text-sm">
            <span className="mb-1 block font-semibold text-ink-soft">Business</span>
            <select
              className="input"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.tradeName}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-primary" disabled={busy || !selectedId} onClick={connectStripe}>
            {selected?.stripeOnboardingComplete ? "Reconnect bank" : "Connect Canadian bank"}
          </button>
          <button className="btn-ghost" disabled={busy || !selectedId} onClick={uploadSample}>
            Upload + invite account
          </button>
        </div>

        {selected ? (
          <div className="mb-10 grid gap-6 sm:grid-cols-3">
            <div className="border-t border-ink/10 pt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft/70">
                Merchant of Record
              </div>
              <div className="mt-2 font-display text-xl font-bold">{selected.legalName}</div>
            </div>
            <div className="border-t border-ink/10 pt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft/70">
                Stripe Connect
              </div>
              <div className="mt-2 font-medium">
                {selected.stripeOnboardingComplete ? (
                  <span className="text-success">Ready · {selected.stripeAccountId}</span>
                ) : (
                  <span className="text-warning">Onboarding required</span>
                )}
              </div>
            </div>
            <div className="border-t border-ink/10 pt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft/70">
                Settlement rail
              </div>
              <div className="mt-2 font-medium">ACSS Debit (PAD / EFT)</div>
            </div>
          </div>
        ) : null}

        {message ? (
          <p className="mb-8 border-l-2 border-pine bg-mist/60 px-4 py-3 text-sm text-ink-soft">
            {message}
          </p>
        ) : null}

        <h2 className="font-display text-2xl font-bold text-ink">Aging & settlement</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.1em] text-ink-soft/60">
                <th className="pb-3 font-semibold">Ref</th>
                <th className="pb-3 font-semibold">Customer</th>
                <th className="pb-3 font-semibold">Aging</th>
                <th className="pb-3 font-semibold">Balance</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Invite</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="table-row">
                  <td className="py-3 font-medium">{inv.externalRef}</td>
                  <td className="py-3">
                    {inv.customer.firstName} {inv.customer.lastName}
                  </td>
                  <td className="py-3">{inv.agingBucket}</td>
                  <td className="py-3">{formatCad(inv.balanceCents)}</td>
                  <td className="py-3">
                    <span className="status-pill">{inv.status}</span>
                  </td>
                  <td className="py-3">
                    <a className="text-pine underline" href={`/client?token=${inv.customer.inviteToken}`}>
                      Open
                    </a>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-ink-soft/70">
                    No invoices for this business yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
