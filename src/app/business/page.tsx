"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PortalNav,
  PortalShell,
  PortalMain,
  PortalFooter,
  SectionHeading,
  SectionTitle,
  Metric,
  StatusPill,
  EmptyRow,
  FieldLabel,
  LoadingScreen,
  FormError,
  FormNotice,
  formatCad,
} from "@/components/ui";
import { OnboardingChecklist } from "@/components/onboarding-checklist";

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "OWNER" | "CLERK" | "BUSINESS";
  businessId: string | null;
};

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
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    inviteToken: string;
  };
};

const CSV_TEMPLATE = `external_ref,description,amount,due_date,first_name,last_name,email,phone
INV-9001,Hygiene balance,850.00,2026-06-01,Nora,Singh,nora.singh@example.com,+1-416-555-0199
INV-9002,Crown residual,2400.50,2026-05-15,Marcus,Lee,marcus.lee@example.com,`;

export default function BusinessPortalPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading business…" />}>
      <BusinessPortalInner />
    </Suspense>
  );
}

function BusinessPortalInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";
  const fileRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function clearFeedback() {
    setError("");
    setNotice("");
  }

  async function loadSession() {
    const res = await fetch("/api/auth");
    if (!res.ok) {
      router.replace("/login?next=/business");
      return null;
    }
    const data = await res.json();
    setUser(data.user);
    return data.user as AuthUser;
  }

  async function loadBusinesses() {
    const res = await fetch("/api/businesses");
    if (res.status === 401) {
      router.replace("/login?next=/business");
      return;
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      setError(data.error || "Could not load businesses");
      return;
    }
    setBusinesses(data);
    if (data[0] && !selectedId) setSelectedId(data[0].id);
  }

  async function loadInvoices(businessId: string) {
    const res = await fetch(`/api/businesses/${businessId}/invoices`);
    if (res.ok) setInvoices(await res.json());
  }

  useEffect(() => {
    loadSession().then((u) => {
      if (u) loadBusinesses();
    });
  }, []);

  useEffect(() => {
    if (selectedId) loadInvoices(selectedId);
  }, [selectedId]);

  const selected = businesses.find((b) => b.id === selectedId);
  const isStaff =
    user?.role === "OWNER" ||
    user?.role === "CLERK" ||
    user?.role === "BUSINESS";
  const canConnect =
    user?.role === "ADMIN" ||
    user?.role === "OWNER" ||
    user?.role === "BUSINESS";
  const inviteHref = invoices[0]?.customer.inviteToken
    ? `/client?token=${invoices[0].customer.inviteToken}`
    : null;

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
  }

  async function connectStripe() {
    if (!selectedId) return;
    setBusy(true);
    clearFeedback();
    const res = await fetch("/api/stripe/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: selectedId, action: "onboard" }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Connect failed");
      return;
    }
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    setNotice(
      data.message ||
        (data.readyForDebits
          ? `Demo Connect ready: ${data.stripeAccountId}. You are Merchant of Record.`
          : "Connect onboarding started."),
    );
    await loadBusinesses();
  }

  async function onCsvSelected(file: File | null) {
    if (!file || !selectedId) return;
    setBusy(true);
    clearFeedback();
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/businesses/${selectedId}/invoices/upload`, {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (!res.ok) {
      setError(data.error || "CSV upload failed");
      return;
    }
    const first = data.items?.[0];
    setNotice(
      `Uploaded ${data.uploaded} invoice(s)` +
        (first
          ? ` — e.g. ${first.externalRef} invited from ${first.caslFrom} (token ${first.inviteToken})`
          : "") +
        (data.errors?.length ? ` · ${data.errors.length} row error(s)` : ""),
    );
    await loadInvoices(selectedId);
    await loadBusinesses();
  }

  async function uploadSample() {
    if (!selectedId) return;
    setBusy(true);
    clearFeedback();
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
      setError(data.error || "Upload failed");
      return;
    }
    const invite = data.items?.[0];
    setNotice(
      `Uploaded & invited via CASL white-label from ${invite?.caslFrom}. Client token: ${invite?.inviteToken}`,
    );
    await loadInvoices(selectedId);
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pymtx-invoice-upload-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PortalShell>
      <PortalNav
        portal="Business"
        links={[
          { href: "/business", label: "Dashboard" },
          { href: "/business/settings", label: "Settings" },
        ]}
        actions={
          user ? (
            <button
              className="btn-ghost !px-3 !py-2 text-[length:var(--text-sm)]"
              type="button"
              onClick={logout}
            >
              Sign out
            </button>
          ) : null
        }
      />
      <PortalMain>
        <SectionHeading
          title="Your receivables, your bank"
          subtitle={
            user?.role === "CLERK"
              ? "Upload past-due accounts and track aging. Connect and staff settings are owner-only."
              : "Connect a Canadian bank with Stripe, upload past-due accounts by CSV, and track aging — principal never routes through Pymtx."
          }
        />

        {selected ? (
          <OnboardingChecklist
            businessId={selected.id}
            stripeOnboardingComplete={selected.stripeOnboardingComplete}
            invoiceCount={invoices.length}
            inviteHref={inviteHref}
            canConnect={canConnect}
            busy={busy}
            welcome={welcome}
            onConnect={connectStripe}
            onUploadSample={uploadSample}
            onOpenCsvPicker={() => fileRef.current?.click()}
          />
        ) : null}

        <div className="mb-8 flex flex-wrap items-end gap-3 sm:gap-4">
          <div className="block min-w-[min(100%,15rem)] flex-1">
            <FieldLabel htmlFor="business-select">Business</FieldLabel>
            <select
              id="business-select"
              className="input"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={!!isStaff}
              aria-busy={busy}
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.tradeName}
                </option>
              ))}
            </select>
          </div>
          {canConnect ? (
            <button
              className="btn-primary"
              disabled={busy || !selectedId}
              onClick={connectStripe}
              type="button"
            >
              {selected?.stripeOnboardingComplete
                ? "Reconnect bank"
                : "Connect Canadian bank"}
            </button>
          ) : null}
          <button
            className="btn-ghost"
            disabled={busy || !selectedId}
            onClick={uploadSample}
            type="button"
          >
            Quick sample invite
          </button>
          <button className="btn-ghost" type="button" onClick={downloadTemplate}>
            CSV template
          </button>
          <label
            className="btn-ghost cursor-pointer"
            htmlFor="business-csv-upload"
          >
            {busy ? "Uploading…" : "Upload CSV"}
          </label>
          <input
            id="business-csv-upload"
            ref={fileRef}
            className="sr-only"
            type="file"
            accept=".csv,text/csv"
            disabled={busy || !selectedId}
            onChange={(e) => onCsvSelected(e.target.files?.[0] || null)}
          />
        </div>

        {selected ? (
          <div className="mb-10 grid gap-6 sm:grid-cols-3">
            <Metric
              label="Merchant of Record"
              value={selected.legalName}
              size="md"
            />
            <div className="metric-tile">
              <div className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.12em] text-text-muted">
                Stripe Connect
              </div>
              <div className="mt-2 font-medium">
                {selected.stripeOnboardingComplete ? (
                  <StatusPill tone="success">
                    Ready · {selected.stripeAccountId}
                  </StatusPill>
                ) : (
                  <StatusPill tone="warning">Onboarding required</StatusPill>
                )}
              </div>
            </div>
            <Metric
              label="Settlement rail"
              value="ACSS Debit (PAD / EFT)"
              size="md"
            />
          </div>
        ) : null}

        {notice ? (
          <div className="mb-8">
            <FormNotice>{notice}</FormNotice>
          </div>
        ) : null}
        {error ? (
          <div className="mb-8">
            <FormError>{error}</FormError>
          </div>
        ) : null}

        <SectionTitle
          title="Aging & settlement"
          subtitle="CSV columns: external_ref, description, amount (CAD dollars or cents), due_date, first_name, last_name, email, phone."
        />
        <div className="mt-4 overflow-x-auto">
          <table className="data-table min-w-[720px]">
            <caption className="sr-only">
              Past-due invoices and customer invite links
            </caption>
            <thead>
              <tr>
                <th scope="col">Ref</th>
                <th scope="col">Customer</th>
                <th scope="col">Aging</th>
                <th scope="col">Balance</th>
                <th scope="col">Status</th>
                <th scope="col">Invite</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="table-row">
                  <td className="font-medium">{inv.externalRef}</td>
                  <td>
                    {inv.customer.firstName} {inv.customer.lastName}
                  </td>
                  <td>{inv.agingBucket}</td>
                  <td>{formatCad(inv.balanceCents)}</td>
                  <td>
                    <StatusPill
                      tone={
                        inv.status === "SETTLED"
                          ? "success"
                          : inv.status === "PLAN_ACTIVE"
                            ? "success"
                            : inv.status === "WRITTEN_OFF"
                              ? "danger"
                              : inv.status === "PAST_DUE"
                                ? "warning"
                                : "default"
                      }
                    >
                      {inv.status}
                    </StatusPill>
                  </td>
                  <td>
                    <a
                      className="link-accent"
                      href={`/client?token=${inv.customer.inviteToken}`}
                    >
                      Open invite
                      <span className="sr-only">
                        {" "}
                        for {inv.customer.firstName} {inv.customer.lastName}
                      </span>
                    </a>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 ? (
                <EmptyRow colSpan={6}>
                  No invoices yet — upload a CSV or send a sample invite.
                </EmptyRow>
              ) : null}
            </tbody>
          </table>
        </div>
      </PortalMain>
      <PortalFooter />
    </PortalShell>
  );
}
