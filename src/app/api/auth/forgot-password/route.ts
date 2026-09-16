import { NextRequest, NextResponse } from "next/server";
import { clientIp } from "@/lib/http";
import { requestPasswordReset } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Staff forgot-password — always returns a generic success message.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const ip = clientIp(req);

  const limited = await rateLimit({
    key: `forgot:${ip}:${email || "anon"}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many reset requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const result = await requestPasswordReset(email);
  return NextResponse.json(result);
}
