import { NextRequest, NextResponse } from "next/server";
import { completeCheckoutPad } from "@/lib/checkout";
import { assertInviteOwnsPlan } from "@/lib/invite-access";
import { clientIp, publicError } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Rule H1 PAD mandate audit + activation.
 * Records IP, user-agent, timestamp on PadMandate and activates the plan
 * (SetupIntent / Direct Charge PM on the connected account).
 *
 * POST { token, paymentPlanId, payorName, payorEmail, bankLast4, ... }
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = await rateLimit({
    key: `pad-mandate:${ip}`,
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

  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "");
  const paymentPlanId = String(body.paymentPlanId || "");
  if (!token || !paymentPlanId) {
    return NextResponse.json(
      { error: "token and paymentPlanId required" },
      { status: 400 },
    );
  }

  try {
    await assertInviteOwnsPlan(token, paymentPlanId);
    const plan = await completeCheckoutPad({
      paymentPlanId,
      payorName: String(body.payorName || ""),
      payorEmail: String(body.payorEmail || ""),
      bankLast4: String(body.bankLast4 || ""),
      institutionName: String(body.institutionName || ""),
      transitNumber: body.transitNumber
        ? String(body.transitNumber)
        : undefined,
      institutionNumber: body.institutionNumber
        ? String(body.institutionNumber)
        : undefined,
      accountNumber: body.accountNumber
        ? String(body.accountNumber)
        : undefined,
      ipAddress: ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });
    return NextResponse.json(plan);
  } catch (e) {
    const { error } = publicError(e, "PAD record failed");
    const status = /belong|Invalid invite|Forbidden/i.test(error) ? 403 : 400;
    return NextResponse.json({ error }, { status });
  }
}
