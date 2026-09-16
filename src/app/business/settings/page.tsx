"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PortalNav, SectionHeading } from "@/components/ui";

type Business = {
  id: string;
  tradeName: string;
  legalName: string;
  email: string;
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
};

type StaffMember = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
};

type ConnectStatus = {
  businessId: string;
  stripeAccountId: string | null;
  onboardingComplete: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  readyForDebits: boolean;
  demo: boolean;
  url?: string | null;
  message?: string;
};

function Flag({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between border-t border-mist/10 py-3 text-sm">
      <span className="text-sage">{label}</span>
      <span className={ok ? "font-semibold text-success" : "font-semibold text-warning"}>
        {ok ? "Yes" : "No"}
      </span>
    </div>
  );
}

function BusinessSettingsInner() {
  const searchParams = useSearchParams();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [connect, setConnect] = useState<ConnectStatus | null>(null);
  const [form, setForm] = useState({
    legalName: "",
    tradeName: "",
    email: "",
    phone: "",
    ontarioCorpNumber: "",
    caslConsent: true,
  });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffForm, setStaffForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "CLERK",
  });
  const [canManageTeam, setCanManageTeam] = useState(false);

  async function loadSessionRole() {
    const res = await fetch("/api/auth");
    if (!res.ok) return;
    const data = await res.json();
    const role = data.user?.role as string;
    setCanManageTeam(role === "ADMIN" || role === "OWNER" || role === "BUSINESS");
  }

  async function loadBusinesses() {
    const res = await fetch("/api/businesses");
    const data = await res.json();
    setBusinesses(data);
    if (data[0] && !selectedId) setSelectedId(data[0].id);
  }

  async function loadConnect(businessId: string) {
    const res = await fetch(`/api/stripe/connect?businessId=${businessId}`);
    if (res.ok) setConnect(await res.json());
  }

  async function loadStaff(businessId: string) {
    const res = await fetch(`/api/businesses/${businessId}/staff`);
    if (res.ok) setStaff(await res.json());
    else setStaff([]);
  }

  useEffect(() => {
    loadSessionRole();
    loadBusinesses();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadConnect(selectedId);
      if (canManageTeam) loadStaff(selectedId);
    }
  }, [selectedId, canManageTeam]);

  useEffect(() => {
    const stripeParam = searchParams.get("stripe");
    const businessId = searchParams.get("businessId") || selectedId;
    if (!stripeParam || !businessId) return;

    (async () => {
      setBusy(true);
      const res = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, action: "sync" }),
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        setMessage(data.error || "Sync failed");
        return;
      }
      setConnect(data);
      setSelectedId(businessId);
      setMessage(
        stripeParam === "return"
          ? data.readyForDebits
            ? "Bank connected. You are Merchant of Record — ready for ACSS Debit."
            : "Returned from Stripe. Complete any remaining requirements to enable charges."
          : "Onboarding link refreshed. Click Start Connect onboarding to continue.",
      );
      await loadBusinesses();
    })();
  }, [searchParams, selectedId]);

  async function register(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Registration failed");
      return;
    }
    setMessage(`Registered ${data.tradeName}. Connect your Canadian bank below.`);
    setBusinesses((prev) => [data, ...prev]);
    setSelectedId(data.id);
  }

  async function startOnboarding() {
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
    setConnect(data);
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    setMessage(data.message || "Connect ready (demo).");
    await loadBusinesses();
  }

  async function openExpressDashboard() {
    if (!selectedId) return;
    setBusy(true);
    const res = await fetch("/api/stripe/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId: selectedId, action: "login" }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    setMessage(data.message || "Express Dashboard unavailable in demo mode.");
  }

  async function inviteStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/businesses/${selectedId}/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(staffForm),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Could not invite staff");
      return;
    }
    setMessage(`Invited ${data.name} as ${data.role}`);
    setStaffForm({ email: "", name: "", password: "", role: "CLERK" });
    await loadStaff(selectedId);
  }

  return (
    <div className="portal-shell">
      <PortalNav
        portal="Business"
        links={[
          { href: "/business", label: "Dashboard" },
          { href: "/business/settings", label: "Settings" },
        ]}
      />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <SectionHeading
          title="Stripe Connect onboarding"
          subtitle="Connect a Canadian bank. You remain Merchant of Record — Pymtx never holds principal. Debits run as Direct Charges with an application fee only."
        />

        <form onSubmit={register} className="grid max-w-xl gap-4">
          {(
            [
              ["legalName", "Legal name"],
              ["tradeName", "Trade name (CASL from-name)"],
              ["email", "Billing email"],
              ["phone", "Phone"],
              ["ontarioCorpNumber", "Ontario corp number"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="mb-1 block font-semibold text-sage">{label}</span>
              <input
                className="input"
                required={key !== "phone" && key !== "ontarioCorpNumber"}
                type={key === "email" ? "email" : "text"}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="flex items-start gap-2 text-sm text-sage">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.caslConsent}
              onChange={(e) => setForm({ ...form, caslConsent: e.target.checked })}
            />
            I confirm customer outreach will be sent under our business identity (CASL).
          </label>
          <button className="btn-primary w-fit" type="submit">
            Create business
          </button>
        </form>

        <section className="mt-14 max-w-xl">
          <h2 className="font-display text-2xl font-bold">Connect Canadian bank</h2>
          <p className="mt-1 text-sm text-sage/75">
            Stripe Connect Express · CA · ACSS Debit Direct Charges (zero custody)
          </p>

          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-semibold text-sage">Business</span>
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

          {connect ? (
            <div className="mt-6">
              <Flag label="Account created" ok={!!connect.stripeAccountId} />
              <Flag label="Details submitted" ok={connect.detailsSubmitted} />
              <Flag label="Charges enabled" ok={connect.chargesEnabled} />
              <Flag label="Payouts enabled" ok={connect.payoutsEnabled} />
              <Flag label="Ready for ACSS Debit" ok={connect.readyForDebits} />
              {connect.stripeAccountId ? (
                <p className="mt-3 text-xs text-sage/70">
                  Connected account: {connect.stripeAccountId}
                  {connect.demo ? " (demo)" : ""}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="btn-primary"
              type="button"
              disabled={busy || !selectedId}
              onClick={startOnboarding}
            >
              {connect?.readyForDebits ? "Reconnect / update" : "Start Connect onboarding"}
            </button>
            <button
              className="btn-ghost"
              type="button"
              disabled={busy || !connect?.readyForDebits}
              onClick={openExpressDashboard}
            >
              Express Dashboard
            </button>
          </div>
        </section>

        {canManageTeam ? (
          <section className="mt-14 max-w-xl">
            <h2 className="font-display text-2xl font-bold">Team</h2>
            <p className="mt-1 text-sm text-sage/75">
              Owners manage Connect and staff. Clerks can upload invoices and view aging.
            </p>

            <ul className="mt-4 space-y-2 text-sm">
              {staff.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-mist/10 py-3"
                >
                  <span>
                    <span className="font-medium text-mist">{s.name}</span>
                    <span className="text-sage/70"> · {s.email}</span>
                  </span>
                  <span className="status-pill">{s.role}</span>
                </li>
              ))}
              {staff.length === 0 ? (
                <li className="py-3 text-sage/70">No staff yet.</li>
              ) : null}
            </ul>

            <form onSubmit={inviteStaff} className="mt-6 grid gap-3">
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-sage">Name</span>
                <input
                  className="input"
                  required
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-sage">Email</span>
                <input
                  className="input"
                  type="email"
                  required
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-sage">Temp password</span>
                <input
                  className="input"
                  type="password"
                  required
                  minLength={8}
                  value={staffForm.password}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, password: e.target.value })
                  }
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-semibold text-sage">Role</span>
                <select
                  className="input"
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                >
                  <option value="CLERK">Clerk</option>
                  <option value="OWNER">Owner</option>
                </select>
              </label>
              <button className="btn-primary w-fit" type="submit" disabled={busy || !selectedId}>
                {busy ? "Inviting…" : "Invite staff"}
              </button>
            </form>
          </section>
        ) : null}

        {message ? (
          <p className="notice mt-8">{message}</p>
        ) : null}
      </main>
    </div>
  );
}

export default function BusinessSettingsPage() {
  return (
    <Suspense fallback={<div className="portal-shell p-10">Loading settings…</div>}>
      <BusinessSettingsInner />
    </Suspense>
  );
}
