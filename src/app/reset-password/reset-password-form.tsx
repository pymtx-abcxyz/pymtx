"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell, FieldLabel } from "@/components/ui";

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
      <h1 className="mt-6 font-display text-3xl font-bold text-mist">
        Choose a new password
      </h1>
      <p className="mt-2 text-sm text-sage/85">
        Enter a new password for your pymtx portal account.{" "}
        <Link className="link-accent" href="/login">
          Sign in
        </Link>
      </p>

      {!token ? (
        <p className="mt-8 text-sm text-coral">
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
          {error ? <p className="text-sm text-coral">{error}</p> : null}
          {message ? <p className="notice text-sm">{message}</p> : null}
          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
