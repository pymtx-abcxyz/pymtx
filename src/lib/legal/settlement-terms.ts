import { LEGAL_DOC_VERSIONS, PROVIDER } from "./provider";

export const SETTLEMENT_TERMS_VERSION = LEGAL_DOC_VERSIONS.settlement;

export type SettlementTermsVars = {
  merchantLegalName: string;
  customerFullName: string;
  totalInvoiceBalanceCad: string;
  monthlyAmountCad: string;
  tenureMonths: number;
};

/**
 * Document 3 — Consumer Settlement Terms & Cost of Credit Disclosure
 * (Ontario CPA / Limitations Act, 2002).
 */
export function renderSettlementTerms(vars: SettlementTermsVars) {
  return `CONSUMER SETTLEMENT TERMS & COST OF CREDIT DISCLOSURE
Governing Legislation: Ontario Consumer Protection Act (CPA) and Limitations Act, 2002
Document version: ${SETTLEMENT_TERMS_VERSION}

Creditor (Merchant of Record): ${vars.merchantLegalName}
Debtor (Customer): ${vars.customerFullName}
Technological Intermediary: ${PROVIDER.legalName}

1. MANDATORY STATEMENT OF CREDIT (TABULAR DISCLOSURE)

Principal Outstanding Balance: ${vars.totalInvoiceBalanceCad} CAD
Cost of Borrowing / Finance Charges: $0.00 CAD
Annual Percentage Rate (APR): 0.00%
Monthly Installment Amount: ${vars.monthlyAmountCad} CAD
Payment Frequency & Term: ${vars.tenureMonths} Monthly Payments
Total Sum Payable: ${vars.totalInvoiceBalanceCad} CAD
Administrative or Platform Fees: $0.00 CAD
Default / NSF Fees: $0.00 CAD (Pass-through banking return fees only)

2. LEGAL NATURE OF THE AGREEMENT & STATUTORY DISCLAIMERS

Statutory Debt Acknowledgment (Limitations Act, 2002): The Debtor understands and acknowledges that electing a payment schedule and executing partial payment through this portal constitutes formal, written acknowledgment of the debt owed to ${vars.merchantLegalName}. Under the laws of Ontario, this action legally resets the statutory two-year limitation period from the date of this electronic execution.

Non-Novation: Entering into this payment arrangement provides an agreed forbearance schedule so long as installments remain in good standing, but does not extinguish or novate the underlying commercial claim until paid in full.

Zero Liability for Platform Provider: The Debtor acknowledges that ${PROVIDER.legalName} is an independent software licensor that owns no beneficial interest in the debt, owes no fiduciary duty, and has no liability to the Debtor regarding the quality, delivery, or legality of the underlying goods or services provided by ${vars.merchantLegalName}.

Dispute Freezes: The Debtor maintains the right to register a formal dispute within the portal. Disputing an account immediately halts automated recurring debits pending direct review and document verification by ${vars.merchantLegalName}.
`;
}
