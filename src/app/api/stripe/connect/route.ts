import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createConnectLoginLink,
  startConnectOnboarding,
  syncConnectAccountFromStripe,
  toConnectStatus,
} from "@/lib/stripe-connect";

/** GET ?businessId= — current Connect readiness. */
export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  return NextResponse.json(toConnectStatus(business));
}

/**
 * POST { businessId, action?: "onboard" | "sync" | "login" }
 * - onboard (default): create/resume Express AccountLink
 * - sync: pull charges/payouts/details flags from Stripe
 * - login: Express Dashboard link
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const businessId = body.businessId as string | undefined;
  const action = (body.action as string | undefined) || "onboard";

  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
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

    const result = await startConnectOnboarding(businessId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Connect onboarding failed" },
      { status: 400 },
    );
  }
}
