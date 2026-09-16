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
      {grain ? (
        <div
          className="pointer-events-none absolute inset-0 pymtx-grain"
          aria-hidden
        />
      ) : null}
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
          className="animate-rise text-[length:var(--text-2xl)] font-bold text-text-primary"
          aria-label="pymtx home"
        >
          <PymtxLogotype />
        </Link>
        <div className="animate-rise-delay-1 glass-panel mt-6 px-6 py-7 sm:px-7">
          {children}
        </div>
        <p className="animate-rise-delay-2 mt-10 text-[length:var(--text-xs)] leading-relaxed text-text-muted">
          <Link href="/legal/saas" className="link-accent">
            SaaS Agreement
          </Link>
          {" · "}
          <Link href="/legal/privacy" className="link-accent">
            Privacy &amp; CASL
          </Link>
          <span className="mt-1 block text-text-muted">{PROVIDER.legalName}</span>
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
      <h1 className="font-display text-[length:var(--text-3xl)] font-bold tracking-tight text-text-primary">
        {title}
      </h1>
      {children ? (
        <p className="mt-2 text-[length:var(--text-sm)] leading-relaxed text-text-secondary">
          {children}
        </p>
      ) : null}
    </div>
  );
}

function AlertIcon({ tone }: { tone: "danger" | "info" | "warning" }) {
  const paths =
    tone === "danger"
      ? "M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
      : tone === "warning"
        ? "M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
        : "M12 16v-4m0-4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z";
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={paths} />
    </svg>
  );
}

export function FormError({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) {
  if (!children) return null;
  return (
    <p
      id={id}
      className="flex items-start gap-2 text-[length:var(--text-sm)] text-danger"
      role="alert"
    >
      <AlertIcon tone="danger" />
      <span>{children}</span>
    </p>
  );
}

export function FormNotice({
  children,
  id,
  tone = "info",
}: {
  children: React.ReactNode;
  id?: string;
  tone?: "info" | "warning";
}) {
  if (!children) return null;
  const noticeClass =
    tone === "warning" ? "notice notice-warning" : "notice";
  return (
    <div id={id} className={`${noticeClass} flex items-start gap-2`} role="status">
      <AlertIcon tone={tone === "warning" ? "warning" : "info"} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function AuthAltLink({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 text-[length:var(--text-sm)] text-text-secondary">
      {children}
    </p>
  );
}

export function FormSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-border-subtle pt-5">
      <p className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.14em] text-text-muted">
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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-2 sm:py-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-3">
          <Link
            href="/"
            className="shrink-0 text-[length:var(--text-xl)] text-text-primary"
            aria-label="pymtx home"
          >
            <PymtxLogotype />
          </Link>
          <span className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.14em] text-text-muted">
            {portal}
          </span>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-2 gap-y-1">
          <nav
            className="flex flex-wrap items-center justify-end gap-x-1 gap-y-1 text-[length:var(--text-sm)] font-medium text-text-secondary"
            aria-label={`${portal} navigation`}
          >
            {links.map((l) => (
              <Link
                key={l.href + l.label}
                href={l.href}
                className="rounded-md px-3 hover:bg-surface-subtle hover:text-text-primary"
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
      className={`mx-auto w-full px-6 pb-10 pt-2 text-[length:var(--text-xs)] leading-relaxed text-text-muted ${
        narrow ? "max-w-3xl" : "max-w-6xl"
      }`}
    >
      {children ?? (
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <span>
            Debits settle to the merchant as Merchant of Record.{" "}
            {PROVIDER.legalName} never holds principal (Path B / zero-custody).
          </span>
          <span className="shrink-0 text-text-muted">
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
        <h1 className="font-display text-[length:var(--text-3xl)] font-bold tracking-tight text-text-primary">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-[length:var(--text-base)] text-text-secondary">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>
      ) : null}
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
      <h2 className="font-display text-[length:var(--text-2xl)] font-bold text-text-primary">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1 text-[length:var(--text-sm)] text-text-muted">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function FieldLabel({
  children,
  htmlFor,
  className = "",
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  const classes = className ? `field-label ${className}` : "field-label";
  if (htmlFor) {
    return (
      <label className={classes} htmlFor={htmlFor}>
        {children}
      </label>
    );
  }
  return <span className={classes}>{children}</span>;
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
      <div className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.12em] text-text-muted">
        {label}
      </div>
      <div
        className={`mt-2 font-display font-bold text-text-primary ${
          size === "md"
            ? "text-[length:var(--text-xl)] leading-snug"
            : "text-[length:var(--text-3xl)]"
        }`}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[length:var(--text-sm)] text-text-muted">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

const STATUS_TONE_LABEL = {
  default: "Status",
  success: "Success",
  warning: "Warning",
  danger: "Error",
} as const;

function StatusIcon({
  tone,
}: {
  tone: keyof typeof STATUS_TONE_LABEL;
}) {
  if (tone === "success") {
    return (
      <svg
        className="h-3.5 w-3.5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (tone === "warning") {
    return (
      <svg
        className="h-3.5 w-3.5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      </svg>
    );
  }
  if (tone === "danger") {
    return (
      <svg
        className="h-3.5 w-3.5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6M9 9l6 6" />
      </svg>
    );
  }
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

export function StatusPill({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <span className={`status-pill status-pill-${tone}`}>
      <StatusIcon tone={tone} />
      <span className="sr-only">{STATUS_TONE_LABEL[tone]}: </span>
      <span>{children}</span>
    </span>
  );
}

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <PortalShell>
      <div
        className="flex min-h-screen items-center justify-center px-6 text-[length:var(--text-sm)] text-text-secondary"
        role="status"
        aria-live="polite"
      >
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
      <td
        colSpan={colSpan}
        className="py-8 text-[length:var(--text-sm)] text-text-muted"
      >
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
