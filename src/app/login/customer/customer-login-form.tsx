"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AuthShell,
  FieldLabel,
  LoadingScreen,
} from "@/components/ui";

function CustomerLoginForm({ allowDemo }: { allowDemo: boolean }) {
  const search = useSearchParams();
  const errorParam = search.get("error");
  const [email, setEmail] = useState(
    allowDemo ? "aisha.rahman@example.com" : "",
  );
  const [message, setMessage] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const errorHint =
    errorParam === "invalid_link"
      ? "That sign-in link is invalid or expired. Request a new one."
      : errorParam === "rate_limited"
        ? "Too many attempts. Wait a few minutes and try again."
        : errorParam === "missing_token"
          ? "Missing sign-in token."
          : "";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setDemoUrl("");
    const res = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Could not send link");
      return;
    }
    setMessage(data.message || "Check your email for a sign-in link.");
    if (data.demoUrl) setDemoUrl(data.demoUrl);
  }

  return (
    <AuthShell>
      <h1 className="mt-6 font-display text-3xl font-bold text-mist">
        Customer sign-in
      </h1>
      <p className="mt-2 text-sm text-sage/85">
        Enter the email on your invite. We send a one-time magic link — no password.
      </p>

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
        {errorHint ? <p className="text-sm text-coral">{errorHint}</p> : null}
        {message ? <p className="notice">{message}</p> : null}
        {demoUrl ? (
          <p className="text-sm">
            <span className="font-semibold text-sage">Demo link: </span>
            <a className="link-accent break-all" href={demoUrl}>
              Open portal
            </a>
          </p>
        ) : null}
        <button className="btn-primary w-full" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>

      <p className="mt-8 text-sm text-sage/70">
        Staff?{" "}
        <Link className="link-accent" href="/login">
          Business / admin login
        </Link>
      </p>
    </AuthShell>
  );
}

export default function CustomerLoginPage({
  allowDemo,
}: {
  allowDemo: boolean;
}) {
  return (
    <Suspense fallback={<LoadingScreen label="Loading customer sign-in…" />}>
      <CustomerLoginForm allowDemo={allowDemo} />
    </Suspense>
  );
}
