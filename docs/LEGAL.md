# Legal documents (Ontario Path B insulation)

| Doc | Route / surface | Code |
|-----|-----------------|------|
| 1. Master SaaS & Merchant Indemnity | `/legal/saas` + business registration checkbox | `src/lib/legal/saas-agreement.ts` |
| 2. Consumer Personal PAD (Rule H1) | Client checkout PAD step + PDF email | `src/lib/legal/pad-agreement.ts` |
| 3. Settlement Terms & Cost of Credit | Client checkout + PDF | `src/lib/legal/settlement-terms.ts` |
| 4. Privacy & CASL | `/legal/privacy` | `src/lib/legal/privacy.ts` |

Provider identity: **pymtx** (`info@pymtx.com`).

Acceptance audits:
- Merchant: `Business.saasAgreementAcceptedAt` + `saasAgreementVersion`
- Consumer PAD: `PadMandate.agreementText` / `settlementTermsText` + version stamps, IP/UA
