import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  PAD_CANCELLATION_TERMS,
  PAD_NSF_POLICY,
  PAD_RECOURSE_TERMS,
} from "./compliance";

function formatCad(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

/**
 * Rule H1 written PAD confirmation PDF — merchant of record identity.
 */
export async function buildPadMandatePdf(params: {
  tradeName: string;
  legalName?: string;
  payorEmail: string;
  invoiceRef: string;
  firstDebitDate: string;
  monthlyAmountCents: number;
  bankLast4: string;
  acceptedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.05, 0.1, 0.16);
  const muted = rgb(0.35, 0.42, 0.4);
  let y = 740;

  const write = (
    text: string,
    size = 10,
    options?: { bold?: boolean; color?: ReturnType<typeof rgb> },
  ) => {
    const f = options?.bold ? bold : font;
    const maxWidth = 500;
    const words = text.split(/\s+/);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(next, size) > maxWidth) {
        page.drawText(line, {
          x: 56,
          y,
          size,
          font: f,
          color: options?.color || ink,
        });
        y -= size + 4;
        line = word;
      } else {
        line = next;
      }
    }
    if (line) {
      page.drawText(line, {
        x: 56,
        y,
        size,
        font: f,
        color: options?.color || ink,
      });
      y -= size + 6;
    }
  };

  write("Personal PAD confirmation", 16, { bold: true });
  write("Payments Canada Rule H1 — written confirmation", 10, { color: muted });
  y -= 8;
  write(`Creditor (Merchant of Record): ${params.tradeName}`, 11, { bold: true });
  if (params.legalName) write(`Legal name: ${params.legalName}`);
  write(`Payor email: ${params.payorEmail}`);
  write(`Invoice: ${params.invoiceRef}`);
  write(`Monthly debit: ${formatCad(params.monthlyAmountCents)}`);
  write(`Account ending: •••• ${params.bankLast4}`);
  write(`First debit on or after: ${params.firstDebitDate}`);
  write(`Accepted at (UTC): ${params.acceptedAt.toISOString()}`);
  if (params.ipAddress) write(`IP address: ${params.ipAddress}`);
  if (params.userAgent) write(`User agent: ${params.userAgent.slice(0, 120)}`);
  y -= 10;
  write("Recourse / reimbursement", 11, { bold: true });
  write(PAD_RECOURSE_TERMS, 9);
  y -= 4;
  write("Cancellation", 11, { bold: true });
  write(PAD_CANCELLATION_TERMS, 9);
  y -= 4;
  write("NSF policy", 11, { bold: true });
  write(PAD_NSF_POLICY, 9);
  y -= 10;
  write(
    "Pymtx provides Path B / zero-custody settlement software only. Principal is never held by pymtx.",
    8,
    { color: muted },
  );

  return doc.save();
}

export function pdfToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}
