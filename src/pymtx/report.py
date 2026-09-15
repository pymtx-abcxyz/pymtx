"""Format settlement results for humans and downstream systems."""

from __future__ import annotations

import csv
import io
from collections import defaultdict
from decimal import Decimal
from typing import Sequence

from pymtx.models import (
    CENTS,
    ZERO,
    Invoice,
    Receipt,
    SettlementResult,
)


def group_totals(
    invoices: Sequence[Invoice],
    receipts: Sequence[Receipt],
    result: SettlementResult,
) -> list[dict[str, str]]:
    """Summarize open AR and unapplied cash by customer and currency."""
    invoice_meta = {invoice.id: invoice for invoice in invoices}
    receipt_meta = {receipt.id: receipt for receipt in receipts}
    buckets: dict[tuple[str, str], dict[str, Decimal]] = defaultdict(
        lambda: {
            "open_ar": ZERO,
            "unapplied_cash": ZERO,
            "applied": ZERO,
            "invoice_count": ZERO,
            "receipt_count": ZERO,
        }
    )

    for invoice_id, remaining in result.invoice_balances.items():
        invoice = invoice_meta[invoice_id]
        key = (invoice.customer_id, invoice.currency)
        buckets[key]["open_ar"] += remaining
        buckets[key]["invoice_count"] += Decimal(1)

    for receipt_id, remaining in result.unapplied_receipts.items():
        receipt = receipt_meta[receipt_id]
        key = (receipt.customer_id, receipt.currency)
        buckets[key]["unapplied_cash"] += remaining
        buckets[key]["receipt_count"] += Decimal(1)

    for allocation in result.allocations:
        invoice = invoice_meta[allocation.invoice_id]
        key = (invoice.customer_id, invoice.currency)
        buckets[key]["applied"] += allocation.amount

    rows: list[dict[str, str]] = []
    for customer_id, currency in sorted(buckets):
        totals = buckets[(customer_id, currency)]
        rows.append(
            {
                "customer_id": customer_id,
                "currency": currency,
                "open_ar": str(totals["open_ar"].quantize(CENTS)),
                "unapplied_cash": str(totals["unapplied_cash"].quantize(CENTS)),
                "applied": str(totals["applied"].quantize(CENTS)),
                "invoices": str(int(totals["invoice_count"])),
                "receipts": str(int(totals["receipt_count"])),
            }
        )
    return rows


def result_to_dict(
    result: SettlementResult,
    *,
    invoices: Sequence[Invoice] | None = None,
    receipts: Sequence[Receipt] | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "allocations": [
            {
                "receipt_id": allocation.receipt_id,
                "invoice_id": allocation.invoice_id,
                "amount": str(allocation.amount),
            }
            for allocation in result.allocations
        ],
        "invoice_balances": {
            invoice_id: str(remaining)
            for invoice_id, remaining in result.invoice_balances.items()
        },
        "unapplied_receipts": {
            receipt_id: str(remaining)
            for receipt_id, remaining in result.unapplied_receipts.items()
        },
        "fully_settled_invoices": list(result.fully_settled_invoices),
        "open_invoices": list(result.open_invoices),
        "unapplied_receipt_ids": list(result.unapplied_receipt_ids),
        "total_applied": str(result.total_applied),
    }
    if invoices is not None and receipts is not None:
        payload["by_customer"] = group_totals(invoices, receipts, result)
    return payload


def format_text(
    result: SettlementResult,
    *,
    invoices: Sequence[Invoice] | None = None,
    receipts: Sequence[Receipt] | None = None,
) -> str:
    lines = [
        f"Applied: {result.total_applied}",
        f"Allocations: {len(result.allocations)}",
        f"Fully settled invoices: {len(result.fully_settled_invoices)}",
        f"Open invoices: {len(result.open_invoices)}",
        f"Unapplied receipts: {len(result.unapplied_receipt_ids)}",
        "",
        "Allocations",
    ]
    if result.allocations:
        for allocation in result.allocations:
            lines.append(
                f"  {allocation.receipt_id} -> {allocation.invoice_id}  {allocation.amount}"
            )
    else:
        lines.append("  (none)")

    lines.extend(["", "Open invoice balances"])
    if result.open_invoices:
        for invoice_id in result.open_invoices:
            lines.append(f"  {invoice_id}  {result.invoice_balances[invoice_id]}")
    else:
        lines.append("  (none)")

    lines.extend(["", "Unapplied receipts"])
    if result.unapplied_receipt_ids:
        for receipt_id in result.unapplied_receipt_ids:
            lines.append(f"  {receipt_id}  {result.unapplied_receipts[receipt_id]}")
    else:
        lines.append("  (none)")

    if invoices is not None and receipts is not None:
        lines.extend(["", "By customer / currency"])
        for row in group_totals(invoices, receipts, result):
            lines.append(
                f"  {row['customer_id']} {row['currency']}: "
                f"open_ar={row['open_ar']} unapplied={row['unapplied_cash']} "
                f"applied={row['applied']}"
            )

    return "\n".join(lines) + "\n"


def format_csv(
    result: SettlementResult,
    *,
    invoices: Sequence[Invoice] | None = None,
    receipts: Sequence[Receipt] | None = None,
) -> str:
    invoice_meta = {invoice.id: invoice for invoice in invoices or ()}
    receipt_meta = {receipt.id: receipt for receipt in receipts or ()}
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["section", "receipt_id", "invoice_id", "amount", "customer_id", "currency"])
    for allocation in result.allocations:
        invoice = invoice_meta.get(allocation.invoice_id)
        writer.writerow(
            [
                "allocation",
                allocation.receipt_id,
                allocation.invoice_id,
                str(allocation.amount),
                invoice.customer_id if invoice else "",
                invoice.currency if invoice else "",
            ]
        )
    for invoice_id, remaining in result.invoice_balances.items():
        if remaining == ZERO:
            continue
        invoice = invoice_meta.get(invoice_id)
        writer.writerow(
            [
                "open_invoice",
                "",
                invoice_id,
                str(remaining),
                invoice.customer_id if invoice else "",
                invoice.currency if invoice else "",
            ]
        )
    for receipt_id, remaining in result.unapplied_receipts.items():
        if remaining == ZERO:
            continue
        receipt = receipt_meta.get(receipt_id)
        writer.writerow(
            [
                "unapplied_receipt",
                receipt_id,
                "",
                str(remaining),
                receipt.customer_id if receipt else "",
                receipt.currency if receipt else "",
            ]
        )
    return buffer.getvalue()
