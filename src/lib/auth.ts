import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { addDays } from "date-fns";
import { prisma } from "./db";
import {
  UserRole,
  isBusinessStaffRole,
  normalizeUserRole,
} from "./domain";

export const SESSION_COOKIE = "pymtx_session";
const SESSION_DAYS = 14;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  businessId: string | null;
  kind: "user";
};

export type AuthCustomer = {
  id: string;
  email: string;
  name: string;
  businessId: string;
  inviteToken: string;
  kind: "customer";
};

export type AuthSubject = AuthUser | AuthCustomer;

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

export async function createCustomerSession(customerId: string) {
  const token = nanoid(48);
  const expiresAt = addDays(new Date(), SESSION_DAYS);
  await prisma.session.create({
    data: { token, customerId, expiresAt },
  });
  return { token, expiresAt };
}

export async function destroySession(token: string | undefined | null) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { token } });
}

export async function getSubjectBySessionToken(
  token: string | undefined | null,
): Promise<AuthSubject | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true, customer: true },
  });
  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    }
    return null;
  }
  if (session.user) {
    return {
      kind: "user",
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: normalizeUserRole(session.user.role),
      businessId: session.user.businessId,
    };
  }
  if (session.customer) {
    return {
      kind: "customer",
      id: session.customer.id,
      email: session.customer.email,
      name: `${session.customer.firstName} ${session.customer.lastName}`,
      businessId: session.customer.businessId,
      inviteToken: session.customer.inviteToken,
    };
  }
  return null;
}

export async function getUserBySessionToken(
  token: string | undefined | null,
): Promise<AuthUser | null> {
  const subject = await getSubjectBySessionToken(token);
  return subject?.kind === "user" ? subject : null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  return getUserBySessionToken(jar.get(SESSION_COOKIE)?.value);
}

export async function getCurrentSubject(): Promise<AuthSubject | null> {
  const jar = await cookies();
  return getSubjectBySessionToken(jar.get(SESSION_COOKIE)?.value);
}

export function getSessionTokenFromRequest(req: NextRequest) {
  return req.cookies.get(SESSION_COOKIE)?.value;
}

export async function requireUser(
  req: NextRequest,
  opts?: { roles?: UserRole[] },
): Promise<AuthUser | NextResponse> {
  const subject = await getSubjectBySessionToken(
    getSessionTokenFromRequest(req),
  );
  if (!subject || subject.kind !== "user") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (opts?.roles?.length) {
    const userRole = normalizeUserRole(subject.role);
    const allowed = new Set(opts.roles.map(normalizeUserRole));
    if (!allowed.has(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  return subject;
}

export function isAuthUser(value: AuthUser | NextResponse): value is AuthUser {
  return !(value instanceof NextResponse);
}

export function isAuthCustomer(
  value: AuthSubject | null,
): value is AuthCustomer {
  return !!value && value.kind === "customer";
}

/** Business users may only act on their own businessId; admins may act on any. */
export function assertBusinessAccess(user: AuthUser, businessId: string): boolean {
  if (normalizeUserRole(user.role) === UserRole.ADMIN) return true;
  return isBusinessStaffRole(user.role) && user.businessId === businessId;
}

export function setSessionCookie(
  res: NextResponse,
  token: string,
  expiresAt: Date,
) {
  const secure =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: expiresAt,
  });
  return res;
}

export function clearSessionCookie(res: NextResponse) {
  const secure =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
  return res;
}
