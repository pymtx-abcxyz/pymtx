from datetime import date
from decimal import Decimal

import pytest

from pymtx import (
    Allocation,
    CurrencyMismatch,
    CustomerMismatch,
    Invoice,
    OverAllocation,
    Receipt,
    ReceiptType,
    SettlementError,
    Strategy,
    UnknownDocument,
    settle,
)


def _inv(doc_id: str, amount: str, due: date, customer: str = "C1") -> Invoice:
    return Invoice(doc_id, customer, amount, due)


def _pmt(doc_id: str, amount: str, when: date, customer: str = "C1") -> Receipt:
    return Receipt(doc_id, customer, amount, when)


def test_full_and_partial_fifo_settlement() -> None:
    invoices = [
        _inv("INV-1", "100.00", date(2026, 1, 10)),
        _inv("INV-2", "40.00", date(2026, 1, 20)),
    ]
    receipts = [_pmt("PMT-1", "120.00", date(2026, 1, 25))]

    result = settle(invoices, receipts)

    assert [(a.receipt_id, a.invoice_id, a.amount) for a in result.allocations] == [
        ("PMT-1", "INV-1", Decimal("100.00")),
        ("PMT-1", "INV-2", Decimal("20.00")),
    ]
    assert result.invoice_balances["INV-1"] == Decimal("0.00")
    assert result.invoice_balances["INV-2"] == Decimal("20.00")
    assert result.unapplied_receipts["PMT-1"] == Decimal("0.00")
    assert result.fully_settled_invoices == ("INV-1",)
    assert result.total_applied == Decimal("120.00")


def test_overpayment_stays_unapplied() -> None:
    result = settle(
        [_inv("INV-1", "50.00", date(2026, 1, 1))],
        [_pmt("PMT-1", "80.00", date(2026, 1, 2))],
    )
    assert result.invoice_balances["INV-1"] == Decimal("0.00")
    assert result.unapplied_receipts["PMT-1"] == Decimal("30.00")


def test_largest_first_strategy() -> None:
    invoices = [
        _inv("SMALL", "10.00", date(2026, 1, 1)),
        _inv("LARGE", "90.00", date(2026, 1, 15)),
    ]
    result = settle(
        invoices,
        [_pmt("PMT-1", "90.00", date(2026, 2, 1))],
        strategy=Strategy.LARGEST_FIRST,
    )
    assert result.fully_settled_invoices == ("LARGE",)
    assert result.invoice_balances["SMALL"] == Decimal("10.00")


def test_document_order_strategy() -> None:
    invoices = [
        _inv("LATER", "10.00", date(2026, 3, 1)),
        _inv("EARLIER", "10.00", date(2026, 1, 1)),
    ]
    result = settle(
        invoices,
        [_pmt("PMT-1", "10.00", date(2026, 4, 1))],
        strategy=Strategy.DOCUMENT_ORDER,
    )
    assert result.fully_settled_invoices == ("LATER",)


def test_customers_are_isolated() -> None:
    invoices = [
        _inv("A-1", "10.00", date(2026, 1, 1), customer="A"),
        _inv("B-1", "10.00", date(2026, 1, 1), customer="B"),
    ]
    receipts = [_pmt("P-A", "10.00", date(2026, 1, 2), customer="A")]
    result = settle(invoices, receipts)
    assert result.invoice_balances["A-1"] == Decimal("0.00")
    assert result.invoice_balances["B-1"] == Decimal("10.00")
    assert result.unapplied_receipts["P-A"] == Decimal("0.00")


def test_currencies_are_isolated() -> None:
    usd = Invoice("USD-1", "C1", "10.00", date(2026, 1, 1), currency="USD")
    eur = Invoice("EUR-1", "C1", "10.00", date(2026, 1, 1), currency="EUR")
    payment = Receipt("P-USD", "C1", "10.00", date(2026, 1, 2), currency="USD")
    result = settle([usd, eur], [payment])
    assert result.invoice_balances["USD-1"] == Decimal("0.00")
    assert result.invoice_balances["EUR-1"] == Decimal("10.00")


def test_credit_memo_settles_like_payment() -> None:
    invoices = [_inv("INV-1", "25.00", date(2026, 1, 1))]
    credit = Receipt(
        "CM-1",
        "C1",
        "25.00",
        date(2026, 1, 2),
        receipt_type=ReceiptType.CREDIT_MEMO,
    )
    result = settle(invoices, [credit])
    assert result.invoice_balances["INV-1"] == Decimal("0.00")
    assert result.allocations[0].receipt_id == "CM-1"


def test_explicit_allocations_and_remaining_cash() -> None:
    invoices = [
        _inv("INV-1", "100.00", date(2026, 1, 1)),
        _inv("INV-2", "100.00", date(2026, 1, 2)),
    ]
    receipts = [_pmt("PMT-1", "80.00", date(2026, 1, 3))]
    result = settle(
        invoices,
        receipts,
        allocations=[Allocation("PMT-1", "INV-2", "50.00")],
    )
    assert result.allocations == (Allocation("PMT-1", "INV-2", Decimal("50.00")),)
    assert result.invoice_balances["INV-1"] == Decimal("100.00")
    assert result.invoice_balances["INV-2"] == Decimal("50.00")
    assert result.unapplied_receipts["PMT-1"] == Decimal("30.00")


def test_explicit_allocation_rejects_customer_mismatch() -> None:
    with pytest.raises(CustomerMismatch):
        settle(
            [_inv("INV-1", "10.00", date(2026, 1, 1), customer="A")],
            [_pmt("PMT-1", "10.00", date(2026, 1, 1), customer="B")],
            allocations=[Allocation("PMT-1", "INV-1", "10.00")],
        )


def test_explicit_allocation_rejects_currency_mismatch() -> None:
    invoice = Invoice("INV-1", "C1", "10.00", date(2026, 1, 1), currency="USD")
    receipt = Receipt("PMT-1", "C1", "10.00", date(2026, 1, 1), currency="EUR")
    with pytest.raises(CurrencyMismatch):
        settle(
            [invoice],
            [receipt],
            allocations=[Allocation("PMT-1", "INV-1", "10.00")],
        )


def test_explicit_allocation_rejects_over_apply_and_unknown() -> None:
    invoices = [_inv("INV-1", "10.00", date(2026, 1, 1))]
    receipts = [_pmt("PMT-1", "10.00", date(2026, 1, 1))]
    with pytest.raises(OverAllocation):
        settle(
            invoices,
            receipts,
            allocations=[Allocation("PMT-1", "INV-1", "10.01")],
        )
    with pytest.raises(UnknownDocument):
        settle(
            invoices,
            receipts,
            allocations=[Allocation("PMT-1", "MISSING", "1.00")],
        )


def test_duplicate_ids_rejected() -> None:
    with pytest.raises(SettlementError, match="duplicate invoice"):
        settle(
            [
                _inv("INV-1", "10.00", date(2026, 1, 1)),
                _inv("INV-1", "5.00", date(2026, 1, 2)),
            ],
            [],
        )
