import { NextRequest, NextResponse } from "next/server";
import { chargeInstallment } from "@/lib/payments";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { installmentId } = await req.json();
  if (!installmentId) {
    return NextResponse.json({ error: "installmentId required" }, { status: 400 });
  }
  try {
    const result = await chargeInstallment(installmentId);
    return NextResponse.json(result);
  } catch (e) {
    // Mark NSF failures distinctly when Stripe returns insufficient_funds
    const message = e instanceof Error ? e.message : "Charge failed";
    if (message.toLowerCase().includes("insufficient") || message.toLowerCase().includes("nsf")) {
      await prisma.installment.update({
        where: { id: installmentId },
        data: { status: "FAILED_NSF", lastAttemptAt: new Date() },
      });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
