import { NextRequest, NextResponse } from "next/server";
import {
  assertBusinessAccess,
  isAuthUser,
  requireUser,
} from "@/lib/auth";
import { UserRole } from "@/lib/domain";
import { clientIp } from "@/lib/http";
import {
  invoiceUploadRowSchema,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_ROWS,
  parseInvoiceCsv,
  uploadInvoicesForBusiness,
} from "@/lib/invoice-upload";
import { businessStaffRoles, canUploadInvoices } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST multipart CSV or JSON invoice rows for a business.
 * Auth: ADMIN, OWNER, or CLERK (own business only).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser(req, {
    roles: [UserRole.ADMIN, ...businessStaffRoles()],
  });
  if (!isAuthUser(user)) return user;
  if (!canUploadInvoices(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: businessId } = await params;
  if (!assertBusinessAccess(user, businessId)) {
    return NextResponse.json({ error: "Forbidden for this business" }, { status: 403 });
  }

  const limited = await rateLimit({
    key: `upload:${businessId}:${clientIp(req)}`,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Upload exceeds maximum size of ${MAX_UPLOAD_BYTES} bytes` },
      { status: 413 },
    );
  }

  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file field required" }, { status: 400 });
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `Upload exceeds maximum size of ${MAX_UPLOAD_BYTES} bytes` },
          { status: 413 },
        );
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
    if (invoices.length > MAX_UPLOAD_ROWS) {
      return NextResponse.json(
        {
          error: `Upload limited to ${MAX_UPLOAD_ROWS} invoices per request`,
        },
        { status: 400 },
      );
    }
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
