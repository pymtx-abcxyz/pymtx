"use client";

import { useEffect, useState } from "react";
import { PortalNav, SectionHeading } from "@/components/ui";

type Business = {
  id: string;
  tradeName: string;
  legalName: string;
  email: string;
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
};

export default function BusinessSettingsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [form, setForm] = useState({
    legalName: "",
    tradeName: "",
    email: "",
    phone: "",
    ontarioCorpNumber: "",
    caslConsent: true,
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/businesses")
      .then((r) => r.json())
      .then(setBusinesses);
  }, []);

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
    setMessage(`Registered ${data.tradeName}. Next: connect Stripe on the dashboard.`);
    setBusinesses((prev) => [data, ...prev]);
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
          title="Register your Ontario business"
          subtitle="You remain the legal creditor and Merchant of Record. Harbor is the software layer only."
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
              <span className="mb-1 block font-semibold text-ink-soft">{label}</span>
              <input
                className="input"
                required={key !== "phone" && key !== "ontarioCorpNumber"}
                type={key === "email" ? "email" : "text"}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <label className="flex items-start gap-2 text-sm text-ink-soft">
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

        {message ? (
          <p className="mt-6 border-l-2 border-pine bg-mist/60 px-4 py-3 text-sm">{message}</p>
        ) : null}

        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold">Registered businesses</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {businesses.map((b) => (
              <li key={b.id} className="border-t border-ink/10 pt-3">
                <div className="font-semibold">{b.tradeName}</div>
                <div className="text-ink-soft/75">
                  {b.email} · Connect {b.stripeOnboardingComplete ? "ready" : "pending"}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
