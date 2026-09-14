import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden harbor-atmosphere">
      <div className="absolute inset-0 harbor-grain" aria-hidden />

      {/* Full-bleed visual plane: abstracted Ontario shoreline / payment flow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <svg
          className="absolute right-[-8%] top-[8%] h-[70vh] w-[70vw] opacity-90 animate-drift"
          viewBox="0 0 800 600"
          fill="none"
        >
          <defs>
            <linearGradient id="water" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1b6b5a" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#102a2a" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <path
            className="draw-path"
            d="M40 320 C160 220, 260 420, 400 300 S640 180, 760 280"
            stroke="url(#water)"
            strokeWidth="3"
            fill="none"
          />
          <path
            d="M60 380 C200 300, 280 460, 420 360 S660 250, 780 340"
            stroke="#c4a35a"
            strokeOpacity="0.45"
            strokeWidth="2"
            fill="none"
          />
          <circle cx="400" cy="300" r="92" fill="#1b6b5a" fillOpacity="0.12" />
          <circle cx="400" cy="300" r="54" fill="#102a2a" fillOpacity="0.18" />
        </svg>
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="font-display text-2xl font-extrabold tracking-tight text-ink">Harbor</div>
        <nav className="flex items-center gap-3 text-sm font-medium">
          <Link href="/admin" className="hidden sm:inline text-ink-soft hover:text-pine">
            Admin
          </Link>
          <Link href="/business" className="btn-ghost !py-2 !px-3 text-sm">
            Business
          </Link>
          <Link href="/client" className="btn-primary !py-2 !px-3 text-sm">
            Client portal
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-5.5rem)] w-full max-w-6xl flex-col justify-center px-6 pb-20 pt-8">
        <p className="animate-rise font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-ink sm:text-7xl md:text-8xl">
          Harbor
        </p>
        <h1 className="animate-rise-delay-1 mt-6 max-w-xl text-2xl font-medium leading-snug text-ink-soft sm:text-3xl">
          Past-due balances, settled directly — your business stays the creditor.
        </h1>
        <p className="animate-rise-delay-1 mt-4 max-w-lg text-base leading-relaxed text-ink-soft/80">
          Zero-custody AR settlement for Ontario SMBs. Customers choose 6, 12, or 18-month PADs.
          Funds flow straight to your bank via Stripe Connect. Harbor never holds the debt.
        </p>
        <div className="animate-rise-delay-2 mt-10 flex flex-wrap gap-3">
          <Link href="/business" className="btn-primary">
            Open business portal
          </Link>
          <Link href="/client" className="btn-ghost">
            Settle as a customer
          </Link>
        </div>
      </section>
    </main>
  );
}
