"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell, FieldLabel } from "@/components/ui";

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [phone, setPhone] = useState("");
  const [ontarioCorpNumber, setOntarioCorpNumber] = useState("");
  const [physicalAddress, setPhysicalAddress] = useState("");
  const [saasAgreementAccepted, setSaasAgreementAccepted] = useState(false);
  const [caslConsent, setCaslConsent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        legalName,
        tradeName,
        phone: phone || undefined,
        ontarioCorpNumber: ontarioCorpNumber || undefined,
        physicalAddress: physicalAddress || undefined,
        saasAgreementAccepted,
        caslConsent,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Registration failed");
      return;
    }
    router.replace("/business");
    router.refresh();
  }

  return (
    <AuthShell>
      <h1 className="mt-6 font-display text-3xl font-bold text-mist">
        Create your account
      </h1>
      <p className="mt-2 text-sm text-sage/85">
        Register as a merchant Owner. Already have an account?{" "}
        <Link className="link-accent" href="/login">
          Sign in
        </Link>
        .
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm">
          <FieldLabel>Your name</FieldLabel>
          <input
            className="input"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <FieldLabel>Work email</FieldLabel>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <FieldLabel>Password</FieldLabel>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <label className="block text-sm">
          <FieldLabel>Confirm password</FieldLabel>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
          />
        </label>

        <div className="border-t border-mist/10 pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage">
            Business
          </p>
        </div>

        <label className="block text-sm">
          <FieldLabel>Legal name</FieldLabel>
          <input
            className="input"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <FieldLabel>Trade name</FieldLabel>
          <input
            className="input"
            value={tradeName}
            onChange={(e) => setTradeName(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <FieldLabel>Phone (optional)</FieldLabel>
          <input
            className="input"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <FieldLabel>Ontario corp number (optional)</FieldLabel>
          <input
            className="input"
            value={ontarioCorpNumber}
            onChange={(e) => setOntarioCorpNumber(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <FieldLabel>Physical address (optional)</FieldLabel>
          <input
            className="input"
            value={physicalAddress}
            onChange={(e) => setPhysicalAddress(e.target.value)}
          />
        </label>

        <label className="flex items-start gap-3 text-sm text-sage/85">
          <input
            type="checkbox"
            className="mt-1"
            checked={saasAgreementAccepted}
            onChange={(e) => setSaasAgreementAccepted(e.target.checked)}
            required
          />
          <span>
            I accept the{" "}
            <Link className="link-accent" href="/legal/saas" target="_blank">
              Master SaaS Agreement &amp; Merchant Indemnity
            </Link>
            .
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-sage/85">
          <input
            type="checkbox"
            className="mt-1"
            checked={caslConsent}
            onChange={(e) => setCaslConsent(e.target.checked)}
            required
          />
          <span>
            I consent to CASL commercial electronic messages sent in our trade
            name for settlement notices.
          </span>
        </label>

        {error ? <p className="text-sm text-coral">{error}</p> : null}
        <button className="btn-primary w-full" type="submit" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
