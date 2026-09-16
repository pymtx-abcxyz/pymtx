"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AuthAltLink,
  AuthHeading,
  AuthShell,
  FieldLabel,
  FormError,
  FormNotice,
} from "@/components/ui";

export default function ResetPasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Missing reset token. Request a new link.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Reset failed");
      return;
    }
    setMessage(data.message || "Password updated.");
    setTimeout(() => {
      router.replace("/login");
      router.refresh();
    }, 1200);
  }

  return (
    <AuthShell>
      <AuthHeading title="Choose a new password">
        Enter a new password for your pymtx portal account.
      </AuthHeading>

      {!token ? (
        <p className="mt-8 text-sm text-coral" role="alert">
          This reset link is missing a token.{" "}
          <Link className="link-accent" href="/forgot-password">
            Request a new one
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm">
            <FieldLabel>New password</FieldLabel>
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
          <p className="text-xs text-sage/60">At least 8 characters.</p>
          <FormError>{error}</FormError>
          <FormNotice>{message}</FormNotice>
          <button
            className="btn-primary w-full"
            type="submit"
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      )}

      <AuthAltLink>
        <Link className="link-accent" href="/login">
          Back to sign in
        </Link>
      </AuthAltLink>
    </AuthShell>
  );
}
