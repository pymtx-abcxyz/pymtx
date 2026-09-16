import { NextRequest, NextResponse } from "next/server";
import { isAuthUser, requireUser } from "@/lib/auth";
import { UserRole } from "@/lib/domain";
import { assertMoneyRailsReady } from "@/lib/env";
import { publicError } from "@/lib/http";
import { chargeInstallment } from "@/lib/payments";

/** Manual charge — ADMIN only. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req, { roles: [UserRole.ADMIN] });
  if (!isAuthUser(user)) return user;

  try {
    assertMoneyRailsReady("manual charge");
  } catch {
    return NextResponse.json(
      { error: "Payment rail misconfigured" },
      { status: 503 },
    );
  }

  const { installmentId } = await req.json();
  if (!installmentId) {
    return NextResponse.json({ error: "installmentId required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await chargeInstallment(installmentId));
  } catch (e) {
    const { error } = publicError(e, "Charge failed");
    return NextResponse.json({ error }, { status: 400 });
  }
}
