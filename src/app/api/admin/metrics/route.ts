import { NextRequest, NextResponse } from "next/server";
import { isAuthUser, requireUser } from "@/lib/auth";
import { UserRole } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { platformFeeBps } from "@/lib/stripe";

/** Platform metrics — ADMIN only. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req, { roles: [UserRole.ADMIN] });
  if (!isAuthUser(user)) return user;

  const settings = await prisma.platformSettings.findUnique({
    where: { id: "platform" },
  });
  const businesses = await prisma.business.count();
  const invoices = await prisma.invoice.groupBy({
    by: ["status"],
    _count: true,
    _sum: { balanceCents: true },
  });
  const metrics = await prisma.transactionMetric.aggregate({
    _sum: { principalCents: true, applicationFeeCents: true },
    _count: true,
  });
  const connectReady = await prisma.business.count({
    where: { stripeOnboardingComplete: true },
  });

  return NextResponse.json({
    settings: settings || { applicationFeeBps: platformFeeBps() },
    onboarding: {
      businesses,
      connectReady,
      connectHealthPct: businesses
        ? Math.round((connectReady / businesses) * 100)
        : 0,
    },
    invoices,
    takeRate: {
      feeBps: settings?.applicationFeeBps ?? platformFeeBps(),
      principalSettledCents: metrics._sum.principalCents || 0,
      applicationFeesCents: metrics._sum.applicationFeeCents || 0,
      transactionCount: metrics._count,
    },
  });
}
