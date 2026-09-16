"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AuthAltLink,
  AuthHeading,
  AuthShell,
  FieldLabel,
  FormError,
  FormSectionLabel,
} from "@/components/ui";

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
    <AuthShell wide>
      <AuthHeading title="Create your account">
        Register as a merchant Owner to open the business portal.
      </AuthHeading>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <FormSectionLabel>Your details</FormSectionLabel>
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
        <div className="grid gap-4 sm:grid-cols-2">
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
            <FieldLabel>Confirm</FieldLabel>
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
        </div>
        <p className="text-xs text-sage/60">At least 8 characters.</p>

        <FormSectionLabel>Business</FormSectionLabel>
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
          <FieldLabel>Phone</FieldLabel>
          <input
            className="input"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <label className="block text-sm">
          <FieldLabel>Ontario corp number</FieldLabel>
          <input
            className="input"
            value={ontarioCorpNumber}
            onChange={(e) => setOntarioCorpNumber(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <label className="block text-sm">
          <FieldLabel>Physical address</FieldLabel>
          <input
            className="input"
            value={physicalAddress}
            onChange={(e) => setPhysicalAddress(e.target.value)}
            placeholder="Optional"
          />
        </label>

        <FormSectionLabel>Agreements</FormSectionLabel>
        <label className="checkbox-row">
          <input
            type="checkbox"
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
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={caslConsent}
            onChange={(e) => setCaslConsent(e.target.checked)}
            required
          />
          <span>
            I consent to CASL commercial messages sent in our trade name for
            settlement notices.
          </span>
        </label>

        <FormError>{error}</FormError>
        <button
          className="btn-primary w-full"
          type="submit"
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>

      <AuthAltLink>
        Already registered?{" "}
        <Link className="link-accent" href="/login">
          Sign in
        </Link>
      </AuthAltLink>
    </AuthShell>
  );
}
