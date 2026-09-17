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

/** HIG email tokens — light canvas, WCAG AA+ on card (matches tokens.css light). */
const canvas = "#f5f7f5";
const card = "#ffffff";
const textPrimary = "#202b31";
const textSecondary = "#30484a";
const textMuted = "#4e6260";
const borderSubtle = "#cad2c5";
const danger = "#b3261e";

function Shell(props: {
  preview: string;
  eyebrow: string;
  title: string;
  titleTone?: "default" | "danger";
  children: React.ReactNode;
}) {
  const titleColor = props.titleTone === "danger" ? danger : textPrimary;
  return (
    <Html>
      <Head />
      <Preview>{props.preview}</Preview>
      <Body
        style={{
          backgroundColor: canvas,
          margin: 0,
          padding: "32px 16px",
          fontFamily:
            "ui-monospace, Cascadia Code, SF Mono, Menlo, Consolas, monospace",
        }}
      >
        <Container
          style={{
            maxWidth: 480,
            margin: "0 auto",
            backgroundColor: card,
            borderRadius: 12,
            border: `1px solid ${borderSubtle}`,
            padding: "28px 24px",
          }}
        >
          <Text
            style={{
              color: textMuted,
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
              color: titleColor,
              fontSize: 22,
              lineHeight: "1.3",
              margin: "12px 0 16px",
            }}
          >
            {props.title}
          </Heading>
          <Section>{props.children}</Section>
          <Hr style={{ borderColor: borderSubtle, margin: "28px 0 12px" }} />
          <Text style={{ color: textMuted, fontSize: 11, lineHeight: "1.5", margin: 0 }}>
            Sent on behalf of the Merchant of Record named above. Reply to the
            merchant support address when provided. Technology: 1001527397
            ONTARIO INC. · MB055-70 Taunton Rd E, Whitby, ON L1R 3L5 ·
            info@pymtx.com. CASL transactional notice under an Existing Business
            Relationship.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{ color: textSecondary, fontSize: 14, lineHeight: "1.55", margin: "0 0 10px" }}
    >
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

export function InviteEmail(props: {
  tradeName: string;
  firstName: string;
  invoiceRef: string;
  amountCents: number;
  inviteUrl: string;
}) {
  return (
    <Shell
      preview={`Settle your balance with ${props.tradeName}`}
      eyebrow={props.tradeName}
      title="Settle your balance"
    >
      <Line>Hello {props.firstName},</Line>
      <Line>
        <strong style={{ color: textPrimary }}>{props.tradeName}</strong> invited
        you to settle invoice {props.invoiceRef} (
        {formatCad(props.amountCents)} past due).
      </Line>
      <Line>
        <a href={props.inviteUrl} style={{ color: textPrimary }}>
          Open your secure plan link
        </a>
      </Line>
    </Shell>
  );
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
        <strong style={{ color: textPrimary }}>{props.tradeName}</strong> (Merchant of
        Record).
      </Line>
      <Line>Invoice {props.invoiceRef}</Line>
      <Line>{formatCad(props.monthlyAmountCents)} monthly</Line>
      <Line>Account •••• {props.bankLast4}</Line>
      <Line>First debit on or after {props.firstDebitDate}</Line>
      <Line>
        Cancel with thirty (30) calendar days&apos; written notice, or inside the
        client portal (Payments Canada Rule H1). Cancelling the PAD does not
        extinguish the underlying debt. A PDF copy of this mandate is attached.
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
      titleTone="danger"
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
