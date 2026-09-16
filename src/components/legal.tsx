import Link from "next/link";
import { PymtxLogotype } from "@/components/pymtx-mark";
import { PortalFooter, PortalShell } from "@/components/ui";
import { PROVIDER } from "@/lib/legal";

export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <PortalShell>
      <header className="portal-nav sticky top-0 z-20">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="text-xl text-amber">
            <PymtxLogotype />
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm font-medium text-sage/80">
            <Link href="/legal/saas" className="hover:text-amber">
              SaaS Agreement
            </Link>
            <Link href="/legal/privacy" className="hover:text-amber">
              Privacy &amp; CASL
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage">
          {PROVIDER.legalName}
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-mist sm:text-4xl">
          {title}
        </h1>
        <div className="mt-8">{children}</div>
      </main>
      <PortalFooter narrow>
        <div className="border-t border-mist/10 pt-6 text-sage/60">
          {PROVIDER.legalName} · {PROVIDER.addressLine} · {PROVIDER.email}
        </div>
      </PortalFooter>
    </PortalShell>
  );
}

export function LegalProse({ text }: { text: string }) {
  return (
    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-sage/90">
      {text}
    </pre>
  );
}
