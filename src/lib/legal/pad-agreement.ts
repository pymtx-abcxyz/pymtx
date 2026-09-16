import { LEGAL_DOC_VERSIONS, PROVIDER } from "./provider";

export const PAD_AGREEMENT_VERSION = LEGAL_DOC_VERSIONS.pad;

export type PadAgreementVars = {
  customerFullName: string;
  customerAddress: string;
  customerEmail: string;
  merchantLegalName: string;
  merchantPhysicalAddress: string;
  merchantSupportEmail: string;
  merchantPhone: string;
  fiNumber: string;
  transitNumber: string;
  accountLast4: string;
  totalPrincipalCad: string;
  tenureMonths: number;
  monthlyInstallmentCad: string;
  firstDebitDate: string;
  dayOfMonth: number | string;
};

export const PAD_RECOURSE_CLAUSE = `You have certain recourse rights if any debit does not comply with this agreement. For example, you have the right to receive reimbursement for any debit that is not authorized or is not consistent with this PAD agreement. To obtain more information on your recourse rights, contact your financial institution or visit www.payments.ca. (For Personal PADs, claims for reimbursement must be submitted to your financial institution within 90 calendar days of the debit date).`;

export const PAD_CANCELLATION_CLAUSE = `This PAD Agreement remains in effect until the balance is paid in full or until cancelled by the Payor. The Payor may revoke this debit authorization at any time upon providing thirty (30) calendar days' written notice to the Payee, or by executing a cancellation inside the client portal. Revoking this authorization does not cancel, reduce, or extinguish the underlying debt obligation owed to the Payee; alternative payment arrangements must be made. To obtain a sample cancellation form or learn more about your right to cancel a PAD agreement, contact your financial institution or visit www.payments.ca.`;

export const PAD_PRENOTIFICATION_WAIVER = `Because the payment amount and intervals are fixed, I/we agree to waive the statutory requirement under Payments Canada Rule H1 to receive written pre-notification ten (10) calendar days prior to each recurring debit. Pre-notification will only be delivered in the event that the processing date or amount is modified (including an authorized skip-a-payment adjustment).`;

export const PAD_SKIP_CLAUSE = `Under the terms of this settlement plan, the Payor may defer one (1) scheduled monthly installment every six (6) months (180 calendar days), provided the request is submitted via the online client portal at least three (3) business days prior to the scheduled debit date. When a payment is skipped: (a) the scheduled debit for that month will not execute; (b) the term of this agreement will automatically extend by one (1) additional calendar month; (c) an updated amortization schedule will be delivered to the Payor's email on record.`;

/**
 * Document 2 — Consumer Personal PAD Agreement (Payments Canada Rule H1).
 */
export function renderPadAgreement(vars: PadAgreementVars) {
  const v = {
    ...vars,
    customerAddress: vars.customerAddress || "Ontario, Canada",
    merchantPhysicalAddress:
      vars.merchantPhysicalAddress || "Ontario, Canada",
    merchantSupportEmail: vars.merchantSupportEmail || vars.merchantLegalName,
    merchantPhone: vars.merchantPhone || "—",
    fiNumber: vars.fiNumber || "—",
    transitNumber: vars.transitNumber || "—",
  };

  return `PRE-AUTHORIZED DEBIT (PAD) AGREEMENT – PERSONAL / FIXED TERM
Governed by Payments Canada Rule H1
Document version: ${PAD_AGREEMENT_VERSION}

1. IDENTIFICATION OF PARTIES

Payor (Customer): ${v.customerFullName}
Billing Address: ${v.customerAddress}
Email: ${v.customerEmail}

Payee (Creditor & Merchant of Record):
${v.merchantLegalName}
${v.merchantPhysicalAddress}
Support Contact: ${v.merchantSupportEmail} | ${v.merchantPhone}

Electronic Processing Agent:
${PROVIDER.legalName}
${PROVIDER.addressLine} (${PROVIDER.email})
(Acting strictly as an automated technological and transmission conduit on behalf of the Payee)

2. AUTHORITY TO DEBIT

I/We authorize ${v.merchantLegalName} (the "Payee"), through its payment processing technology, to debit my/our designated Canadian financial institution account:
- Financial Institution Number (3 digits): ${v.fiNumber}
- Transit / Branch Number (5 digits): ${v.transitNumber}
- Account Number: *******${v.accountLast4}

3. PAYMENT SCHEDULE & TERMS

- Category: Personal PAD
- Total Settlement Principal: ${v.totalPrincipalCad} CAD
- Settlement Term: ${v.tenureMonths} equal consecutive monthly payments
- Monthly Installment Amount: ${v.monthlyInstallmentCad} CAD
- First Debit Date: ${v.firstDebitDate}
- Subsequent Debits: Processed on the ${v.dayOfMonth} of each subsequent month until the balance is settled in full.

4. SKIP-A-PAYMENT ADJUSTMENT TERMS

${PAD_SKIP_CLAUSE}

5. PRE-NOTIFICATION WAIVER

${PAD_PRENOTIFICATION_WAIVER}

6. CANCELLATION OF AGREEMENT

${PAD_CANCELLATION_CLAUSE}

7. MANDATORY STATUTORY RECOURSE (PAYMENTS CANADA RULE H1)

"${PAD_RECOURSE_CLAUSE}"
`;
}
