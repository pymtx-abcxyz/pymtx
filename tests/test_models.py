from datetime import date
from decimal import Decimal

import pytest

from pymtx.models import Invoice, MoneyError, Receipt, ReceiptType, as_money


def test_as_money_quantizes_half_up() -> None:
    assert as_money("10.005") == Decimal("10.01")
    assert as_money("10.004") == Decimal("10.00")
    assert as_money(3) == Decimal("3.00")


def test_as_money_rejects_float_and_negative() -> None:
    with pytest.raises(MoneyError):
        as_money(1.5)  # type: ignore[arg-type]
    with pytest.raises(MoneyError):
        as_money("-1.00")
    with pytest.raises(MoneyError):
        as_money("n/a")


def test_invoice_requires_positive_amount_and_currency() -> None:
    with pytest.raises(MoneyError):
        Invoice("INV-1", "C1", "0.00", date(2026, 1, 1))
    with pytest.raises(MoneyError):
        Invoice("INV-1", "C1", "10.00", date(2026, 1, 1), currency="US")
    with pytest.raises(MoneyError):
        Invoice("", "C1", "10.00", date(2026, 1, 1))


def test_receipt_normalizes_type() -> None:
    receipt = Receipt(
        "CM-1",
        "C1",
        "5.00",
        date(2026, 1, 2),
        receipt_type="credit_memo",
    )
    assert receipt.receipt_type is ReceiptType.CREDIT_MEMO
    assert receipt.amount == Decimal("5.00")
