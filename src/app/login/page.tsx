"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PymtxLogotype } from "@/components/pymtx-mark";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "";
  const [email, setEmail] = useState("billing@mapleridgedental.example");
  const [password, setPassword] = useState("pymtx-business-demo");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
    }
    const role = data.user?.role as string;
    const dest =
      next ||
      (role === "ADMIN" ? "/admin" : "/business");
    router.replace(dest);
    router.refresh();
  }

  return (
    <div className="relative min-h-screen overflow-hidden portal-shell">
      <div className="absolute inset-0 pymtx-grain" aria-hidden />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <Link href="/" className="text-2xl text-sage-bright">
          <PymtxLogotype />
        </Link>
        <h1 className="mt-6 font-display text-3xl font-bold text-mist">Sign in</h1>
        <p className="mt-2 text-sm text-sage/85">
          Owners, clerks, and platform admins. Customers use{" "}
          <Link className="link-accent" href="/login/customer">
            magic-link sign-in
          </Link>
          .
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-sage">Email</span>
            <input
              className="input w-full"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-sage">Password</span>
            <input
              className="input w-full"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="text-sm text-coral">{error}</p> : null}
          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-8 border-t border-mist/10 pt-6 text-xs leading-relaxed text-sage/70">
          <p className="font-semibold text-sage">Demo accounts</p>
          <p className="mt-2">
            Owner: billing@mapleridgedental.example / pymtx-business-demo
          </p>
          <p>Clerk: clerk@mapleridgedental.example / pymtx-clerk-demo</p>
          <p>Admin: admin@pymtx.example / pymtx-admin-demo</p>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="portal-shell p-10 text-sage">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
