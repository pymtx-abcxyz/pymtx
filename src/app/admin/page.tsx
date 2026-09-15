import { PortalNav, SectionHeading, Metric, formatCad } from "@/components/ui";
import { prisma } from "@/lib/db";
import { platformFeeBps } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const settings = await prisma.platformSettings.findUnique({ where: { id: "platform" } });
  const businesses = await prisma.business.count();
  const connectReady = await prisma.business.count({ where: { stripeOnboardingComplete: true } });
  const invoiceGroups = await prisma.invoice.groupBy({
    by: ["status"],
    _count: true,
    _sum: { balanceCents: true },
  });
  const metrics = await prisma.transactionMetric.aggregate({
    _sum: { principalCents: true, applicationFeeCents: true },
    _count: true,
  });
  const recent = await prisma.business.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { invoices: true, customers: true } } },
  });
  const debitRuns = await prisma.debitJobRun.findMany({
    take: 7,
    orderBy: { startedAt: "desc" },
  });

  const feeBps = settings?.applicationFeeBps ?? platformFeeBps();
  const health = businesses ? Math.round((connectReady / businesses) * 100) : 0;

  return (
    <div className="portal-shell">
      <PortalNav
        portal="Admin"
        links={[
          { href: "/admin", label: "Overview" },
          { href: "/business", label: "Business portal" },
          { href: "/", label: "Marketing" },
        ]}
      />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <SectionHeading
          title="Platform control"
          subtitle="Path B compliance posture: Pymtx collects only application fees. Principal settles on connected accounts via Direct Charges."
        />

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Take-rate" value={`${(feeBps / 100).toFixed(2)}%`} hint="application_fee_amount" />
          <Metric label="Onboarding health" value={`${health}%`} hint={`${connectReady}/${businesses} Connect-ready`} />
          <Metric
            label="Principal settled"
            value={formatCad(metrics._sum.principalCents || 0)}
            hint={`${metrics._count} settled debits`}
          />
          <Metric
            label="Software fees"
            value={formatCad(metrics._sum.applicationFeeCents || 0)}
            hint="Never touches debt principal"
          />
        </div>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold text-ink">Invoice pipeline</h2>
          <p className="mt-1 text-sm text-ink-soft/75">Aging and settlement statuses across the network.</p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.1em] text-ink-soft/60">
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Count</th>
                  <th className="pb-3 font-semibold">Open balance</th>
                </tr>
              </thead>
              <tbody>
                {invoiceGroups.map((g) => (
                  <tr key={g.status} className="table-row">
                    <td className="py-3 font-medium">{g.status}</td>
                    <td className="py-3">{g._count}</td>
                    <td className="py-3">{formatCad(g._sum.balanceCents || 0)}</td>
                  </tr>
                ))}
                {invoiceGroups.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-ink-soft/70">
                      No invoices yet — seed demo data or upload from the business portal.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold text-ink">Daily debit runs</h2>
          <p className="mt-1 text-sm text-ink-soft/75">
            Inngest cron (America/Toronto midnight) and inline{" "}
            <code className="text-xs">POST /api/jobs/daily-debit</code>.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.1em] text-ink-soft/60">
                  <th className="pb-3 font-semibold">Run date</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Scanned</th>
                  <th className="pb-3 font-semibold">OK</th>
                  <th className="pb-3 font-semibold">Failed</th>
                  <th className="pb-3 font-semibold">Skipped</th>
                </tr>
              </thead>
              <tbody>
                {debitRuns.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="py-3 font-medium">{r.runDate}</td>
                    <td className="py-3">
                      <span className="status-pill">{r.status}</span>
                    </td>
                    <td className="py-3">{r.scannedCount}</td>
                    <td className="py-3">{r.succeededCount}</td>
                    <td className="py-3">{r.failedCount}</td>
                    <td className="py-3">{r.skippedCount}</td>
                  </tr>
                ))}
                {debitRuns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-ink-soft/70">
                      No debit job runs yet — trigger via Inngest or{" "}
                      <code className="text-xs">npm run job:daily-debit</code>.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-14">
          <h2 className="font-display text-2xl font-bold text-ink">Rule H1 & CDSSA posture</h2>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink-soft">
            <li>Zero-custody Direct Charges (`stripeAccount` on connected business) — Pymtx is not a collection agency.</li>
            <li>ACSS Debit Personal PAD with written confirmation before first debit.</li>
            <li>NSF: max 1 retry within 30 days. Skip: ≥3 business days notice, 180-day cooldown.</li>
            <li>CASL: customer invites white-labeled from the business trade name.</li>
          </ul>
        </section>

        <section className="mt-14 mb-10">
          <h2 className="font-display text-2xl font-bold text-ink">Recent businesses</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.1em] text-ink-soft/60">
                  <th className="pb-3 font-semibold">Trade name</th>
                  <th className="pb-3 font-semibold">Connect</th>
                  <th className="pb-3 font-semibold">Customers</th>
                  <th className="pb-3 font-semibold">Invoices</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((b) => (
                  <tr key={b.id} className="table-row">
                    <td className="py-3 font-medium">{b.tradeName}</td>
                    <td className="py-3">
                      <span className="status-pill">
                        {b.stripeOnboardingComplete ? "Ready" : "Pending"}
                      </span>
                    </td>
                    <td className="py-3">{b._count.customers}</td>
                    <td className="py-3">{b._count.invoices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
