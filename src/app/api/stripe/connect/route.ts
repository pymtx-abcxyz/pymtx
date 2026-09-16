import { NextRequest, NextResponse } from "next/server";
import { assertBusinessAccess, isAuthUser, requireUser } from "@/lib/auth";
import { UserRole } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { canManageConnect } from "@/lib/permissions";
import {
  createConnectLoginLink,
  provisionTestConnectAccount,
  startConnectOnboarding,
  syncConnectAccountFromStripe,
  toConnectStatus,
} from "@/lib/stripe-connect";

/** GET ?businessId= — current Connect readiness. OWNER (or ADMIN) only. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req, { roles: [UserRole.ADMIN, UserRole.OWNER] });
  if (!isAuthUser(user)) return user;
  if (!canManageConnect(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }
  if (!assertBusinessAccess(user, businessId)) {
    return NextResponse.json({ error: "Forbidden for this business" }, { status: 403 });
  }

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  return NextResponse.json(toConnectStatus(business));
}

/**
 * POST { businessId, action?: "onboard" | "sync" | "login" | "provision_test" }
 * - onboard (default): create/resume Express AccountLink
 * - sync: pull charges/payouts/details flags from Stripe
 * - login: Express Dashboard link
 * - provision_test: sk_test_ only — Custom Connect ready for ACSS Direct Charges (E2E)
 * OWNER (or ADMIN) only — clerks cannot manage Connect.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req, { roles: [UserRole.ADMIN, UserRole.OWNER] });
  if (!isAuthUser(user)) return user;
  if (!canManageConnect(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const businessId = body.businessId as string | undefined;
  const action = (body.action as string | undefined) || "onboard";

  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }
  if (!assertBusinessAccess(user, businessId)) {
    return NextResponse.json({ error: "Forbidden for this business" }, { status: 403 });
  }

  try {
    if (action === "sync") {
      const status = await syncConnectAccountFromStripe(businessId);
      return NextResponse.json(status);
    }

    if (action === "login") {
      const result = await createConnectLoginLink(businessId);
      return NextResponse.json(result);
    }

    if (action === "provision_test") {
      const status = await provisionTestConnectAccount(businessId);
      return NextResponse.json({
        ...status,
        message: status.readyForDebits
          ? "Test Connect account ready for Path B Direct Charges"
          : "Test Connect account created — charges not enabled yet",
      });
    }

    const result = await startConnectOnboarding(businessId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Connect onboarding failed" },
      { status: 400 },
    );
  }
}
