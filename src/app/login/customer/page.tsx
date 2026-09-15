"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function CustomerLoginForm() {
  const search = useSearchParams();
  const errorParam = search.get("error");
  const [email, setEmail] = useState("aisha.rahman@example.com");
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
    <div className="portal-shell min-h-screen">
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <Link href="/" className="font-display text-2xl font-bold text-ink">
          Harbor
        </Link>
        <h1 className="mt-6 font-display text-3xl font-bold text-ink">
          Customer sign-in
        </h1>
        <p className="mt-2 text-sm text-ink-soft/80">
          Enter the email on your invite. We send a one-time magic link — no password.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink-soft">Email</span>
            <input
              className="input w-full"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          {errorHint ? <p className="text-sm text-coral">{errorHint}</p> : null}
          {message ? <p className="text-sm text-ink-soft">{message}</p> : null}
          {demoUrl ? (
            <p className="text-sm">
              <span className="font-semibold text-ink-soft">Demo link: </span>
              <a className="text-pine underline break-all" href={demoUrl}>
                Open portal
              </a>
            </p>
          ) : null}
          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Email me a sign-in link"}
          </button>
        </form>

        <p className="mt-8 text-sm text-ink-soft/70">
          Staff?{" "}
          <Link className="text-pine underline" href="/login">
            Business / admin login
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function CustomerLoginPage() {
  return (
    <Suspense fallback={<div className="portal-shell p-10 text-ink-soft">Loading…</div>}>
      <CustomerLoginForm />
    </Suspense>
  );
}
