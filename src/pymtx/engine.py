from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Sequence
from decimal import Decimal

from pymtx.errors import (
    CurrencyMismatch,
    CustomerMismatch,
    OverAllocation,
    SettlementError,
    UnknownDocument,
)
from pymtx.models import (
    ZERO,
    Allocation,
    Invoice,
    Receipt,
    SettlementResult,
    Strategy,
    as_money,
)


def settle(
    invoices: Sequence[Invoice],
    receipts: Sequence[Receipt],
    *,
    strategy: Strategy | str = Strategy.OLDEST_DUE,
    allocations: Sequence[Allocation] | None = None,
) -> SettlementResult:
    """Apply receipts (payments and credit memos) to open invoices.

    When ``allocations`` is omitted, receipts are applied automatically inside
    each (customer, currency) group using ``strategy``. Explicit allocations
    skip auto-matching and are validated against remaining balances.
    """
    _ensure_unique_ids(invoices, "invoice")
    _ensure_unique_ids(receipts, "receipt")
    strategy = Strategy(strategy)

    invoice_remaining = {invoice.id: invoice.amount for invoice in invoices}
    receipt_remaining = {receipt.id: receipt.amount for receipt in receipts}
    invoices_by_id = {invoice.id: invoice for invoice in invoices}
    receipts_by_id = {receipt.id: receipt for receipt in receipts}

    if allocations is not None:
        applied = _apply_explicit(
            allocations,
            invoices_by_id=invoices_by_id,
            receipts_by_id=receipts_by_id,
            invoice_remaining=invoice_remaining,
            receipt_remaining=receipt_remaining,
        )
    else:
        applied = _apply_automatic(
            invoices,
            receipts,
            strategy=strategy,
            invoice_remaining=invoice_remaining,
            receipt_remaining=receipt_remaining,
        )

    return SettlementResult(
        allocations=tuple(applied),
        invoice_balances=dict(invoice_remaining),
        unapplied_receipts=dict(receipt_remaining),
    )


def _ensure_unique_ids(documents: Sequence[Invoice | Receipt], kind: str) -> None:
    seen: set[str] = set()
    for document in documents:
        if document.id in seen:
            raise SettlementError(f"duplicate {kind} id: {document.id}")
        seen.add(document.id)


def _apply_explicit(
    allocations: Sequence[Allocation],
    *,
    invoices_by_id: dict[str, Invoice],
    receipts_by_id: dict[str, Receipt],
    invoice_remaining: dict[str, Decimal],
    receipt_remaining: dict[str, Decimal],
) -> list[Allocation]:
    applied: list[Allocation] = []
    for allocation in allocations:
        invoice = invoices_by_id.get(allocation.invoice_id)
        receipt = receipts_by_id.get(allocation.receipt_id)
        if invoice is None:
            raise UnknownDocument(f"unknown invoice: {allocation.invoice_id}")
        if receipt is None:
            raise UnknownDocument(f"unknown receipt: {allocation.receipt_id}")
        if invoice.customer_id != receipt.customer_id:
            raise CustomerMismatch(
                f"receipt {receipt.id} and invoice {invoice.id} belong to different customers"
            )
        if invoice.currency != receipt.currency:
            raise CurrencyMismatch(
                f"receipt {receipt.id} ({receipt.currency}) cannot settle "
                f"invoice {invoice.id} ({invoice.currency})"
            )
        amount = as_money(allocation.amount)
        if amount > invoice_remaining[invoice.id]:
            raise OverAllocation(
                f"allocation {amount} exceeds remaining invoice {invoice.id} "
                f"({invoice_remaining[invoice.id]})"
            )
        if amount > receipt_remaining[receipt.id]:
            raise OverAllocation(
                f"allocation {amount} exceeds remaining receipt {receipt.id} "
                f"({receipt_remaining[receipt.id]})"
            )
        invoice_remaining[invoice.id] -= amount
        receipt_remaining[receipt.id] -= amount
        applied.append(Allocation(receipt.id, invoice.id, amount))
    return applied


def _apply_automatic(
    invoices: Sequence[Invoice],
    receipts: Sequence[Receipt],
    *,
    strategy: Strategy,
    invoice_remaining: dict[str, Decimal],
    receipt_remaining: dict[str, Decimal],
) -> list[Allocation]:
    groups: dict[tuple[str, str], dict[str, list]] = defaultdict(
        lambda: {"invoices": [], "receipts": []}
    )
    for invoice in invoices:
        groups[(invoice.customer_id, invoice.currency)]["invoices"].append(invoice)
    for receipt in receipts:
        groups[(receipt.customer_id, receipt.currency)]["receipts"].append(receipt)

    applied: list[Allocation] = []
    for group in groups.values():
        ordered_invoices = _sort_invoices(group["invoices"], strategy)
        ordered_receipts = sorted(
            group["receipts"], key=lambda receipt: (receipt.receipt_date, receipt.id)
        )
        invoice_index = 0
        for receipt in ordered_receipts:
            while (
                receipt_remaining[receipt.id] > ZERO
                and invoice_index < len(ordered_invoices)
            ):
                invoice = ordered_invoices[invoice_index]
                open_amount = invoice_remaining[invoice.id]
                if open_amount == ZERO:
                    invoice_index += 1
                    continue
                applied_amount = min(receipt_remaining[receipt.id], open_amount)
                invoice_remaining[invoice.id] -= applied_amount
                receipt_remaining[receipt.id] -= applied_amount
                applied.append(Allocation(receipt.id, invoice.id, applied_amount))
                if invoice_remaining[invoice.id] == ZERO:
                    invoice_index += 1
    return applied


def _sort_invoices(invoices: Iterable[Invoice], strategy: Strategy) -> list[Invoice]:
    if strategy is Strategy.DOCUMENT_ORDER:
        return list(invoices)
    if strategy is Strategy.LARGEST_FIRST:
        return sorted(invoices, key=lambda invoice: (-invoice.amount, invoice.due_date, invoice.id))
    return sorted(invoices, key=lambda invoice: (invoice.due_date, invoice.id))
