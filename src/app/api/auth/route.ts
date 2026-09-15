import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  destroySession,
  getCurrentUser,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeUserRole } from "@/lib/domain";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: { ...user, role: normalizeUserRole(user.role) },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  const limited = await rateLimit({
    key: `login:${ip}:${email}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const record = await prisma.user.findUnique({ where: { email } });
  if (!record || !(await verifyPassword(password, record.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // Single active session per user.
  await prisma.session.deleteMany({ where: { userId: record.id } });

  const session = await createSession(record.id);
  const res = NextResponse.json({
    user: {
      id: record.id,
      email: record.email,
      name: record.name,
      role: normalizeUserRole(record.role),
      businessId: record.businessId,
    },
  });
  return setSessionCookie(res, session.token, session.expiresAt);
}

export async function DELETE() {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  await destroySession(token);
  return clearSessionCookie(NextResponse.json({ ok: true }));
}
