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

const ERROR_ID = "register-form-error";

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
    router.replace("/business?welcome=1");
    router.refresh();
  }

  const invalid = Boolean(error);
  const describedBy = invalid ? ERROR_ID : undefined;

  return (
    <AuthShell wide>
      <AuthHeading title="Create your account">
        Register as a merchant Owner to open the business portal.
      </AuthHeading>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <FormSectionLabel>Your details</FormSectionLabel>
        <div>
          <FieldLabel htmlFor="register-name">Your name</FieldLabel>
          <input
            id="register-name"
            className="input"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            aria-invalid={invalid}
            aria-describedby={describedBy}
          />
        </div>
        <div>
          <FieldLabel htmlFor="register-email">Work email</FieldLabel>
          <input
            id="register-email"
            className="input"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-invalid={invalid}
            aria-describedby={describedBy}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="register-password">Password</FieldLabel>
            <input
              id="register-password"
              className="input"
              type="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
              aria-invalid={invalid}
              aria-describedby={
                invalid ? `${ERROR_ID} register-password-hint` : "register-password-hint"
              }
            />
          </div>
          <div>
            <FieldLabel htmlFor="register-confirm">Confirm</FieldLabel>
            <input
              id="register-confirm"
              className="input"
              type="password"
              name="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
              aria-invalid={invalid}
              aria-describedby={describedBy}
            />
          </div>
        </div>
        <p
          id="register-password-hint"
          className="text-[length:var(--text-xs)] text-text-muted"
        >
          At least 8 characters.
        </p>

        <FormSectionLabel>Business</FormSectionLabel>
        <div>
          <FieldLabel htmlFor="register-legal-name">Legal name</FieldLabel>
          <input
            id="register-legal-name"
            className="input"
            name="legalName"
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            required
            aria-invalid={invalid}
            aria-describedby={describedBy}
          />
        </div>
        <div>
          <FieldLabel htmlFor="register-trade-name">Trade name</FieldLabel>
          <input
            id="register-trade-name"
            className="input"
            name="tradeName"
            value={tradeName}
            onChange={(e) => setTradeName(e.target.value)}
            required
            aria-invalid={invalid}
            aria-describedby={describedBy}
          />
        </div>
        <div>
          <FieldLabel htmlFor="register-phone">Phone</FieldLabel>
          <input
            id="register-phone"
            className="input"
            type="tel"
            name="phone"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div>
          <FieldLabel htmlFor="register-corp">Ontario corp number</FieldLabel>
          <input
            id="register-corp"
            className="input"
            name="ontarioCorpNumber"
            value={ontarioCorpNumber}
            onChange={(e) => setOntarioCorpNumber(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div>
          <FieldLabel htmlFor="register-address">Physical address</FieldLabel>
          <input
            id="register-address"
            className="input"
            name="physicalAddress"
            value={physicalAddress}
            onChange={(e) => setPhysicalAddress(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <FormSectionLabel>Agreements</FormSectionLabel>
        <label className="checkbox-row" htmlFor="register-saas">
          <input
            id="register-saas"
            type="checkbox"
            checked={saasAgreementAccepted}
            onChange={(e) => setSaasAgreementAccepted(e.target.checked)}
            required
            aria-invalid={invalid}
          />
          <span>
            I accept the{" "}
            <Link className="link-accent" href="/legal/saas" target="_blank">
              Master SaaS Agreement &amp; Merchant Indemnity
            </Link>
            .
          </span>
        </label>
        <label className="checkbox-row" htmlFor="register-casl">
          <input
            id="register-casl"
            type="checkbox"
            checked={caslConsent}
            onChange={(e) => setCaslConsent(e.target.checked)}
            required
            aria-invalid={invalid}
          />
          <span>
            I consent to CASL commercial messages sent in our trade name for
            settlement notices.
          </span>
        </label>

        <FormError id={ERROR_ID}>{error}</FormError>
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
