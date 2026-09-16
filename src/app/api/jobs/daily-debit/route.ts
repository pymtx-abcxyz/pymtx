import { NextRequest, NextResponse } from "next/server";
import { isAuthUser, requireUser } from "@/lib/auth";
import { UserRole } from "@/lib/domain";
import { assertMoneyRailsReady } from "@/lib/env";
import { publicError } from "@/lib/http";
import { inngest } from "@/inngest/client";
import { runDailyDebitJob } from "@/lib/debit-job";
import { prisma } from "@/lib/db";

/**
 * Daily debit job control plane — ADMIN only.
 */
export async function GET(req: NextRequest) {
  const user = await requireUser(req, { roles: [UserRole.ADMIN] });
  if (!isAuthUser(user)) return user;

  const runs = await prisma.debitJobRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 14,
  });
  return NextResponse.json({ runs });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req, { roles: [UserRole.ADMIN] });
  if (!isAuthUser(user)) return user;

  try {
    assertMoneyRailsReady("daily-debit job");
  } catch {
    return NextResponse.json(
      { error: "Payment rail misconfigured" },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const mode = (body.mode as string) || "inline";
  const asOf = body.asOf ? new Date(body.asOf) : new Date();

  try {
    if (mode === "inngest") {
      await inngest.send({
        name: "pymtx/debits.run",
        data: {
          asOf: asOf.toISOString(),
          source: "api",
          actor: user.email,
        },
      });
      return NextResponse.json({
        queued: true,
        message: "Event pymtx/debits.run sent to Inngest",
      });
    }

    return NextResponse.json(await runDailyDebitJob(asOf));
  } catch (e) {
    const { error } = publicError(e, "Debit job failed");
    return NextResponse.json({ error }, { status: 400 });
  }
}
