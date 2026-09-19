/** Platform brand identity for Path B technology attribution (no statutory corp block). */
export const PROVIDER = {
  /** Operating brand — used in footers / CASL technology lines. */
  brand: "pymtx",
  email: "info@pymtx.com",
  jurisdiction: "Province of Ontario / Canada",
} as const;

export const LEGAL_DOC_VERSIONS = {
  saas: "2026-09-19-saas-v2",
  pad: "2026-09-19-pad-h1-v2",
  settlement: "2026-09-19-settlement-cpa-v2",
  privacy: "2026-09-19-privacy-casl-v3",
} as const;

/** Compact brand · email line for email/UI footers. */
export function providerFooterLine() {
  return `${PROVIDER.brand} · ${PROVIDER.email}`;
}

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
    `Technology: ${PROVIDER.brand}`,
    PROVIDER.email,
  ].filter(Boolean);
  return lines.join("\n");
}
