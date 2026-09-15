import { NextRequest, NextResponse } from "next/server";
import { assertInviteOwnsPlan } from "@/lib/invite-access";
import { evaluateSkipEligibility, executeSkip } from "@/lib/skip-engine";

/**
 * Skip API — invite-token bound.
 * GET  ?paymentPlanId=&token=
 * POST { paymentPlanId, token }
 */
export async function GET(req: NextRequest) {
  const planId = req.nextUrl.searchParams.get("paymentPlanId");
  const token = req.nextUrl.searchParams.get("token");
  if (!planId || !token) {
    return NextResponse.json(
      { error: "paymentPlanId and token required" },
      { status: 400 },
    );
  }
  try {
    await assertInviteOwnsPlan(token, planId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Forbidden" },
      { status: 403 },
    );
  }
  return NextResponse.json(await evaluateSkipEligibility(planId));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const paymentPlanId = body.paymentPlanId as string | undefined;
  const token = body.token as string | undefined;
  if (!paymentPlanId || !token) {
    return NextResponse.json(
      { error: "paymentPlanId and token required" },
      { status: 400 },
    );
  }
  try {
    await assertInviteOwnsPlan(token, paymentPlanId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Forbidden" },
      { status: 403 },
    );
  }
  const result = await executeSkip(paymentPlanId);
  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
