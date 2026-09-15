import { NextRequest, NextResponse } from "next/server";
import { isAuthUser, requireUser } from "@/lib/auth";
import { UserRole } from "@/lib/domain";
import { assertLiveStripeOrDemoAllowed } from "@/lib/env";
import { chargeInstallment } from "@/lib/payments";

/** Manual charge — ADMIN only. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req, { roles: [UserRole.ADMIN] });
  if (!isAuthUser(user)) return user;

  try {
    assertLiveStripeOrDemoAllowed("manual charge");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Misconfigured" },
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
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Charge failed" },
      { status: 400 },
    );
  }
}
