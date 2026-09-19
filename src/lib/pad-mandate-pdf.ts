import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  PAD_AGREEMENT_VERSION,
  renderPadAgreement,
  type PadAgreementVars,
} from "./legal/pad-agreement";
import {
  SETTLEMENT_TERMS_VERSION,
  renderSettlementTerms,
} from "./legal/settlement-terms";
import { PROVIDER } from "./legal/provider";

/**
 * Rule H1 written PAD confirmation PDF — Document 2 + Document 3 freeze.
 */
export async function buildPadMandatePdf(params: {
  tradeName: string;
  legalName?: string;
  physicalAddress?: string | null;
  supportEmail?: string | null;
  phone?: string | null;
  payorName?: string;
  payorEmail: string;
  customerAddress?: string | null;
  invoiceRef: string;
  firstDebitDate: string;
  monthlyAmountCents: number;
  totalPrincipalCents?: number;
  tenureMonths?: number;
  bankLast4: string;
  institutionNumber?: string;
  transitNumber?: string;
  acceptedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}): Promise<Uint8Array> {
  const formatCad = (cents: number) =>
    new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(cents / 100);

  const merchantLegal = params.legalName || params.tradeName;
  const monthlyCad = formatCad(params.monthlyAmountCents);
  const totalCad = formatCad(
    params.totalPrincipalCents ?? params.monthlyAmountCents,
  );
  const tenure = params.tenureMonths ?? 12;
  const dayOfMonth = Number(params.firstDebitDate.slice(-2)) || "same day";

  const padVars: PadAgreementVars = {
    customerFullName: params.payorName || params.payorEmail,
    customerAddress: params.customerAddress || "Ontario, Canada",
    customerEmail: params.payorEmail,
    merchantLegalName: merchantLegal,
    merchantPhysicalAddress: params.physicalAddress || "Ontario, Canada",
    merchantSupportEmail:
      params.supportEmail || "see merchant contact on file",
    merchantPhone: params.phone || "—",
    fiNumber: params.institutionNumber || "—",
    transitNumber: params.transitNumber || "—",
    accountLast4: params.bankLast4,
    totalPrincipalCad: totalCad,
    tenureMonths: tenure,
    monthlyInstallmentCad: monthlyCad,
    firstDebitDate: params.firstDebitDate,
    dayOfMonth,
  };

  const padText = renderPadAgreement(padVars);
  const settlementText = renderSettlementTerms({
    merchantLegalName: merchantLegal,
    customerFullName: padVars.customerFullName,
    totalInvoiceBalanceCad: totalCad,
    monthlyAmountCad: monthlyCad,
    tenureMonths: tenure,
  });

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(32 / 255, 43 / 255, 49 / 255); // #202b31 text-primary
  const muted = rgb(78 / 255, 98 / 255, 96 / 255); // #4e6260 text-muted

  const writePages = (title: string, body: string) => {
    const lines = body.split("\n");
    let page = doc.addPage([612, 792]);
    let y = 740;
    const drawLine = (text: string, size: number, isBold = false) => {
      const f = isBold ? bold : font;
      const maxWidth = 500;
      const words = text.split(/\s+/);
      let line = "";
      const flush = () => {
        if (!line) return;
        if (y < 56) {
          page = doc.addPage([612, 792]);
          y = 740;
        }
        page.drawText(line, {
          x: 56,
          y,
          size,
          font: f,
          color: ink,
        });
        y -= size + 4;
        line = "";
      };
      if (!text.trim()) {
        y -= 8;
        return;
      }
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(next, size) > maxWidth) {
          flush();
          line = word;
        } else {
          line = next;
        }
      }
      flush();
    };

    drawLine(title, 14, true);
    drawLine(
      `Audit: ${params.acceptedAt.toISOString()} · IP ${params.ipAddress || "—"} · ${PROVIDER.brand}`,
      8,
    );
    y -= 6;
    for (const raw of lines) {
      const heading = /^\d+\.\s/.test(raw) || /^[A-Z][A-Z0-9 /&–—-]{8,}$/.test(raw.trim());
      drawLine(raw, heading ? 10 : 9, heading);
    }
    y -= 8;
    drawLine(`Versions: PAD ${PAD_AGREEMENT_VERSION} · Settlement ${SETTLEMENT_TERMS_VERSION}`, 8);
  };

  writePages("Personal PAD Agreement (Rule H1)", padText);
  writePages("Settlement Terms & Cost of Credit Disclosure", settlementText);

  return doc.save();
}

export function pdfToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}
