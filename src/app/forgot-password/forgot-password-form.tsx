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

  return (
    <AuthShell>
      <AuthHeading title="Forgot password">
        Enter your work email and we&apos;ll send a one-time reset link.
      </AuthHeading>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm">
          <FieldLabel>Email</FieldLabel>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <FormError>{error}</FormError>
        <FormNotice>{message}</FormNotice>
        {demoUrl ? (
          <p className="text-sm text-sage/85">
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
