"use client";

import { Suspense, useEffect, useState } from "react";
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
  LoadingScreen,
  FormError,
  FormNotice,
} from "@/components/ui";

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
    <div className="flex items-center justify-between border-t border-border-subtle py-3 text-[length:var(--text-sm)]">
      <span className="text-text-secondary">{label}</span>
      <StatusPill tone={ok ? "success" : "warning"}>{ok ? "Yes" : "No"}</StatusPill>
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
    physicalAddress: "",
    supportEmail: "",
    caslConsent: false,
    saasAgreementAccepted: false,
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
        setError(data.error || "Sync failed");
        return;
      }
      setConnect(data);
      setSelectedId(businessId);
      setNotice(
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
    setError("");
    setNotice("");
    const res = await fetch("/api/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Registration failed");
      return;
    }
    setNotice(`Registered ${data.tradeName}. Connect your Canadian bank below.`);
    setBusinesses((prev) => [data, ...prev]);
    setSelectedId(data.id);
  }

  async function startOnboarding() {
    if (!selectedId) return;
    setBusy(true);
    setError("");
    setNotice("");
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
    setConnect(data);
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    setNotice(data.message || "Connect ready (demo).");
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
    setNotice(data.message || "Express Dashboard unavailable in demo mode.");
  }

  async function inviteStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError("");
    setNotice("");
    const res = await fetch(`/api/businesses/${selectedId}/staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(staffForm),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not invite staff");
      return;
    }
    setNotice(`Invited ${data.name} as ${data.role}`);
    setStaffForm({ email: "", name: "", password: "", role: "CLERK" });
    await loadStaff(selectedId);
  }

  return (
    <PortalShell>
      <PortalNav
        portal="Business"
        links={[
          { href: "/business", label: "Dashboard" },
          { href: "/business/settings", label: "Settings" },
        ]}
      />
      <PortalMain>
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
              ["supportEmail", "Customer support email"],
              ["physicalAddress", "Ontario physical / mailing address"],
              ["phone", "Phone"],
              ["ontarioCorpNumber", "Ontario corp number"],
            ] as const
          ).map(([key, label]) => {
            const id = `settings-${key}`;
            return (
              <div key={key}>
                <FieldLabel htmlFor={id}>{label}</FieldLabel>
                <input
                  id={id}
                  className="input"
                  required={
                    key !== "phone" &&
                    key !== "ontarioCorpNumber" &&
                    key !== "supportEmail"
                  }
                  type={key === "email" || key === "supportEmail" ? "email" : "text"}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  autoComplete={
                    key === "email" || key === "supportEmail"
                      ? "email"
                      : key === "phone"
                        ? "tel"
                        : key === "legalName" || key === "tradeName"
                          ? "organization"
                          : undefined
                  }
                />
              </div>
            );
          })}
          <label className="checkbox-row" htmlFor="settings-saas">
            <input
              id="settings-saas"
              type="checkbox"
              checked={form.saasAgreementAccepted}
              onChange={(e) =>
                setForm({ ...form, saasAgreementAccepted: e.target.checked })
              }
            />
            <span>
              I accept the{" "}
              <a
                href="/legal/saas"
                target="_blank"
                rel="noreferrer"
                className="link-accent"
              >
                Master SaaS Agreement &amp; Merchant Indemnity
              </a>{" "}
              (electronic acceptance binds my business as Licensee).
            </span>
          </label>
          <label className="checkbox-row" htmlFor="settings-casl">
            <input
              id="settings-casl"
              type="checkbox"
              checked={form.caslConsent}
              onChange={(e) => setForm({ ...form, caslConsent: e.target.checked })}
            />
            <span>
              I confirm customer outreach will be sent under our business identity (CASL
              EBR / PIPEDA). See{" "}
              <a
                href="/legal/privacy"
                target="_blank"
                rel="noreferrer"
                className="link-accent"
              >
                Privacy &amp; CASL
              </a>
              .
            </span>
          </label>
          <button
            className="btn-primary w-fit"
            type="submit"
            disabled={!form.saasAgreementAccepted || !form.caslConsent}
          >
            Create business
          </button>
        </form>

        <section className="section-block max-w-xl">
          <SectionTitle
            title="Connect Canadian bank"
            subtitle="Stripe Connect Express · CA · ACSS Debit Direct Charges (zero custody)"
          />

          <div className="mt-4">
            <FieldLabel htmlFor="settings-business-select">Business</FieldLabel>
            <select
              id="settings-business-select"
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
          </div>

          {connect ? (
            <div className="mt-6">
              <Flag label="Account created" ok={!!connect.stripeAccountId} />
              <Flag label="Details submitted" ok={connect.detailsSubmitted} />
              <Flag label="Charges enabled" ok={connect.chargesEnabled} />
              <Flag label="Payouts enabled" ok={connect.payoutsEnabled} />
              <Flag label="Ready for ACSS Debit" ok={connect.readyForDebits} />
              {connect.stripeAccountId ? (
                <p className="mt-3 text-[length:var(--text-xs)] text-text-muted">
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
          <section className="section-block max-w-xl">
            <SectionTitle
              title="Team"
              subtitle="Owners manage Connect and staff. Clerks can upload invoices and view aging."
            />

            <ul className="mt-4 space-y-2 text-[length:var(--text-sm)]">
              {staff.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle py-3"
                >
                  <span>
                    <span className="font-medium text-text-primary">{s.name}</span>
                    <span className="text-text-muted"> · {s.email}</span>
                  </span>
                  <StatusPill>{s.role}</StatusPill>
                </li>
              ))}
              {staff.length === 0 ? (
                <li className="py-3 text-text-muted">No staff yet.</li>
              ) : null}
            </ul>

            <form onSubmit={inviteStaff} className="mt-6 grid gap-3">
              <div>
                <FieldLabel htmlFor="staff-name">Name</FieldLabel>
                <input
                  id="staff-name"
                  className="input"
                  required
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  autoComplete="name"
                />
              </div>
              <div>
                <FieldLabel htmlFor="staff-email">Email</FieldLabel>
                <input
                  id="staff-email"
                  className="input"
                  type="email"
                  required
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  autoComplete="email"
                />
              </div>
              <div>
                <FieldLabel htmlFor="staff-password">Temp password</FieldLabel>
                <input
                  id="staff-password"
                  className="input"
                  type="password"
                  required
                  minLength={8}
                  value={staffForm.password}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, password: e.target.value })
                  }
                  autoComplete="new-password"
                />
              </div>
              <div>
                <FieldLabel htmlFor="staff-role">Role</FieldLabel>
                <select
                  id="staff-role"
                  className="input"
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                >
                  <option value="CLERK">Clerk</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>
              <button className="btn-primary w-fit" type="submit" disabled={busy || !selectedId}>
                {busy ? "Inviting…" : "Invite staff"}
              </button>
            </form>
          </section>
        ) : null}

        {notice ? (
          <div className="mt-8">
            <FormNotice>{notice}</FormNotice>
          </div>
        ) : null}
        {error ? (
          <div className="mt-8">
            <FormError>{error}</FormError>
          </div>
        ) : null}
      </PortalMain>
      <PortalFooter />
    </PortalShell>
  );
}

export default function BusinessSettingsPage() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading settings…" />}>
      <BusinessSettingsInner />
    </Suspense>
  );
}
