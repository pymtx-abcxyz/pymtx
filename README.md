# pymtx

Settle **accounts receivable**: apply customer payments and credit memos to open invoices. Matching stays inside a customer and currency. Amounts use `Decimal` cents — floats are rejected.

```bash
pip install -e ".[dev]"
pymtx settle invoices.json receipts.json
```

## Library

```python
from datetime import date
from pymtx import Invoice, Receipt, Strategy, settle

invoices = [
    Invoice("INV-100", "CUST-1", "150.00", date(2026, 1, 10)),
    Invoice("INV-101", "CUST-1", "50.00", date(2026, 1, 20)),
]
receipts = [
    Receipt("PMT-1", "CUST-1", "120.00", date(2026, 1, 25)),
]

result = settle(invoices, receipts, strategy=Strategy.OLDEST_DUE)
result.allocations          # PMT-1 -> INV-100 120.00
result.invoice_balances     # INV-100 30.00, INV-101 50.00
result.unapplied_receipts   # PMT-1 0.00
```

Default auto-match uses **oldest due date**, then invoice id. `Strategy.LARGEST_FIRST` and `Strategy.DOCUMENT_ORDER` are also available. Pass `allocations=` to apply an explicit list instead of auto-matching.

Credit memos are receipts with `ReceiptType.CREDIT_MEMO`. They settle invoices the same way payments do.

## JSON files

`invoices.json`

```json
[
  {"id": "INV-100", "customer_id": "CUST-1", "amount": "150.00", "due_date": "2026-01-10"}
]
```

`receipts.json`

```json
[
  {"id": "PMT-1", "customer_id": "CUST-1", "amount": "120.00", "date": "2026-01-25"}
]
```

## Development

```bash
python -m pytest
```
