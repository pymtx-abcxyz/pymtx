from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from enum import Enum
from typing import Mapping

from pymtx.errors import MoneyError

CENTS = Decimal("0.01")
ZERO = Decimal("0.00")


def as_money(value: Decimal | int | str) -> Decimal:
    """Normalize a money value to cents with half-up rounding.

    ``float`` is rejected so binary floating-point cannot silently skew AR.
    """
    if isinstance(value, float):
        raise MoneyError("float is not allowed for money; use Decimal, int, or str")
    if isinstance(value, Decimal):
        amount = value
    elif isinstance(value, int):
        amount = Decimal(value)
    elif isinstance(value, str):
        try:
            amount = Decimal(value)
        except Exception as exc:  # noqa: BLE001 - Decimal raises several types
            raise MoneyError(f"invalid money value: {value!r}") from exc
    else:
        raise MoneyError(f"unsupported money type: {type(value).__name__}")
    if not amount.is_finite():
        raise MoneyError("money must be a finite number")
    quantized = amount.quantize(CENTS, rounding=ROUND_HALF_UP)
    if quantized < ZERO:
        raise MoneyError("money amount must be >= 0")
    return quantized


class ReceiptType(str, Enum):
    PAYMENT = "payment"
    CREDIT_MEMO = "credit_memo"


class Strategy(str, Enum):
    OLDEST_DUE = "oldest_due"
    LARGEST_FIRST = "largest_first"
    DOCUMENT_ORDER = "document_order"


@dataclass(frozen=True, slots=True)
class Invoice:
    id: str
    customer_id: str
    amount: Decimal
    due_date: date
    currency: str = "USD"
    document_date: date | None = None

    def __post_init__(self) -> None:
        _require_id(self.id, "invoice id")
        _require_id(self.customer_id, "customer id")
        _require_currency(self.currency)
        object.__setattr__(self, "amount", as_money(self.amount))
        if self.amount == ZERO:
            raise MoneyError("invoice amount must be > 0")

    @property
    def effective_date(self) -> date:
        return self.document_date or self.due_date


@dataclass(frozen=True, slots=True)
class Receipt:
    """A payment or credit memo that can settle open invoices."""

    id: str
    customer_id: str
    amount: Decimal
    receipt_date: date
    currency: str = "USD"
    receipt_type: ReceiptType = ReceiptType.PAYMENT

    def __post_init__(self) -> None:
        _require_id(self.id, "receipt id")
        _require_id(self.customer_id, "customer id")
        _require_currency(self.currency)
        if not isinstance(self.receipt_type, ReceiptType):
            object.__setattr__(self, "receipt_type", ReceiptType(self.receipt_type))
        object.__setattr__(self, "amount", as_money(self.amount))
        if self.amount == ZERO:
            raise MoneyError("receipt amount must be > 0")


@dataclass(frozen=True, slots=True)
class Allocation:
    receipt_id: str
    invoice_id: str
    amount: Decimal

    def __post_init__(self) -> None:
        _require_id(self.receipt_id, "receipt id")
        _require_id(self.invoice_id, "invoice id")
        object.__setattr__(self, "amount", as_money(self.amount))
        if self.amount == ZERO:
            raise MoneyError("allocation amount must be > 0")


@dataclass(frozen=True, slots=True)
class OpenBalance:
    document_id: str
    remaining: Decimal


@dataclass(frozen=True, slots=True)
class SettlementResult:
    allocations: tuple[Allocation, ...]
    invoice_balances: Mapping[str, Decimal]
    unapplied_receipts: Mapping[str, Decimal]

    @property
    def fully_settled_invoices(self) -> tuple[str, ...]:
        return tuple(
            invoice_id
            for invoice_id, remaining in self.invoice_balances.items()
            if remaining == ZERO
        )

    @property
    def open_invoices(self) -> tuple[str, ...]:
        return tuple(
            invoice_id
            for invoice_id, remaining in self.invoice_balances.items()
            if remaining > ZERO
        )

    @property
    def unapplied_receipt_ids(self) -> tuple[str, ...]:
        return tuple(
            receipt_id
            for receipt_id, remaining in self.unapplied_receipts.items()
            if remaining > ZERO
        )

    @property
    def total_applied(self) -> Decimal:
        total = ZERO
        for allocation in self.allocations:
            total += allocation.amount
        return total.quantize(CENTS)


def _require_id(value: str, label: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise MoneyError(f"{label} is required")


def _require_currency(value: str) -> None:
    if not isinstance(value, str) or len(value.strip()) != 3 or not value.isalpha():
        raise MoneyError("currency must be a 3-letter code")
