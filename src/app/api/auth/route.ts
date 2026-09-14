import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  getCurrentUser,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const password = String(body.password || "");

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }

  const record = await prisma.user.findUnique({ where: { email } });
  if (!record || !(await verifyPassword(password, record.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const session = await createSession(record.id);
  const res = NextResponse.json({
    user: {
      id: record.id,
      email: record.email,
      name: record.name,
      role: record.role,
      businessId: record.businessId,
    },
  });
  return setSessionCookie(res, session.token, session.expiresAt);
}

export async function DELETE() {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  const res = NextResponse.json({ ok: true });
  return clearSessionCookie(res);
}
