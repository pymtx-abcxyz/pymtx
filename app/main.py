"""Vercel FastAPI entrypoint for pymtx settlement."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from pymtx import (
    Allocation,
    Invoice,
    Receipt,
    ReceiptType,
    SettlementError,
    Strategy,
    result_to_dict,
    settle,
)

app = FastAPI(
    title="pymtx",
    description="Settle accounts receivable: apply payments and credit memos to open invoices.",
    version="0.1.1",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class InvoiceIn(BaseModel):
    id: str
    customer_id: str
    amount: str | int
    due_date: str
    currency: str = "USD"
    document_date: str | None = None


class ReceiptIn(BaseModel):
    id: str
    customer_id: str
    amount: str | int
    date: str | None = None
    receipt_date: str | None = None
    currency: str = "USD"
    type: Literal["payment", "credit_memo"] | None = None
    receipt_type: Literal["payment", "credit_memo"] | None = None


class AllocationIn(BaseModel):
    receipt_id: str
    invoice_id: str
    amount: str | int


class SettleRequest(BaseModel):
    invoices: list[InvoiceIn] = Field(min_length=1)
    receipts: list[ReceiptIn] = Field(default_factory=list)
    strategy: Literal["oldest_due", "largest_first", "document_order"] = "oldest_due"
    allocations: list[AllocationIn] | None = None


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "pymtx"}


@app.post("/api/settle")
def settle_ar(payload: SettleRequest) -> dict[str, Any]:
    try:
        invoices = [_invoice(row) for row in payload.invoices]
        receipts = [_receipt(row) for row in payload.receipts]
        allocations = None
        if payload.allocations is not None:
            allocations = [_allocation(row) for row in payload.allocations]
        result = settle(
            invoices,
            receipts,
            strategy=Strategy(payload.strategy),
            allocations=allocations,
        )
        return result_to_dict(result, invoices=invoices, receipts=receipts)
    except SettlementError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (TypeError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _invoice(row: InvoiceIn) -> Invoice:
    return Invoice(
        id=row.id,
        customer_id=row.customer_id,
        amount=_amount(row.amount),
        due_date=_as_date(row.due_date),
        currency=row.currency,
        document_date=_optional_date(row.document_date),
    )


def _receipt(row: ReceiptIn) -> Receipt:
    raw_date = row.receipt_date or row.date
    if raw_date is None:
        raise ValueError("receipt is missing receipt_date/date")
    raw_type = row.receipt_type or row.type or ReceiptType.PAYMENT.value
    return Receipt(
        id=row.id,
        customer_id=row.customer_id,
        amount=_amount(row.amount),
        receipt_date=_as_date(raw_date),
        currency=row.currency,
        receipt_type=ReceiptType(raw_type),
    )


def _allocation(row: AllocationIn) -> Allocation:
    return Allocation(row.receipt_id, row.invoice_id, _amount(row.amount))


def _amount(value: str | int | Decimal) -> Decimal:
    if isinstance(value, bool):
        raise ValueError(f"invalid amount: {value!r}")
    if isinstance(value, float):
        raise ValueError("float is not allowed for money; use a string or int")
    return Decimal(str(value)) if not isinstance(value, Decimal) else value


def _as_date(value: str | date | datetime) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value))


def _optional_date(value: str | date | datetime | None) -> date | None:
    if value in (None, ""):
        return None
    return _as_date(value)
