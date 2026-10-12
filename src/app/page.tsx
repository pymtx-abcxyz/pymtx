import Link from "next/link";
import { LandingNav } from "@/components/landing-nav";
import { PymtxLogotype } from "@/components/pymtx-mark";
import { PROVIDER } from "@/lib/legal";

/**
 * Swiss Design landing — one composition:
 * brand (hero), headline, support, CTAs, full-bleed geometric plane.
 */
export default function HomePage() {
  return (
    <main className="swiss-landing relative min-h-screen overflow-x-hidden pb-[max(2rem,env(safe-area-inset-bottom))]">
      <LandingNav />

      <section className="relative z-10 mx-auto grid min-h-[calc(100dvh-4.5rem)] w-full max-w-6xl grid-cols-1 lg:grid-cols-12 lg:gap-0">
        <div className="flex flex-col justify-center px-4 py-10 sm:px-6 lg:col-span-6 lg:py-16 lg:pr-10">
          <p className="animate-rise swiss-kicker font-display text-[length:var(--text-display)] leading-none text-text-primary">
            <PymtxLogotype />
          </p>

          <div className="animate-rise-delay-1 swiss-rule mt-8" aria-hidden />

          <h1 className="animate-rise-delay-1 mt-6 max-w-md font-sans text-[length:var(--text-2xl)] font-bold leading-[1.12] tracking-tight text-text-primary sm:text-[length:var(--text-3xl)]">
            Past-due balances, settled directly — your business stays the
            creditor.
          </h1>
          <p className="animate-rise-delay-2 mt-4 max-w-sm font-sans text-[length:var(--text-base)] font-normal leading-relaxed text-text-secondary">
            Zero-custody AR for Ontario SMBs. Customers choose a PAD plan;
            funds go straight to your bank.
          </p>

          <div className="animate-rise-delay-2 mt-8 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap">
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
        </div>

        {/* Full-bleed geometric plane — settlement flow as visual anchor */}
        <div
          className="animate-swiss-plane relative min-h-[42vh] lg:col-span-6 lg:min-h-0"
          aria-hidden
        >
          <div className="swiss-plane absolute inset-0 lg:inset-y-0 lg:right-0 lg:left-0">
            <div className="swiss-plane-grid" />
            <div className="swiss-plane-block swiss-plane-block-a" />
            <div className="swiss-plane-block swiss-plane-block-b" />
            <div className="swiss-plane-block swiss-plane-block-c" />
            <svg
              className="swiss-flow"
              viewBox="0 0 320 400"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>Direct settlement path</title>
              <text
                x="24"
                y="48"
                className="swiss-flow-label"
                fontFamily="var(--font-monotype), monospace"
                fontSize="11"
              >
                DEBTOR
              </text>
              <rect x="24" y="60" width="88" height="40" rx="2" className="swiss-flow-node" />
              <path
                d="M112 80 H168"
                className="swiss-flow-path"
                strokeWidth="2"
              />
              <text
                x="176"
                y="48"
                className="swiss-flow-label"
                fontFamily="var(--font-monotype), monospace"
                fontSize="11"
              >
                PAD / ACSS
              </text>
              <rect x="176" y="60" width="100" height="40" rx="2" className="swiss-flow-node" />
              <path
                d="M226 100 V160 H120"
                className="swiss-flow-path"
                strokeWidth="2"
              />
              <text
                x="24"
                y="188"
                className="swiss-flow-label"
                fontFamily="var(--font-monotype), monospace"
                fontSize="11"
              >
                MERCHANT BANK
              </text>
              <rect x="24" y="200" width="140" height="48" rx="2" className="swiss-flow-node swiss-flow-node-accent" />
              <text
                x="24"
                y="288"
                className="swiss-flow-label"
                fontFamily="var(--font-monotype), monospace"
                fontSize="11"
              >
                FEE ONLY → {PROVIDER.brand}
              </text>
              <rect x="24" y="300" width="100" height="36" rx="2" className="swiss-flow-node-muted" />
              <path
                d="M94 248 V300"
                className="swiss-flow-path-muted"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            </svg>
          </div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="swiss-rule pt-0" />
        <p className="mt-5 max-w-xl font-sans text-[length:var(--text-xs)] font-normal leading-relaxed text-text-muted">
          {PROVIDER.brand} · {PROVIDER.email} ·{" "}
          <Link href="/legal/saas" className="link-accent">
            SaaS Agreement
          </Link>{" "}
          ·{" "}
          <Link href="/legal/privacy" className="link-accent">
            Privacy &amp; CASL
          </Link>
        </p>
      </footer>
    </main>
  );
}
