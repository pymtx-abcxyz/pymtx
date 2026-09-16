import { NextRequest, NextResponse } from "next/server";
import { isAuthUser, requireUser } from "@/lib/auth";
import { UserRole } from "@/lib/domain";
import { goLiveReport } from "@/lib/env";

/** Go-live / money-rails readiness — ADMIN only (no secret values). */
export async function GET(req: NextRequest) {
  const user = await requireUser(req, { roles: [UserRole.ADMIN] });
  if (!isAuthUser(user)) return user;

  const report = goLiveReport();
  return NextResponse.json({
    app: "pymtx",
    ...report,
  });
}
