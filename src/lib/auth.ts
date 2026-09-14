import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { addDays } from "date-fns";
import { prisma } from "./db";
import { UserRole } from "./domain";

export const SESSION_COOKIE = "harbor_session";
const SESSION_DAYS = 14;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  businessId: string | null;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createSession(userId: string) {
  const token = nanoid(48);
  const expiresAt = addDays(new Date(), SESSION_DAYS);
  await prisma.session.create({
    data: { token, userId, expiresAt },
  });
  return { token, expiresAt };
}

export async function destroySession(token: string | undefined | null) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { token } });
}

export async function getUserBySessionToken(
  token: string | undefined | null,
): Promise<AuthUser | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    }
    return null;
  }
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role as UserRole,
    businessId: session.user.businessId,
  };
}

/** Server Components / Route Handlers — read cookie jar. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  return getUserBySessionToken(jar.get(SESSION_COOKIE)?.value);
}

export function getSessionTokenFromRequest(req: NextRequest) {
  return req.cookies.get(SESSION_COOKIE)?.value;
}

export async function requireUser(
  req: NextRequest,
  opts?: { roles?: UserRole[] },
): Promise<AuthUser | NextResponse> {
  const user = await getUserBySessionToken(getSessionTokenFromRequest(req));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (opts?.roles && !opts.roles.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

export function isAuthUser(value: AuthUser | NextResponse): value is AuthUser {
  return !(value instanceof NextResponse);
}

/** Business users may only act on their own businessId; admins may act on any. */
export function assertBusinessAccess(user: AuthUser, businessId: string): boolean {
  if (user.role === UserRole.ADMIN) return true;
  return user.role === UserRole.BUSINESS && user.businessId === businessId;
}

export function setSessionCookie(
  res: NextResponse,
  token: string,
  expiresAt: Date,
) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return res;
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
