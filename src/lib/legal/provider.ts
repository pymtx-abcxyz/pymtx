/** 1001527397 ONTARIO INC. — Path B technology licensor identity. */
export const PROVIDER = {
  legalName: "1001527397 ONTARIO INC.",
  brand: "pymtx",
  addressLine: "MB055-70 Taunton Rd E, Whitby, ON L1R 3L5, Canada",
  email: "info@pymtx.com",
  jurisdiction: "Province of Ontario / Canada",
} as const;

export const LEGAL_DOC_VERSIONS = {
  saas: "2026-09-16-saas-v1",
  pad: "2026-09-16-pad-h1-v1",
  settlement: "2026-09-16-settlement-cpa-v1",
  privacy: "2026-09-16-privacy-casl-v1",
} as const;

export function caslAttributionBlock(merchant?: {
  legalName: string;
  address?: string | null;
  supportEmail?: string | null;
  phone?: string | null;
}) {
  const lines = [
    merchant
      ? [
          `Merchant of Record: ${merchant.legalName}`,
          merchant.address || null,
          merchant.supportEmail
            ? `Support: ${merchant.supportEmail}${merchant.phone ? ` | ${merchant.phone}` : ""}`
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      : null,
    `Technology: ${PROVIDER.legalName}`,
    PROVIDER.addressLine,
    PROVIDER.email,
  ].filter(Boolean);
  return lines.join("\n");
}
