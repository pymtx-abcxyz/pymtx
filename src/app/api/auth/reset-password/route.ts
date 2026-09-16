import { NextRequest, NextResponse } from "next/server";
import { clientIp, publicError } from "@/lib/http";
import { resetPasswordWithToken } from "@/lib/password-reset";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Complete staff password reset with a one-time token.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const token = String(body.token || "");
  const password = String(body.password || "");
  const ip = clientIp(req);

  const limited = await rateLimit({
    key: `reset:${ip}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  try {
    const user = await resetPasswordWithToken({ token, password });
    return NextResponse.json({
      ok: true,
      message: "Password updated. You can sign in with your new password.",
      email: user.email,
    });
  } catch (e) {
    const { error } = publicError(e, "Password reset failed");
    return NextResponse.json({ error }, { status: 400 });
  }
}
