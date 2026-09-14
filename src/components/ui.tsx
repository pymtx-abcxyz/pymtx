import Link from "next/link";

export function PortalNav({
  portal,
  links,
}: {
  portal: "Admin" | "Business" | "Client";
  links: { href: string; label: string }[];
}) {
  return (
    <header className="portal-nav sticky top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="font-display text-xl font-bold text-ink">
            Harbor
          </Link>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-pine">
            {portal}
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-4 text-sm font-medium text-ink-soft">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-pine">
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
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        {title}
      </h1>
      {subtitle ? <p className="mt-2 max-w-2xl text-ink-soft/80">{subtitle}</p> : null}
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
    <div className="border-t border-ink/10 pt-4">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-soft/70">
        {label}
      </div>
      <div className="mt-2 font-display text-3xl font-bold text-ink">{value}</div>
      {hint ? <div className="mt-1 text-sm text-ink-soft/70">{hint}</div> : null}
    </div>
  );
}

export function formatCad(cents: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(
    cents / 100,
  );
}
