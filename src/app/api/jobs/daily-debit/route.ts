import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { runDailyDebitJob } from "@/lib/debit-job";
import { prisma } from "@/lib/db";

/**
 * Daily debit job control plane.
 * GET  — recent DebitJobRun rows
 * POST { mode: "inline" | "inngest", asOf?: ISO } — run now or enqueue
 */
export async function GET() {
  const runs = await prisma.debitJobRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 14,
  });
  return NextResponse.json({ runs });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode = (body.mode as string) || "inline";
  const asOf = body.asOf ? new Date(body.asOf) : new Date();

  try {
    if (mode === "inngest") {
      await inngest.send({
        name: "harbor/debits.run",
        data: { asOf: asOf.toISOString(), source: "api" },
      });
      return NextResponse.json({
        queued: true,
        message: "Event harbor/debits.run sent to Inngest",
      });
    }

    const result = await runDailyDebitJob(asOf);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Debit job failed" },
      { status: 400 },
    );
  }
}
