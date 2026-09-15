import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { consumeMagicLink } from "@/lib/magic-link";
import { rateLimit } from "@/lib/rate-limit";

/** GET ?token= — consume magic link, set session, redirect to client portal. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";

  const limited = await rateLimit({
    key: `magic-verify:${ip}`,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.redirect(
      new URL("/login/customer?error=rate_limited", appUrl()),
    );
  }

  if (!token) {
    return NextResponse.redirect(
      new URL("/login/customer?error=missing_token", appUrl()),
    );
  }

  try {
    const { session, inviteToken } = await consumeMagicLink(token);
    const dest = new URL("/client", appUrl());
    dest.searchParams.set("token", inviteToken);
    const res = NextResponse.redirect(dest);
    return setSessionCookie(res, session.token, session.expiresAt);
  } catch {
    return NextResponse.redirect(
      new URL("/login/customer?error=invalid_link", appUrl()),
    );
  }
}
