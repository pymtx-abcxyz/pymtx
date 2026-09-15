import { NextRequest, NextResponse } from "next/server";
import {
  assertBusinessAccess,
  isAuthUser,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@/lib/domain";
import { businessStaffRoles, canViewInvoices } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req, {
    roles: [UserRole.ADMIN, ...businessStaffRoles()],
  });
  if (!isAuthUser(user)) return user;
  if (!canViewInvoices(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!assertBusinessAccess(user, id)) {
    return NextResponse.json({ error: "Forbidden for this business" }, { status: 403 });
  }

  const invoices = await prisma.invoice.findMany({
    where: { businessId: id },
    include: {
      customer: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          inviteToken: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });
  return NextResponse.json(invoices);
}
