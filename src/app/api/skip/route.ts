import { NextRequest, NextResponse } from "next/server";
import { assertInviteOwnsPlan } from "@/lib/invite-access";
import { evaluateSkipEligibility, executeSkip } from "@/lib/skip-engine";
import { rateLimit } from "@/lib/rate-limit";

function clientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

async function guardSkip(req: NextRequest) {
  const limited = await rateLimit({
    key: `skip:${clientIp(req)}`,
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
  return null;
}

/**
 * Skip API — invite-token bound.
 * GET  ?paymentPlanId=&token=
 * POST { paymentPlanId, token }
 */
export async function GET(req: NextRequest) {
  const blocked = await guardSkip(req);
  if (blocked) return blocked;

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
  const blocked = await guardSkip(req);
  if (blocked) return blocked;

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
