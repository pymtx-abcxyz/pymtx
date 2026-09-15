import { NextRequest, NextResponse } from "next/server";
import {
  assertBusinessAccess,
  isAuthUser,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole, isBusinessStaffRole } from "@/lib/domain";
import {
  invoiceUploadRowSchema,
  uploadInvoicesForBusiness,
} from "@/lib/invoice-upload";
import { businessStaffRoles, canUploadInvoices } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const user = await requireUser(req, {
    roles: [UserRole.ADMIN, ...businessStaffRoles()],
  });
  if (!isAuthUser(user)) return user;

  if (isBusinessStaffRole(user.role)) {
    if (!user.businessId) {
      return NextResponse.json({ error: "No business linked" }, { status: 403 });
    }
    const business = await prisma.business.findUnique({
      where: { id: user.businessId },
      include: { _count: { select: { invoices: true, customers: true } } },
    });
    return NextResponse.json(business ? [business] : []);
  }

  const businesses = await prisma.business.findMany({
    include: { _count: { select: { invoices: true, customers: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(businesses);
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req, { roles: [UserRole.ADMIN] });
  if (!isAuthUser(user)) return user;

  const body = await req.json();
  const business = await prisma.business.create({
    data: {
      legalName: body.legalName,
      tradeName: body.tradeName,
      email: body.email,
      phone: body.phone,
      ontarioCorpNumber: body.ontarioCorpNumber,
      caslConsentAt: body.caslConsent ? new Date() : null,
    },
  });
  return NextResponse.json(business, { status: 201 });
}

/** JSON invoice upload (legacy) — prefers POST …/invoices/upload for CSV. */
export async function PUT(req: NextRequest) {
  const user = await requireUser(req, {
    roles: [UserRole.ADMIN, ...businessStaffRoles()],
  });
  if (!isAuthUser(user)) return user;
  if (!canUploadInvoices(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const businessId = String(body.businessId || "");
  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }
  if (!assertBusinessAccess(user, businessId)) {
    return NextResponse.json({ error: "Forbidden for this business" }, { status: 403 });
  }

  const invoices = Array.isArray(body.invoices) ? body.invoices : [];

  try {
    const rows = invoices.map((row: unknown, i: number) => {
      const parsed = invoiceUploadRowSchema.safeParse(row);
      if (!parsed.success) {
        throw new Error(`Row ${i + 1}: ${parsed.error.issues[0]?.message || "invalid"}`);
      }
      return parsed.data;
    });
    const result = await uploadInvoicesForBusiness(businessId, rows);
    return NextResponse.json({
      uploaded: result.uploaded,
      items: result.items.map((item) => ({
        invoiceId: item.invoiceId,
        inviteToken: item.inviteToken,
        caslFrom: item.caslFrom,
        externalRef: item.externalRef,
      })),
      errors: result.errors,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 },
    );
  }
}
