import { LEGAL_DOC_VERSIONS, PROVIDER } from "./provider";

export const SAAS_AGREEMENT_VERSION = LEGAL_DOC_VERSIONS.saas;
export const SAAS_AGREEMENT_TITLE =
  "Master Software-as-a-Service (SaaS) Agreement & Merchant Indemnity";

/**
 * Document 1 — Master SaaS Agreement & Merchant Indemnity.
 * Accepted electronically at merchant registration.
 */
export function saasAgreementMarkdown() {
  return `# ${SAAS_AGREEMENT_TITLE}

**Effective Date:** Upon electronic acceptance during registration

**Technology Licensor:** ${PROVIDER.legalName}, having its registered office at ${PROVIDER.addressLine} (${PROVIDER.email}) ("Provider")

**Licensee:** The commercial business entity executing this electronic registration ("Merchant")

## 1. Nature of Technology Services (Strict Technological Neutrality)

### 1.1 Passive Technological Conduit
Provider grants Merchant a non-exclusive, non-transferable, revocable license to access and use its proprietary cloud software platform ("Platform") solely as an automated technical transmission conduit and administrative ledgering facility for accounts receivable payment plans.

### 1.2 Express Disclaimer of Regulated Status
Merchant expressly acknowledges that Provider is not a collection agency, debt settlement services provider, credit reporting agency, factor, lender, depository institution, or financial intermediary as defined under the Ontario Collection and Debt Settlement Services Act (CDSSA), the Ontario Consumer Protection Act (CPA), or the Bank Act (Canada). Provider exercises zero discretionary judgment, negotiation, or arbitration over the debts entered. All payment terms, notifications, and settlement options are initiated by and on behalf of Merchant as the original first-party creditor.

### 1.3 Independent Creditor Warranties
Merchant represents, warrants, and covenants that:
- It is the sole original, legal, and beneficial creditor of every claim, invoice, and balance entered into the Platform.
- All accounts arise from legitimate, completed commercial transactions within the Province of Ontario.
- No account uploaded has been factored, sold, assigned, or transferred to or from any third-party debt collector or collection agency.
- All claims entered are valid, enforceable, liquidated sums that arose within the applicable two-year statutory limitation period under the Ontario Limitations Act, 2002.

## 2. Fund Flow & Absolute Zero-Custody Architecture

### 2.1 Direct Settlement (Stripe Connect)
Debtor settlements are processed exclusively via Direct Charges on Merchant's dedicated Stripe Connect account (\`{ stripeAccount: connectedAccountId }\`). Merchant is the sole Merchant of Record.

### 2.2 Zero Legal Custody
Debtor payments flow directly from the debtor's financial institution into Merchant's connected commercial bank account. Under no circumstances shall Provider receive, hold, pool, route, or exercise constructive custody or control over any debtor payments or settlement funds. Provider has no trust-accounting obligations under the CDSSA.

### 2.3 SaaS Application Fees
Merchant irrevocably authorizes Provider to automatically instruct Stripe to deduct an automated software application fee (\`application_fee_amount\`) from each transaction at the exact time of processing as licensing compensation for Platform use.

### 2.4 Prohibition on Debtor Surcharges
In accordance with the CDSSA, Merchant covenants that the balance uploaded shall strictly reflect the legitimate principal owed plus any lawfully agreed contractual interest. Merchant is strictly prohibited from surcharging or passing Provider's software fees onto the debtor.

## 3. Complete Defense and Full-Indemnity Hold Harmless

### 3.1 Unconditional Indemnification
Merchant shall defend, indemnify, and hold completely harmless ${PROVIDER.legalName}, its directors, officers, shareholders, employees, agents, and successors from and against any and all claims, actions, suits, demands, losses, damages, liabilities, regulatory inquiries, fines, administrative penalties, and legal costs (calculated on a full-indemnity solicitor-and-own-client basis) arising out of or related to:
- Any disputed, incorrect, fraudulent, or non-existent invoice balance uploaded by Merchant;
- Any claim alleging that Merchant's use of the Platform constitutes unlicensed collection agency activity under the CDSSA;
- Any violation by Merchant of the Ontario Consumer Protection Act, Canada's Anti-Spam Legislation (CASL), or the Personal Information Protection and Electronic Documents Act (PIPEDA);
- Any EFT/PAD return, chargeback, dishonour, or Non-Sufficient Funds (NSF) occurrence;
- Any regulatory investigation initiated by the Ministry of Public and Business Service Delivery and Procurement.

### 3.2 Defense Control
Provider reserves the right, at Merchant's sole expense, to assume the exclusive defense and control of any matter subject to indemnification by Merchant.

## 4. Absolute Limitation of Liability

### 4.1 Waiver of Consequential Damages
To the maximum extent permitted by Ontario law, Provider shall have zero liability to Merchant or any third party for any indirect, incidental, consequential, special, punitive, or exemplary damages, or for loss of profits, revenue, data, goodwill, or commercial reputation.

### 4.2 Aggregate Liability Cap
The aggregate, cumulative liability of ${PROVIDER.legalName} for all claims of any kind arising out of or related to this Agreement or the Platform, regardless of the form of action (whether in contract, tort, gross negligence, or statutory duty), shall be strictly capped at the lesser of: (a) $100.00 CAD, or (b) the total platform application fees actually received by Provider from Merchant in the three (3) months preceding the incident giving rise to liability.

## 5. Governing Law and Exclusive Forum
This Agreement and any dispute arising out of or in connection with it shall be governed exclusively by the laws of the Province of Ontario and the federal laws of Canada applicable therein. The parties irrevocably attorn to the exclusive personal jurisdiction of the courts of the Province of Ontario sitting in the Judicial District of Durham or the City of Toronto.

---
*Document version: ${SAAS_AGREEMENT_VERSION}*
`;
}

/** Plain-text body for acceptance audit / email. */
export function saasAgreementPlainText() {
  return saasAgreementMarkdown()
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "");
}
