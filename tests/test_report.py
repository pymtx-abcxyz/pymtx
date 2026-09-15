from datetime import date
from decimal import Decimal

from pymtx import Invoice, Receipt, format_csv, format_text, group_totals, result_to_dict, settle


def test_group_totals_and_text_report() -> None:
    invoices = [
        Invoice("INV-A", "A", "100.00", date(2026, 1, 1)),
        Invoice("INV-B", "B", "40.00", date(2026, 1, 1), currency="EUR"),
    ]
    receipts = [
        Receipt("P-A", "A", "60.00", date(2026, 1, 2)),
        Receipt("P-B", "B", "10.00", date(2026, 1, 2), currency="EUR"),
    ]
    result = settle(invoices, receipts)

    totals = group_totals(invoices, receipts, result)
    assert totals == [
        {
            "customer_id": "A",
            "currency": "USD",
            "open_ar": "40.00",
            "unapplied_cash": "0.00",
            "applied": "60.00",
            "invoices": "1",
            "receipts": "1",
        },
        {
            "customer_id": "B",
            "currency": "EUR",
            "open_ar": "30.00",
            "unapplied_cash": "0.00",
            "applied": "10.00",
            "invoices": "1",
            "receipts": "1",
        },
    ]

    text = format_text(result, invoices=invoices, receipts=receipts)
    assert "Applied: 70.00" in text
    assert "P-A -> INV-A  60.00" in text
    assert "A USD: open_ar=40.00" in text
    assert result.open_invoices == ("INV-A", "INV-B")


def test_csv_and_dict_include_open_and_unapplied() -> None:
    invoices = [Invoice("INV-1", "C1", "50.00", date(2026, 1, 1))]
    receipts = [Receipt("PMT-1", "C1", "80.00", date(2026, 1, 2))]
    result = settle(invoices, receipts)

    payload = result_to_dict(result, invoices=invoices, receipts=receipts)
    assert payload["open_invoices"] == []
    assert payload["unapplied_receipt_ids"] == ["PMT-1"]
    assert payload["by_customer"][0]["unapplied_cash"] == "30.00"
    assert result.unapplied_receipt_ids == ("PMT-1",)

    csv_text = format_csv(result, invoices=invoices, receipts=receipts)
    assert "allocation,PMT-1,INV-1,50.00,C1,USD" in csv_text
    assert "unapplied_receipt,PMT-1,,30.00,C1,USD" in csv_text
    assert result.total_applied == Decimal("50.00")
