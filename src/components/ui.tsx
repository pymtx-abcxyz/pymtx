import Link from "next/link";
import { PymtxLogotype } from "@/components/pymtx-mark";
import { PROVIDER } from "@/lib/legal";

export function PortalShell({
  children,
  grain = false,
}: {
  children: React.ReactNode;
  grain?: boolean;
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden portal-shell">
      {grain ? <div className="pointer-events-none absolute inset-0 pymtx-grain" aria-hidden /> : null}
      <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
    </div>
  );
}

export function AuthShell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <PortalShell grain>
      <main
        className={`mx-auto flex min-h-screen w-full flex-col justify-center px-6 py-16 ${
          wide ? "max-w-lg" : "max-w-md"
        }`}
      >
        <Link
          href="/"
          className="animate-rise text-2xl text-ash"
          aria-label="pymtx home"
        >
          <PymtxLogotype />
        </Link>
        <div className="animate-rise-delay-1 glass-panel mt-6 px-6 py-7 sm:px-7">
          {children}
        </div>
        <p className="animate-rise-delay-2 mt-10 text-xs leading-relaxed text-sage/50">
          <Link href="/legal/saas" className="link-accent">
            SaaS Agreement
          </Link>
          {" · "}
          <Link href="/legal/privacy" className="link-accent">
            Privacy &amp; CASL
          </Link>
          <span className="mt-1 block text-sage/40">{PROVIDER.legalName}</span>
        </p>
      </main>
    </PortalShell>
  );
}

export function AuthHeading({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mt-0">
      <h1 className="font-display text-3xl font-bold tracking-tight text-mist">
        {title}
      </h1>
      {children ? (
        <p className="mt-2 text-sm leading-relaxed text-sage/85">{children}</p>
      ) : null}
    </div>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="text-sm text-coral" role="alert">
      {children}
    </p>
  );
}

export function FormNotice({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="notice">{children}</p>;
}

export function AuthAltLink({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 text-sm text-sage/80">{children}</p>;
}

export function FormSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-mist/10 pt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sage/75">
        {children}
      </p>
    </div>
  );
}

export function PortalNav({
  portal,
  links,
  actions,
}: {
  portal: "Admin" | "Business" | "Client";
  links: { href: string; label: string }[];
  actions?: React.ReactNode;
}) {
  return (
    <header className="portal-nav sticky top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <Link href="/" className="shrink-0 text-xl text-ash">
            <PymtxLogotype />
          </Link>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-sage">
            {portal}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm font-medium text-sage/80">
            {links.map((l) => (
              <Link
                key={l.href + l.label}
                href={l.href}
                className="hover:text-ash"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          {actions}
        </div>
      </div>
    </header>
  );
}

export function PortalMain({
  children,
  narrow = false,
}: {
  children: React.ReactNode;
  narrow?: boolean;
}) {
  return (
    <main
      className={`mx-auto w-full flex-1 px-6 py-10 ${narrow ? "max-w-3xl" : "max-w-6xl"}`}
    >
      {children}
    </main>
  );
}

export function PortalFooter({
  narrow = false,
  children,
}: {
  narrow?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <footer
      className={`mx-auto w-full px-6 pb-10 pt-2 text-xs leading-relaxed text-sage/55 ${
        narrow ? "max-w-3xl" : "max-w-6xl"
      }`}
    >
      {children ?? (
        <div className="flex flex-col gap-2 border-t border-mist/10 pt-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <span>
            Debits settle to the merchant as Merchant of Record. {PROVIDER.legalName}{" "}
            never holds principal (Path B / zero-custody).
          </span>
          <span className="shrink-0 text-sage/65">
            {PROVIDER.legalName} · {PROVIDER.addressLine} · {PROVIDER.email}
          </span>
        </div>
      )}
    </footer>
  );
}

export function SectionHeading({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-bold tracking-tight text-mist sm:text-4xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sage/85">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  className = "",
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="font-display text-2xl font-bold text-mist">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-sage/75">{subtitle}</p> : null}
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="field-label">{children}</span>;
}

export function Metric({
  label,
  value,
  hint,
  size = "lg",
}: {
  label: string;
  value: string;
  hint?: string;
  size?: "lg" | "md";
}) {
  return (
    <div className="metric-tile">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-sage/70">
        {label}
      </div>
      <div
        className={`mt-2 font-display font-bold text-mist ${
          size === "md" ? "text-xl leading-snug" : "text-3xl"
        }`}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-sm text-sage/70">{hint}</div> : null}
    </div>
  );
}

export function StatusPill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return <span className={`status-pill status-pill-${tone}`}>{children}</span>;
}

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <PortalShell>
      <div className="flex min-h-screen items-center justify-center px-6 text-sm text-sage">
        {label}
      </div>
    </PortalShell>
  );
}

export function EmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-sage/70">
        {children}
      </td>
    </tr>
  );
}

export function formatCad(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}
