import Link from "next/link";
import { PymtxLogotype, PymtxWordmark } from "@/components/pymtx-mark";
import { PROVIDER } from "@/lib/legal";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden pymtx-atmosphere">
      <div className="absolute inset-0 pymtx-grain" aria-hidden />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <PymtxLogotype className="text-lg text-amber" />
        <nav className="flex items-center gap-3 text-sm font-medium">
          <Link
            href="/login"
            className="hidden text-sage/90 hover:text-amber sm:inline"
          >
            Sign in
          </Link>
          <Link href="/register" className="btn-ghost !py-2 !px-3 text-sm">
            Register
          </Link>
          <Link href="/login/customer" className="btn-primary !py-2 !px-3 text-sm">
            Customer
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-5.5rem)] w-full max-w-6xl flex-col justify-center px-6 pb-16 pt-4">
        <div className="animate-mark animate-drift relative w-full max-w-4xl">
          <PymtxWordmark className="h-auto w-full select-none" />
        </div>

        <h1 className="animate-rise-delay-1 mt-8 max-w-xl font-display text-2xl font-medium leading-snug text-mist sm:text-3xl">
          Past-due balances, settled directly — your business stays the creditor.
        </h1>
        <p className="animate-rise-delay-1 mt-4 max-w-lg text-base leading-relaxed text-sage/85">
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
        <p className="animate-rise-delay-2 mt-14 max-w-xl text-xs leading-relaxed text-sage/55">
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
