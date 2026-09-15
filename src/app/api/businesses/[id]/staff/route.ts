import { NextRequest, NextResponse } from "next/server";
import {
  assertBusinessAccess,
  hashPassword,
  isAuthUser,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole, normalizeUserRole } from "@/lib/domain";
import { canManageStaff } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";

/** GET — list staff for a business. OWNER (or ADMIN) only. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req, { roles: [UserRole.ADMIN, UserRole.OWNER] });
  if (!isAuthUser(user)) return user;
  if (!canManageStaff(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: businessId } = await params;
  if (!assertBusinessAccess(user, businessId)) {
    return NextResponse.json({ error: "Forbidden for this business" }, { status: 403 });
  }

  const staff = await prisma.user.findMany({
    where: { businessId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    staff.map((s) => ({ ...s, role: normalizeUserRole(s.role) })),
  );
}

/**
 * POST { email, name, password, role?: "CLERK" | "OWNER" }
 * Invite / create a staff user on this business. OWNER (or ADMIN) only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req, { roles: [UserRole.ADMIN, UserRole.OWNER] });
  if (!isAuthUser(user)) return user;
  if (!canManageStaff(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: businessId } = await params;
  if (!assertBusinessAccess(user, businessId)) {
    return NextResponse.json({ error: "Forbidden for this business" }, { status: 403 });
  }

  const limited = await rateLimit({
    key: `staff-invite:${user.id}:${businessId}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many staff invites. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  const requestedRole = String(body.role || UserRole.CLERK).toUpperCase();
  const role =
    requestedRole === UserRole.OWNER ? UserRole.OWNER : UserRole.CLERK;

  if (!email.includes("@") || !name || password.length < 8) {
    return NextResponse.json(
      { error: "email, name, and password (8+ chars) required" },
      { status: 400 },
    );
  }

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "A user with that email already exists" },
      { status: 409 },
    );
  }

  const created = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await hashPassword(password),
      role,
      businessId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      businessId: true,
      createdAt: true,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
