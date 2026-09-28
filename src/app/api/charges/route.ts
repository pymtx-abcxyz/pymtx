import { NextRequest, NextResponse } from "next/server";
import { isAuthUser, requireUser } from "@/lib/auth";
import { UserRole } from "@/lib/domain";
import { assertMoneyRailsReady } from "@/lib/env";
import { clientIp, publicError } from "@/lib/http";
import { chargeInstallment } from "@/lib/payments";
import { rateLimit } from "@/lib/rate-limit";

/** Manual charge — ADMIN only. */
export async function POST(req: NextRequest) {
  const user = await requireUser(req, { roles: [UserRole.ADMIN] });
  if (!isAuthUser(user)) return user;

  const limited = await rateLimit({
    key: `admin-charge:${user.id}:${clientIp(req)}`,
    limit: 30,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

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
