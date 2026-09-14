import { NextRequest, NextResponse } from "next/server";
import { evaluateSkipEligibility, executeSkip } from "@/lib/skip-engine";

export async function GET(req: NextRequest) {
  const planId = req.nextUrl.searchParams.get("paymentPlanId");
  if (!planId) {
    return NextResponse.json({ error: "paymentPlanId required" }, { status: 400 });
  }
  const eligibility = await evaluateSkipEligibility(planId);
  return NextResponse.json(eligibility);
}

export async function POST(req: NextRequest) {
  const { paymentPlanId } = await req.json();
  if (!paymentPlanId) {
    return NextResponse.json({ error: "paymentPlanId required" }, { status: 400 });
  }
  const result = await executeSkip(paymentPlanId);
  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
