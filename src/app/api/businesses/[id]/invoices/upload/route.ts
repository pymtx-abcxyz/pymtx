import { NextRequest, NextResponse } from "next/server";
import {
  assertBusinessAccess,
  isAuthUser,
  requireUser,
} from "@/lib/auth";
import { UserRole } from "@/lib/domain";
import {
  invoiceUploadRowSchema,
  parseInvoiceCsv,
  uploadInvoicesForBusiness,
} from "@/lib/invoice-upload";

/**
 * POST multipart CSV or JSON invoice rows for a business.
 * Auth: ADMIN or BUSINESS (own business only).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req, {
    roles: [UserRole.ADMIN, UserRole.BUSINESS],
  });
  if (!isAuthUser(user)) return user;

  const { id: businessId } = await params;
  if (!assertBusinessAccess(user, businessId)) {
    return NextResponse.json({ error: "Forbidden for this business" }, { status: 403 });
  }

  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file field required" }, { status: 400 });
      }
      const text = await file.text();
      const parsed = parseInvoiceCsv(text);
      if (!parsed.rows.length) {
        return NextResponse.json(
          { error: "No valid invoice rows", errors: parsed.errors },
          { status: 400 },
        );
      }
      const result = await uploadInvoicesForBusiness(businessId, parsed.rows);
      return NextResponse.json({
        ...result,
        parseErrors: parsed.errors,
      });
    }

    const body = await req.json();
    if (typeof body.csv === "string") {
      const parsed = parseInvoiceCsv(body.csv);
      if (!parsed.rows.length) {
        return NextResponse.json(
          { error: "No valid invoice rows", errors: parsed.errors },
          { status: 400 },
        );
      }
      const result = await uploadInvoicesForBusiness(businessId, parsed.rows);
      return NextResponse.json({ ...result, parseErrors: parsed.errors });
    }

    const invoices = Array.isArray(body.invoices) ? body.invoices : [];
    const rows = invoices.map((row: unknown, i: number) => {
      const parsed = invoiceUploadRowSchema.safeParse(row);
      if (!parsed.success) {
        throw new Error(`Row ${i + 1}: ${parsed.error.issues[0]?.message || "invalid"}`);
      }
      return parsed.data;
    });
    const result = await uploadInvoicesForBusiness(businessId, rows);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 },
    );
  }
}
