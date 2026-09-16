import {
  PortalNav,
  PortalShell,
  PortalMain,
  PortalFooter,
  SectionHeading,
  SectionTitle,
  Metric,
  StatusPill,
  EmptyRow,
  formatCad,
} from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { UserRole } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { platformFeeBps } from "@/lib/stripe";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.ADMIN) {
    redirect(user ? "/business" : "/login?next=/admin");
  }

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
    <PortalShell>
      <PortalNav
        portal="Admin"
        links={[
          { href: "/admin", label: "Overview" },
          { href: "/business", label: "Business portal" },
          { href: "/", label: "Marketing" },
        ]}
      />
      <PortalMain>
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

        <section className="section-block">
          <SectionTitle
            title="Invoice pipeline"
            subtitle="Aging and settlement statuses across the network."
          />
          <div className="mt-6 overflow-x-auto">
            <table className="data-table min-w-[520px]">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                  <th>Open balance</th>
                </tr>
              </thead>
              <tbody>
                {invoiceGroups.map((g) => (
                  <tr key={g.status} className="table-row">
                    <td className="font-medium">{g.status}</td>
                    <td>{g._count}</td>
                    <td>{formatCad(g._sum.balanceCents || 0)}</td>
                  </tr>
                ))}
                {invoiceGroups.length === 0 ? (
                  <EmptyRow colSpan={3}>
                    No invoices yet — seed demo data or upload from the business portal.
                  </EmptyRow>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section-block">
          <SectionTitle
            title="Daily debit runs"
            subtitle="Inngest cron (America/Toronto midnight) and inline POST /api/jobs/daily-debit."
          />
          <div className="mt-6 overflow-x-auto">
            <table className="data-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Run date</th>
                  <th>Status</th>
                  <th>Scanned</th>
                  <th>OK</th>
                  <th>Failed</th>
                  <th>Skipped</th>
                </tr>
              </thead>
              <tbody>
                {debitRuns.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="font-medium">{r.runDate}</td>
                    <td>
                      <StatusPill
                        tone={
                          r.status === "SUCCEEDED"
                            ? "success"
                            : r.status === "FAILED"
                              ? "danger"
                              : r.status === "PARTIAL"
                                ? "warning"
                                : "default"
                        }
                      >
                        {r.status}
                      </StatusPill>
                    </td>
                    <td>{r.scannedCount}</td>
                    <td>{r.succeededCount}</td>
                    <td>{r.failedCount}</td>
                    <td>{r.skippedCount}</td>
                  </tr>
                ))}
                {debitRuns.length === 0 ? (
                  <EmptyRow colSpan={6}>
                    No debit job runs yet — trigger via Inngest or{" "}
                    <code className="text-xs">npm run job:daily-debit</code>.
                  </EmptyRow>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section-block">
          <SectionTitle title="Rule H1 & CDSSA posture" />
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-sage">
            <li>Zero-custody Direct Charges (`stripeAccount` on connected business) — Pymtx is not a collection agency.</li>
            <li>ACSS Debit Personal PAD with written confirmation before first debit.</li>
            <li>NSF: max 1 retry within 30 days. Skip: ≥3 business days notice, 180-day cooldown.</li>
            <li>CASL: customer invites white-labeled from the business trade name.</li>
          </ul>
        </section>

        <section className="section-block mb-4">
          <SectionTitle title="Recent businesses" />
          <div className="mt-6 overflow-x-auto">
            <table className="data-table min-w-[560px]">
              <thead>
                <tr>
                  <th>Trade name</th>
                  <th>Connect</th>
                  <th>Customers</th>
                  <th>Invoices</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((b) => (
                  <tr key={b.id} className="table-row">
                    <td className="font-medium">{b.tradeName}</td>
                    <td>
                      <StatusPill tone={b.stripeOnboardingComplete ? "success" : "warning"}>
                        {b.stripeOnboardingComplete ? "Ready" : "Pending"}
                      </StatusPill>
                    </td>
                    <td>{b._count.customers}</td>
                    <td>{b._count.invoices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </PortalMain>
      <PortalFooter />
    </PortalShell>
  );
}
