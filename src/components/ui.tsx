import Link from "next/link";
import { PymtxLogotype } from "@/components/pymtx-mark";

export function PortalNav({
  portal,
  links,
}: {
  portal: "Admin" | "Business" | "Client";
  links: { href: string; label: string }[];
}) {
  return (
    <header className="portal-nav sticky top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <Link href="/" className="shrink-0 text-xl text-sage-bright">
            <PymtxLogotype />
          </Link>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-sage">
            {portal}
          </span>
        </div>
        <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm font-medium text-sage/80">
          {links.map((l) => (
            <Link
              key={l.href + l.label}
              href={l.href}
              className="hover:text-sage-bright"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-3xl font-bold tracking-tight text-mist sm:text-4xl">
        {title}
      </h1>
      {subtitle ? <p className="mt-2 max-w-2xl text-sage/85">{subtitle}</p> : null}
    </div>
  );
}

export function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border-t border-mist/10 pt-4">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-sage/70">
        {label}
      </div>
      <div className="mt-2 font-display text-3xl font-bold text-mist">{value}</div>
      {hint ? <div className="mt-1 text-sm text-sage/70">{hint}</div> : null}
    </div>
  );
}

export function formatCad(cents: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(
    cents / 100,
  );
}
