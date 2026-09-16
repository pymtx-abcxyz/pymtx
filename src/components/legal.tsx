import Link from "next/link";
import { PymtxLogotype } from "@/components/pymtx-mark";
import { PROVIDER } from "@/lib/legal";

export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="portal-shell min-h-screen">
      <header className="portal-nav">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-xl text-sage-bright">
            <PymtxLogotype />
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm text-sage/80">
            <Link href="/legal/saas" className="hover:text-sage-bright">
              SaaS Agreement
            </Link>
            <Link href="/legal/privacy" className="hover:text-sage-bright">
              Privacy &amp; CASL
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage">
          {PROVIDER.legalName}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-mist">{title}</h1>
        <div className="mt-8">{children}</div>
        <p className="mt-12 text-xs leading-relaxed text-sage/60">
          {PROVIDER.legalName} · {PROVIDER.addressLine} · {PROVIDER.email}
        </p>
      </main>
    </div>
  );
}

export function LegalProse({ text }: { text: string }) {
  return (
    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-sage/90">
      {text}
    </pre>
  );
}
