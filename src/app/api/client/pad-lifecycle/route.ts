import { NextRequest, NextResponse } from "next/server";
import { assertInviteOwnsPlan } from "@/lib/invite-access";
import { clientIp } from "@/lib/http";
import {
  cancelPadAuthorization,
  freezePlanForDispute,
  pauseCommunicationsForCounsel,
  resumeCommunications,
} from "@/lib/pad-lifecycle";
import { rateLimit } from "@/lib/rate-limit";

async function guard(req: NextRequest) {
  const limited = await rateLimit({
    key: `pad-lifecycle:${clientIp(req)}`,
    limit: 20,
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
 * Debtor PAD cancel / dispute freeze / counsel communication pause —
 * invite-token bound.
 * POST { paymentPlanId, token, action, reason? }
 * action: "cancel_pad" | "dispute" | "pause_comms" | "resume_comms"
 */
export async function POST(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;

  const body = await req.json().catch(() => ({}));
  const paymentPlanId = body.paymentPlanId as string | undefined;
  const token = body.token as string | undefined;
  const action = body.action as string | undefined;
  const reason =
    typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : undefined;

  if (!paymentPlanId || !token || !action) {
    return NextResponse.json(
      { error: "paymentPlanId, token, and action required" },
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

  try {
    if (action === "dispute") {
      const result = await freezePlanForDispute({ paymentPlanId, reason });
      return NextResponse.json({
        ok: true,
        action: "dispute",
        ...result,
        message: result.alreadyFrozen
          ? "Dispute freeze already active — automated debits and notices remain halted."
          : "Dispute registered. Automated recurring debits and collection notices are halted pending merchant review.",
      });
    }
    if (action === "pause_comms") {
      const result = await pauseCommunicationsForCounsel({
        paymentPlanId,
        reason,
      });
      return NextResponse.json({
        ok: true,
        action: "pause_comms",
        ...result,
        message: result.alreadyPaused
          ? "Communications are already paused."
          : "Automated collection notices paused (counsel / court). Debits are unchanged unless you also dispute or cancel PAD.",
      });
    }
    if (action === "resume_comms") {
      const result = await resumeCommunications({ paymentPlanId });
      return NextResponse.json({
        ok: true,
        action: "resume_comms",
        ...result,
        message: result.alreadyResumed
          ? "Communications were not paused."
          : "Communication pause cleared. Notices may resume under Ontario contact hours and the 3/7 cadence.",
      });
    }
    if (action === "cancel_pad") {
      const result = await cancelPadAuthorization({ paymentPlanId, reason });
      return NextResponse.json({
        ok: true,
        action: "cancel_pad",
        ...result,
        message: result.alreadyCancelled
          ? "PAD authorization was already cancelled."
          : "PAD authorization cancelled. Underlying debt remains owed to the merchant; contact them for alternate payment.",
      });
    }
    return NextResponse.json(
      {
        error:
          'action must be "dispute", "cancel_pad", "pause_comms", or "resume_comms"',
      },
      { status: 400 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 400 },
    );
  }
}
