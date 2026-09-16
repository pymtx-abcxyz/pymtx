import { LEGAL_DOC_VERSIONS, PROVIDER } from "./provider";

export const PRIVACY_POLICY_VERSION = LEGAL_DOC_VERSIONS.privacy;

/**
 * Document 4 — Privacy Policy & CASL Electronic Disclosure Statement.
 */
export function privacyPolicyMarkdown() {
  return `# Privacy Policy & CASL Electronic Disclosure Statement

**Entity:** ${PROVIDER.legalName}  
**Jurisdiction:** ${PROVIDER.jurisdiction} (PIPEDA & CASL)  
**Registered Office:** ${PROVIDER.addressLine}  
**Privacy Contact:** ${PROVIDER.email}  
**Document version:** ${PRIVACY_POLICY_VERSION}

## 1. Scope of Data Processing under PIPEDA

${PROVIDER.legalName} processes personal data strictly as an automated technical processor on behalf of participating merchants.

### Categories of Data Collected
Debtor name, address, email address, telephone number, invoice reference numbers, payment dates, tokenized Canadian bank details, IP address, and browser user-agent strings.

### Purpose of Collection
Data is processed exclusively to verify electronic identities, clear bank debits via Canadian financial institutions, and maintain statutory audit logs under Payments Canada Rule H1.

### Bank Credential Tokenization
${PROVIDER.legalName} does not store raw bank account numbers or financial institution credentials on unencrypted local disks. All banking credentials are encrypted and tokenized directly via Stripe Payments Canada (PCI-DSS Level 1 compliant).

### Mandatory Retention Period
Pursuant to Payments Canada Rule H1, electronic mandate audit logs (timestamp, IP address, browser signature, and contract versions) are retained in secure, encrypted storage for a minimum of twelve (12) months following the date of the final debit.

## 2. CASL Electronic Notice Standard

### Existing Business Relationship (EBR)
All email and SMS communications dispatched through the platform represent transactional debt management notifications sent under the statutory Existing Business Relationship exemption of Canada's Anti-Spam Legislation (CASL).

### Mandatory Sender Information
Every automated electronic communication clearly sets forth:
- The legal operating name and Ontario postal address of the original Merchant;
- Direct customer support channels for the Merchant;
- Technological attribution: ${PROVIDER.legalName}, ${PROVIDER.addressLine} (${PROVIDER.email}).
`;
}

export function privacyPolicyPlainText() {
  return privacyPolicyMarkdown()
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*/g, "");
}
