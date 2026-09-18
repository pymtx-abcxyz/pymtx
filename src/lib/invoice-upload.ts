import { z } from "zod";
import { prisma } from "./db";
import { agingBucket } from "./compliance";
import { InvoiceStatus } from "./domain";
import { sendInviteNotice } from "./notifications";
import { assertUploadDiligence } from "./upload-diligence";

/** Max CSV/JSON invoice rows per upload request. */
export const MAX_UPLOAD_ROWS = 500;
/** Max multipart / CSV body size (1 MiB). */
export const MAX_UPLOAD_BYTES = 1_048_576;

export const invoiceUploadRowSchema = z.object({
  externalRef: z.string().trim().min(1),
  description: z.string().trim().min(1),
  amountCents: z.number().int().positive(),
  dueDate: z.coerce.date(),
  customer: z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z.string().trim().email(),
    phone: z.string().trim().optional(),
  }),
});

export type InvoiceUploadRow = z.infer<typeof invoiceUploadRowSchema>;

export type InvoiceUploadResult = {
  uploaded: number;
  items: {
    invoiceId: string;
    externalRef: string;
    inviteToken: string;
    caslFrom: string;
    customerEmail: string;
  }[];
  errors: { line: number; message: string }[];
};

/** Parse dollars ("1250.00") or integer cents ("125000") into cents. */
export function parseAmountToCents(raw: string): number {
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  if (!cleaned) throw new Error("Amount is required");
  if (cleaned.includes(".")) {
    const dollars = Number(cleaned);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      throw new Error(`Invalid amount: ${raw}`);
    }
    return Math.round(dollars * 100);
  }
  const cents = Number(cleaned);
  if (!Number.isFinite(cents) || cents <= 0 || !Number.isInteger(cents)) {
    throw new Error(`Invalid amount: ${raw}`);
  }
  return cents;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/**
 * CSV headers (case-insensitive):
 * external_ref,description,amount,due_date,first_name,last_name,email,phone
 * `amount` accepts CAD dollars (1250.00) or integer cents (125000).
 */
export function parseInvoiceCsv(csvText: string): {
  rows: InvoiceUploadRow[];
  errors: { line: number; message: string }[];
} {
  if (Buffer.byteLength(csvText, "utf8") > MAX_UPLOAD_BYTES) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message: `CSV exceeds maximum size of ${MAX_UPLOAD_BYTES} bytes`,
        },
      ],
    };
  }

  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      rows: [],
      errors: [{ line: 1, message: "CSV must include a header row and at least one data row" }],
    };
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };

  const col = {
    externalRef: idx(["external_ref", "externalref", "invoice_ref", "ref"]),
    description: idx(["description", "desc"]),
    amount: idx(["amount", "amount_cad", "amount_cents", "balance"]),
    dueDate: idx(["due_date", "duedate", "due"]),
    firstName: idx(["first_name", "firstname", "first"]),
    lastName: idx(["last_name", "lastname", "last"]),
    email: idx(["email", "customer_email"]),
    phone: idx(["phone", "customer_phone"]),
  };

  const missing = Object.entries(col)
    .filter(([k, v]) => k !== "phone" && v < 0)
    .map(([k]) => k);
  if (missing.length) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message: `Missing required columns: ${missing.join(", ")}`,
        },
      ],
    };
  }

  const rows: InvoiceUploadRow[] = [];
  const errors: { line: number; message: string }[] = [];

  for (let li = 1; li < lines.length; li += 1) {
    const cells = splitCsvLine(lines[li]);
    try {
      const amountCents = parseAmountToCents(cells[col.amount] || "");
      const parsed = invoiceUploadRowSchema.parse({
        externalRef: cells[col.externalRef],
        description: cells[col.description],
        amountCents,
        dueDate: cells[col.dueDate],
        customer: {
          firstName: cells[col.firstName],
          lastName: cells[col.lastName],
          email: cells[col.email],
          phone: col.phone >= 0 ? cells[col.phone] || undefined : undefined,
        },
      });
      rows.push(parsed);
    } catch (e) {
      errors.push({
        line: li + 1,
        message: e instanceof Error ? e.message : "Invalid row",
      });
    }
  }

  return { rows, errors };
}

/** Upsert customers + invoices and send CASL INVITE emails (contact-hour gated). */
export async function uploadInvoicesForBusiness(
  businessId: string,
  invoices: InvoiceUploadRow[],
): Promise<InvoiceUploadResult> {
  if (invoices.length > MAX_UPLOAD_ROWS) {
    throw new Error(
      `Upload limited to ${MAX_UPLOAD_ROWS} invoices per request (got ${invoices.length})`,
    );
  }

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
  });

  const items: InvoiceUploadResult["items"] = [];
  const errors: InvoiceUploadResult["errors"] = [];

  for (let i = 0; i < invoices.length; i += 1) {
    const row = invoices[i];
    try {
      assertUploadDiligence({
        dueDate: row.dueDate,
        amountCents: row.amountCents,
      });

      let customer = await prisma.customer.findUnique({
        where: {
          businessId_email: { businessId, email: row.customer.email.toLowerCase() },
        },
      });

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            businessId,
            firstName: row.customer.firstName,
            lastName: row.customer.lastName,
            email: row.customer.email.toLowerCase(),
            phone: row.customer.phone,
            invitedAt: new Date(),
          },
        });
      } else if (!customer.invitedAt) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: { invitedAt: new Date() },
        });
      }

      const existing = await prisma.invoice.findUnique({
        where: {
          businessId_externalRef: {
            businessId,
            externalRef: row.externalRef,
          },
        },
        select: { id: true, status: true },
      });

      if (
        existing &&
        (existing.status === InvoiceStatus.PLAN_ACTIVE ||
          existing.status === InvoiceStatus.SETTLED ||
          existing.status === InvoiceStatus.WRITTEN_OFF)
      ) {
        throw new Error(
          `Cannot overwrite invoice ${row.externalRef} in status ${existing.status}`,
        );
      }

      const invoice = await prisma.invoice.upsert({
        where: {
          businessId_externalRef: {
            businessId,
            externalRef: row.externalRef,
          },
        },
        create: {
          businessId,
          customerId: customer.id,
          externalRef: row.externalRef,
          description: row.description,
          originalAmountCents: row.amountCents,
          balanceCents: row.amountCents,
          dueDate: row.dueDate,
          status: InvoiceStatus.INVITED,
          agingBucket: agingBucket(row.dueDate),
        },
        update: {
          description: row.description,
          balanceCents: row.amountCents,
          agingBucket: agingBucket(row.dueDate),
          status: InvoiceStatus.INVITED,
        },
      });

      await sendInviteNotice({
        businessId,
        customerId: customer.id,
        tradeName: business.tradeName,
        legalName: business.legalName,
        physicalAddress: business.physicalAddress,
        supportEmail: business.supportEmail || business.email,
        phone: business.phone,
        toEmail: customer.email,
        customerFirstName: customer.firstName,
        invoiceRef: invoice.externalRef,
        amountCents: invoice.balanceCents,
        inviteToken: customer.inviteToken,
      });

      items.push({
        invoiceId: invoice.id,
        externalRef: invoice.externalRef,
        inviteToken: customer.inviteToken,
        caslFrom: business.tradeName,
        customerEmail: customer.email,
      });
    } catch (e) {
      errors.push({
        line: i + 1,
        message: e instanceof Error ? e.message : "Upload row failed",
      });
    }
  }

  return { uploaded: items.length, items, errors };
}
