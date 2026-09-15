"""pymtx — accounts receivable settlement."""

from pymtx.engine import settle
from pymtx.errors import (
    CurrencyMismatch,
    CustomerMismatch,
    MoneyError,
    OverAllocation,
    SettlementError,
    UnknownDocument,
)
from pymtx.models import Allocation, Invoice, Receipt, ReceiptType, SettlementResult, Strategy
from pymtx.report import format_csv, format_text, group_totals, result_to_dict

__all__ = [
    "Allocation",
    "CurrencyMismatch",
    "CustomerMismatch",
    "Invoice",
    "MoneyError",
    "OverAllocation",
    "Receipt",
    "ReceiptType",
    "SettlementError",
    "SettlementResult",
    "Strategy",
    "UnknownDocument",
    "format_csv",
    "format_text",
    "group_totals",
    "result_to_dict",
    "settle",
]

__version__ = "0.1.1"
