import { NextRequest, NextResponse } from "next/server";
import { clientIp } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { requestCustomerMagicLink } from "@/lib/magic-link";

/** POST { email, businessId? } — request a customer magic-link email. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const businessId = body.businessId
    ? String(body.businessId).trim()
    : undefined;
  const ip = clientIp(req);

  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const limited = await rateLimit({
    key: `magic:${ip}:${email}`,
    limit: 5,
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

  // Always return the same generic body to avoid email enumeration.
  try {
    const result = await requestCustomerMagicLink(email, { businessId });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[magic-link]", e instanceof Error ? e.message : e);
    return NextResponse.json({
      ok: true,
      message: "If that email is on file, a sign-in link is on its way.",
    });
  }
}
