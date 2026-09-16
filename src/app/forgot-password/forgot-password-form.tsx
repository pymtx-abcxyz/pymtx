"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  AuthAltLink,
  AuthHeading,
  AuthShell,
  FieldLabel,
  FormError,
  FormNotice,
} from "@/components/ui";

const ERROR_ID = "forgot-password-error";
const NOTICE_ID = "forgot-password-notice";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [demoUrl, setDemoUrl] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setDemoUrl("");
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Request failed");
      return;
    }
    setMessage(data.message || "Check your email for a reset link.");
    if (data.demoUrl) setDemoUrl(String(data.demoUrl));
  }

  const invalid = Boolean(error);
  const describedBy = [
    invalid ? ERROR_ID : null,
    message ? NOTICE_ID : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <AuthShell>
      <AuthHeading title="Forgot password">
        Enter your work email and we&apos;ll send a one-time reset link.
      </AuthHeading>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <div>
          <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
          <input
            id="forgot-email"
            className="input"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-invalid={invalid}
            aria-describedby={describedBy || undefined}
          />
        </div>
        <FormError id={ERROR_ID}>{error}</FormError>
        <FormNotice id={NOTICE_ID}>{message}</FormNotice>
        {demoUrl ? (
          <p className="text-[length:var(--text-sm)] text-text-secondary">
            Demo link:{" "}
            <Link className="link-accent break-all" href={demoUrl}>
              Open reset page
            </Link>
          </p>
        ) : null}
        <button
          className="btn-primary w-full"
          type="submit"
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <AuthAltLink>
        Remembered it?{" "}
        <Link className="link-accent" href="/login">
          Back to sign in
        </Link>
      </AuthAltLink>
    </AuthShell>
  );
}
