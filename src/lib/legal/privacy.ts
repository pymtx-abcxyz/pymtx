import { LEGAL_DOC_VERSIONS, PROVIDER } from "./provider";

export const PRIVACY_POLICY_VERSION = LEGAL_DOC_VERSIONS.privacy;

/**
 * Document 4 — Privacy Policy & CASL Electronic Disclosure Statement.
 */
export function privacyPolicyMarkdown() {
  return `# Privacy Policy & CASL Electronic Disclosure Statement

**Platform:** ${PROVIDER.brand}  
**Jurisdiction:** ${PROVIDER.jurisdiction} (PIPEDA & CASL)  
**Privacy Contact:** ${PROVIDER.email}  
**Document version:** ${PRIVACY_POLICY_VERSION}

## 1. Scope of Data Processing under PIPEDA

${PROVIDER.brand} processes personal data strictly as an automated technical processor on behalf of participating merchants.

### Categories of Data Collected
Debtor name, address, email address, telephone number (for merchant records / identity verification), invoice reference numbers, payment dates, tokenized Canadian bank details, IP address, and browser user-agent strings.

### Purpose of Collection
Data is processed exclusively to verify electronic identities, clear bank debits via Canadian financial institutions, and maintain statutory audit logs under Payments Canada Rule H1.

### Bank Credential Tokenization
${PROVIDER.brand} does not store raw bank account numbers or financial institution credentials on unencrypted local disks. All banking credentials are encrypted and tokenized directly via Stripe Payments Canada (PCI-DSS Level 1 compliant).

### Mandatory Retention Period
Pursuant to Payments Canada Rule H1, electronic mandate audit logs (timestamp, IP address, browser signature, and contract versions) are retained in secure, encrypted storage for a minimum of twelve (12) months following the date of the final debit.

## 2. CASL Electronic Notice Standard

### Existing Business Relationship (EBR)
Automated **email** communications dispatched through the platform represent transactional debt-management notifications sent under the statutory Existing Business Relationship exemption of Canada's Anti-Spam Legislation (CASL). The platform does **not** send SMS or other text-message collection contacts. Telephone numbers may be stored for merchant identity and support purposes only.

### Mandatory Sender Information
Every automated electronic communication clearly sets forth:
- The legal operating name and Ontario postal address of the original Merchant;
- Direct customer support channels for the Merchant (Reply-To);
- Technological attribution: ${PROVIDER.brand} (${PROVIDER.email}).

### Ontario contact windows & cadence
Debtor collection emails are gated to Ontario CDSSA contact hours, capped at three (3) counting contacts per seven (7) days, and suppressed while a dispute freeze or counsel/court communication pause is active. Magic-link authentication emails remain available so the debtor can access the portal.
`;
}

export function privacyPolicyPlainText() {
  return privacyPolicyMarkdown()
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*/g, "");
}
