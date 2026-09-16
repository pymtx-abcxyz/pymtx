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
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-2 sm:py-3">
          <Link href="/" className="text-[length:var(--text-xl)] text-text-primary" aria-label="pymtx home">
            <PymtxLogotype />
          </Link>
          <nav className="flex flex-wrap gap-1 text-[length:var(--text-sm)] font-medium text-text-secondary">
            <Link href="/legal/saas" className="rounded-md px-3 hover:bg-surface-subtle hover:text-text-primary">
              SaaS Agreement
            </Link>
            <Link href="/legal/privacy" className="rounded-md px-3 hover:bg-surface-subtle hover:text-text-primary">
              Privacy &amp; CASL
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <p className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {PROVIDER.legalName}
        </p>
        <h1 className="mt-2 font-display text-[length:var(--text-3xl)] font-bold tracking-tight text-text-primary">
          {title}
        </h1>
        <div className="mt-8">{children}</div>
      </main>
      <PortalFooter narrow>
        <div className="border-t border-border-subtle pt-6 text-text-muted">
          {PROVIDER.legalName} · {PROVIDER.addressLine} · {PROVIDER.email}
        </div>
      </PortalFooter>
    </PortalShell>
  );
}

export function LegalProse({ text }: { text: string }) {
  return (
    <pre className="whitespace-pre-wrap font-sans text-[length:var(--text-sm)] leading-relaxed text-text-secondary">
      {text}
    </pre>
  );
}
