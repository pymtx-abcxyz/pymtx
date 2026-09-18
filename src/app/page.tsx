import Link from "next/link";
import { LandingNav } from "@/components/landing-nav";
import { PROVIDER } from "@/lib/legal";

export default function HomePage() {
  return (
    <main
      className="relative min-h-screen overflow-x-hidden pymtx-atmosphere"
      style={{
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="absolute inset-0 pymtx-grain" aria-hidden />

      <LandingNav />

      <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-4.5rem)] w-full max-w-6xl flex-col justify-center px-4 pb-12 pt-8 sm:px-6 sm:pb-16">
        <h1 className="animate-rise max-w-xl font-sans text-[length:var(--text-3xl)] font-bold leading-[1.15] tracking-tight text-text-primary sm:text-[length:var(--text-display)]">
          Past-due balances, settled directly — your business stays the creditor.
        </h1>
        <p className="animate-rise-delay-1 mt-4 max-w-lg font-sans text-[length:var(--text-base)] font-normal leading-relaxed text-text-secondary">
          Zero-custody AR for Ontario SMBs. Customers choose a PAD plan; funds go
          straight to your bank. pymtx never holds the debt.
        </p>

        <div className="animate-rise-delay-2 mt-8 flex w-full max-w-md flex-col gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:flex-wrap">
          <Link
            href="/register"
            className="btn-primary w-full min-h-[44px] font-semibold sm:w-auto"
          >
            Create merchant account
          </Link>
          <Link
            href="/login/customer"
            className="btn-ghost w-full min-h-[44px] font-semibold sm:w-auto"
          >
            Settle as a customer
          </Link>
        </div>

        <p className="animate-rise-delay-2 mt-5 max-w-xl font-sans text-[length:var(--text-xs)] font-normal leading-relaxed text-text-muted">
          Bank-grade security · Zero-custody settlement · PAD compliant
        </p>
      </section>

      <footer className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-2 pt-2 sm:px-6">
        <div className="border-t border-border-subtle pt-6">
          <p className="max-w-xl font-sans text-[length:var(--text-xs)] font-normal leading-relaxed text-text-muted">
            Technology by {PROVIDER.legalName} ·{" "}
            <Link href="/legal/saas" className="link-accent">
              SaaS Agreement
            </Link>{" "}
            ·{" "}
            <Link href="/legal/privacy" className="link-accent">
              Privacy &amp; CASL
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
