import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

const navy = "#2a2725";
const mist = "#fffecb";
const sage = "#fea82f";

function Shell(props: {
  preview: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Preview>{props.preview}</Preview>
      <Body style={{ backgroundColor: navy, margin: 0, padding: "32px 16px" }}>
        <Container style={{ maxWidth: 480, margin: "0 auto" }}>
          <Text
            style={{
              color: sage,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            {props.eyebrow}
          </Text>
          <Heading
            style={{
              color: mist,
              fontSize: 22,
              lineHeight: "1.3",
              margin: "12px 0 16px",
            }}
          >
            {props.title}
          </Heading>
          <Section>{props.children}</Section>
          <Hr style={{ borderColor: "rgba(84,72,200,0.35)", margin: "28px 0 12px" }} />
          <Text style={{ color: sage, fontSize: 11, lineHeight: "1.5", margin: 0 }}>
            1001527397 ONTARIO INC. · MB055-70 Taunton Rd E, Whitby, ON L1R 3L5 ·
            info@pymtx.com
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ color: sage, fontSize: 14, lineHeight: "1.55", margin: "0 0 10px" }}>
      {children}
    </Text>
  );
}

function formatCad(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

export function PadConfirmationEmail(props: {
  tradeName: string;
  invoiceRef: string;
  firstDebitDate: string;
  monthlyAmountCents: number;
  bankLast4: string;
}) {
  return (
    <Shell
      preview={`PAD confirmation from ${props.tradeName}`}
      eyebrow={props.tradeName}
      title="Personal PAD confirmation"
    >
      <Line>
        Written confirmation of your Pre-Authorized Debit with{" "}
        <strong style={{ color: mist }}>{props.tradeName}</strong> (Merchant of
        Record).
      </Line>
      <Line>Invoice {props.invoiceRef}</Line>
      <Line>{formatCad(props.monthlyAmountCents)} monthly</Line>
      <Line>Account •••• {props.bankLast4}</Line>
      <Line>First debit on or after {props.firstDebitDate}</Line>
      <Line>
        Cancel with at least 10 days&apos; written notice before a scheduled debit
        (Payments Canada Rule H1). A PDF copy of this mandate is attached.
      </Line>
    </Shell>
  );
}

export function ReceiptEmail(props: {
  tradeName: string;
  invoiceRef: string;
  amountCents: number;
  sequence: number;
  paidAt: string;
}) {
  return (
    <Shell
      preview={`Payment receipt from ${props.tradeName}`}
      eyebrow={props.tradeName}
      title="Payment receipt"
    >
      <Line>We received your installment payment.</Line>
      <Line>Invoice {props.invoiceRef}</Line>
      <Line>
        Installment #{props.sequence}: {formatCad(props.amountCents)}
      </Line>
      <Line>Date {props.paidAt}</Line>
    </Shell>
  );
}

export function NsfAlertEmail(props: {
  tradeName: string;
  invoiceRef: string;
  amountCents: number;
  sequence: number;
  retryAvailable: boolean;
}) {
  const retryLine = props.retryAvailable
    ? "One re-presentment may be attempted within 30 days (Payments Canada Rule H1)."
    : "No further automatic re-presentment will be attempted for this installment.";
  return (
    <Shell
      preview={`Payment unsuccessful — ${props.tradeName}`}
      eyebrow={props.tradeName}
      title="Payment unsuccessful"
    >
      <Line>
        A Pre-Authorized Debit could not be completed (often NSF).
      </Line>
      <Line>Invoice {props.invoiceRef}</Line>
      <Line>
        Installment #{props.sequence}: {formatCad(props.amountCents)}
      </Line>
      <Line>{retryLine}</Line>
    </Shell>
  );
}

export function SkipConfirmationEmail(props: {
  tradeName: string;
  amountCents: number;
  skippedDue: string;
  appendedSequence: number;
  appendedDue: string;
  nextSkipAvailable: string;
}) {
  return (
    <Shell
      preview={`Payment skip confirmed — ${props.tradeName}`}
      eyebrow={props.tradeName}
      title="Payment skip confirmed"
    >
      <Line>
        Your {formatCad(props.amountCents)} debit due {props.skippedDue} was
        skipped.
      </Line>
      <Line>
        Replacement installment #{props.appendedSequence} is scheduled for{" "}
        {props.appendedDue}.
      </Line>
      <Line>Next skip available {props.nextSkipAvailable}.</Line>
    </Shell>
  );
}
