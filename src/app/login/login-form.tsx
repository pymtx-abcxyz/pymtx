"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AuthAltLink,
  AuthHeading,
  AuthShell,
  FieldLabel,
  FormError,
  LoadingScreen,
} from "@/components/ui";

function LoginForm({ allowDemo }: { allowDemo: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "";
  const [email, setEmail] = useState(
    allowDemo ? "billing@mapleridgedental.example" : "",
  );
  const [password, setPassword] = useState(
    allowDemo ? "pymtx-business-demo" : "",
  );
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
    const dest = next || (role === "ADMIN" ? "/admin" : "/business");
    router.replace(dest);
    router.refresh();
  }

  return (
    <AuthShell>
      <AuthHeading title="Sign in">
        Owners, clerks, and platform admins. Customers use{" "}
        <Link className="link-accent" href="/login/customer">
          magic-link sign-in
        </Link>
        .
      </AuthHeading>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm">
          <FieldLabel>Email</FieldLabel>
          <input
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 flex items-center justify-between gap-3">
            <span className="field-label !mb-0">Password</span>
            <Link
              className="text-xs font-medium text-sage-bright underline-offset-2 hover:text-sage hover:underline"
              href="/forgot-password"
            >
              Forgot password?
            </Link>
          </span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <FormError>{error}</FormError>
        <button
          className="btn-primary w-full"
          type="submit"
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <AuthAltLink>
        New merchant?{" "}
        <Link className="link-accent" href="/register">
          Create an account
        </Link>
      </AuthAltLink>

      {allowDemo ? (
        <div className="mt-8 border-t border-mist/10 pt-6 text-xs leading-relaxed text-sage/70">
          <p className="font-semibold text-sage">Demo accounts</p>
          <p className="mt-2">
            Owner: billing@mapleridgedental.example / pymtx-business-demo
          </p>
          <p>Clerk: clerk@mapleridgedental.example / pymtx-clerk-demo</p>
          <p>Admin: admin@pymtx.example / pymtx-admin-demo</p>
        </div>
      ) : null}
    </AuthShell>
  );
}

export default function LoginPage({ allowDemo }: { allowDemo: boolean }) {
  return (
    <Suspense fallback={<LoadingScreen label="Loading sign-in…" />}>
      <LoginForm allowDemo={allowDemo} />
    </Suspense>
  );
}
