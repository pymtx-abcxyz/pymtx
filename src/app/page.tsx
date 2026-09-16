import Link from "next/link";
import { PymtxLogotype } from "@/components/pymtx-mark";
import { PROVIDER } from "@/lib/legal";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden pymtx-atmosphere">
      <div className="absolute inset-0 pymtx-grain" aria-hidden />

      <header className="portal-nav sticky top-0 z-20">
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-2 sm:py-3">
          <Link
            href="/"
            className="text-[length:var(--text-xl)] text-text-primary"
            aria-label="pymtx home"
          >
            <PymtxLogotype />
          </Link>
          <nav
            className="flex flex-wrap items-center justify-end gap-3 text-[length:var(--text-sm)] font-medium"
            aria-label="Primary"
          >
            <Link
              href="/login"
              className="hidden text-text-secondary hover:text-text-primary sm:inline-flex sm:items-center"
            >
              Sign in
            </Link>
            <Link href="/register" className="btn-ghost btn-toolbar">
              Register
            </Link>
            <Link
              href="/login/customer"
              className="btn-primary btn-toolbar"
            >
              Customer
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-4.5rem)] w-full max-w-6xl flex-col justify-center px-6 pb-16 pt-8">
        <p className="animate-rise font-display text-[length:var(--text-display)] font-bold tracking-tight text-text-primary">
          pymtx
        </p>

        <h1 className="animate-rise-delay-1 mt-8 max-w-xl font-display text-[length:var(--text-3xl)] font-medium leading-snug text-text-primary">
          Past-due balances, settled directly — your business stays the creditor.
        </h1>
        <p className="animate-rise-delay-1 mt-4 max-w-lg text-[length:var(--text-base)] leading-relaxed text-text-secondary">
          Zero-custody AR for Ontario SMBs. Customers choose a PAD plan; funds go
          straight to your bank. pymtx never holds the debt.
        </p>
        <div className="animate-rise-delay-2 mt-10 flex flex-wrap gap-3">
          <Link href="/register" className="btn-primary">
            Create merchant account
          </Link>
          <Link href="/login/customer" className="btn-ghost">
            Settle as a customer
          </Link>
        </div>
        <p className="animate-rise-delay-2 mt-14 max-w-xl text-[length:var(--text-xs)] leading-relaxed text-text-muted">
          Technology by {PROVIDER.legalName} ·{" "}
          <Link href="/legal/saas" className="link-accent">
            SaaS Agreement
          </Link>{" "}
          ·{" "}
          <Link href="/legal/privacy" className="link-accent">
            Privacy &amp; CASL
          </Link>
        </p>
      </section>
    </main>
  );
}
