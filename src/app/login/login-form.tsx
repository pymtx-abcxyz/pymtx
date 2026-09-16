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

const ERROR_ID = "login-form-error";

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

  const invalid = Boolean(error);

  return (
    <AuthShell>
      <AuthHeading title="Sign in">
        Owners, clerks, and platform admins. Customers use{" "}
        <Link className="link-accent" href="/login/customer">
          magic-link sign-in
        </Link>
        .
      </AuthHeading>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <div>
          <FieldLabel htmlFor="login-email">Email</FieldLabel>
          <input
            id="login-email"
            className="input"
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-invalid={invalid}
            aria-describedby={invalid ? ERROR_ID : undefined}
          />
        </div>
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-3">
            <FieldLabel htmlFor="login-password" className="!mb-0">
              Password
            </FieldLabel>
            <Link
              className="text-[length:var(--text-xs)] font-medium text-text-secondary underline-offset-2 hover:text-text-primary hover:underline"
              href="/forgot-password"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            className="input"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-invalid={invalid}
            aria-describedby={invalid ? ERROR_ID : undefined}
          />
        </div>
        <FormError id={ERROR_ID}>{error}</FormError>
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
        <div className="mt-8 border-t border-border-subtle pt-6 text-[length:var(--text-xs)] leading-relaxed text-text-muted">
          <p className="font-semibold text-text-secondary">Demo accounts</p>
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
