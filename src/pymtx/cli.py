from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Mapping, Sequence, TextIO

from pymtx.engine import settle
from pymtx.errors import SettlementError
from pymtx.models import (
    Allocation,
    Invoice,
    Receipt,
    ReceiptType,
    SettlementResult,
    Strategy,
)
from pymtx.report import format_csv, format_text, result_to_dict


def main(argv: Sequence[str] | None = None, stream: TextIO | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="pymtx",
        description="Settle accounts receivable: apply payments and credit memos to invoices.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    settle_parser = sub.add_parser("settle", help="Apply receipts to open invoices")
    settle_parser.add_argument("invoices", help="JSON file of invoices")
    settle_parser.add_argument("receipts", help="JSON file of payments/credit memos")
    settle_parser.add_argument(
        "--strategy",
        choices=[item.value for item in Strategy],
        default=Strategy.OLDEST_DUE.value,
    )
    settle_parser.add_argument(
        "--allocations",
        help="Optional JSON file of explicit allocations (skips auto-match)",
    )
    settle_parser.add_argument(
        "--format",
        choices=("json", "text", "csv"),
        default="json",
        help="Output format (default: json)",
    )
    settle_parser.add_argument(
        "--output",
        "-o",
        help="Write the settlement report to a file instead of stdout",
    )

    args = parser.parse_args(argv)
    out = stream or sys.stdout
    try:
        invoices = [_invoice_from_dict(row) for row in _load_json_array(args.invoices)]
        receipts = [_receipt_from_dict(row) for row in _load_json_array(args.receipts)]
        allocations = None
        if args.allocations:
            allocations = [
                _allocation_from_dict(row) for row in _load_json_array(args.allocations)
            ]
        result = settle(
            invoices,
            receipts,
            strategy=args.strategy,
            allocations=allocations,
        )
        rendered = _render(result, invoices=invoices, receipts=receipts, fmt=args.format)
    except (
        OSError,
        json.JSONDecodeError,
        SettlementError,
        TypeError,
        ValueError,
        KeyError,
    ) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if args.output:
        Path(args.output).write_text(rendered, encoding="utf-8")
        if stream is None and out is sys.stdout:
            print(f"wrote {args.output}", file=sys.stderr)
    else:
        out.write(rendered)
        if not rendered.endswith("\n"):
            out.write("\n")
    return 0


def _render(
    result: SettlementResult,
    *,
    invoices: Sequence[Invoice],
    receipts: Sequence[Receipt],
    fmt: str,
) -> str:
    if fmt == "text":
        return format_text(result, invoices=invoices, receipts=receipts)
    if fmt == "csv":
        return format_csv(result, invoices=invoices, receipts=receipts)
    return json.dumps(
        result_to_dict(result, invoices=invoices, receipts=receipts),
        indent=2,
    ) + "\n"


def _load_json_array(path: str) -> list[dict[str, Any]]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"{path} must contain a JSON array")
    rows: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            raise ValueError(f"{path} must contain JSON objects")
        rows.append(item)
    return rows


def _invoice_from_dict(row: Mapping[str, Any]) -> Invoice:
    return Invoice(
        id=str(row["id"]),
        customer_id=str(row["customer_id"]),
        amount=_amount(row["amount"]),
        due_date=_as_date(row["due_date"]),
        currency=str(row.get("currency", "USD")),
        document_date=_optional_date(row.get("document_date")),
    )


def _receipt_from_dict(row: Mapping[str, Any]) -> Receipt:
    receipt_date = row.get("receipt_date", row.get("date"))
    if receipt_date is None:
        raise ValueError("receipt is missing receipt_date/date")
    raw_type = row.get("receipt_type", row.get("type", ReceiptType.PAYMENT.value))
    return Receipt(
        id=str(row["id"]),
        customer_id=str(row["customer_id"]),
        amount=_amount(row["amount"]),
        receipt_date=_as_date(receipt_date),
        currency=str(row.get("currency", "USD")),
        receipt_type=ReceiptType(raw_type),
    )


def _allocation_from_dict(row: Mapping[str, Any]) -> Allocation:
    return Allocation(
        receipt_id=str(row["receipt_id"]),
        invoice_id=str(row["invoice_id"]),
        amount=_amount(row["amount"]),
    )


def _amount(value: Any) -> Decimal:
    if isinstance(value, bool) or value is None:
        raise ValueError(f"invalid amount: {value!r}")
    if isinstance(value, float):
        raise ValueError("float is not allowed for money; use a string or int")
    return Decimal(str(value)) if not isinstance(value, Decimal) else value


def _as_date(value: Any) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def _optional_date(value: Any) -> date | None:
    if value in (None, ""):
        return None
    return _as_date(value)


if __name__ == "__main__":
    raise SystemExit(main())
