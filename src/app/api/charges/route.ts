import { NextRequest, NextResponse } from "next/server";
import { chargeInstallment } from "@/lib/payments";

/** Manual / admin charge trigger — settlement + NSF handled inside chargeInstallment. */
export async function POST(req: NextRequest) {
  const { installmentId } = await req.json();
  if (!installmentId) {
    return NextResponse.json({ error: "installmentId required" }, { status: 400 });
  }
  try {
    const result = await chargeInstallment(installmentId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Charge failed" },
      { status: 400 },
    );
  }
}
