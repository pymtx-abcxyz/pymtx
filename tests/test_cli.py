import json
from pathlib import Path

from pymtx.cli import main


def test_cli_settle_fifo(tmp_path: Path, capsys) -> None:
    invoices = tmp_path / "invoices.json"
    receipts = tmp_path / "receipts.json"
    invoices.write_text(
        json.dumps(
            [
                {
                    "id": "INV-1",
                    "customer_id": "C1",
                    "amount": "100.00",
                    "due_date": "2026-01-10",
                },
                {
                    "id": "INV-2",
                    "customer_id": "C1",
                    "amount": "40.00",
                    "due_date": "2026-01-20",
                },
            ]
        ),
        encoding="utf-8",
    )
    receipts.write_text(
        json.dumps(
            [
                {
                    "id": "PMT-1",
                    "customer_id": "C1",
                    "amount": "120.00",
                    "date": "2026-01-25",
                }
            ]
        ),
        encoding="utf-8",
    )

    code = main(["settle", str(invoices), str(receipts)])
    captured = capsys.readouterr()
    assert code == 0
    payload = json.loads(captured.out)
    assert payload["total_applied"] == "120.00"
    assert payload["fully_settled_invoices"] == ["INV-1"]
    assert payload["invoice_balances"]["INV-2"] == "20.00"


def test_cli_explicit_allocations(tmp_path: Path, capsys) -> None:
    invoices = tmp_path / "invoices.json"
    receipts = tmp_path / "receipts.json"
    allocations = tmp_path / "allocations.json"
    invoices.write_text(
        json.dumps(
            [
                {
                    "id": "INV-1",
                    "customer_id": "C1",
                    "amount": "100.00",
                    "due_date": "2026-01-01",
                }
            ]
        ),
        encoding="utf-8",
    )
    receipts.write_text(
        json.dumps(
            [
                {
                    "id": "PMT-1",
                    "customer_id": "C1",
                    "amount": "40.00",
                    "date": "2026-01-02",
                }
            ]
        ),
        encoding="utf-8",
    )
    allocations.write_text(
        json.dumps(
            [{"receipt_id": "PMT-1", "invoice_id": "INV-1", "amount": "25.00"}]
        ),
        encoding="utf-8",
    )

    code = main(
        ["settle", str(invoices), str(receipts), "--allocations", str(allocations)]
    )
    captured = capsys.readouterr()
    assert code == 0
    payload = json.loads(captured.out)
    assert payload["allocations"] == [
        {"receipt_id": "PMT-1", "invoice_id": "INV-1", "amount": "25.00"}
    ]
    assert payload["unapplied_receipts"]["PMT-1"] == "15.00"


def test_cli_reports_errors(tmp_path: Path, capsys) -> None:
    invoices = tmp_path / "invoices.json"
    receipts = tmp_path / "receipts.json"
    invoices.write_text("{}", encoding="utf-8")
    receipts.write_text("[]", encoding="utf-8")
    code = main(["settle", str(invoices), str(receipts)])
    captured = capsys.readouterr()
    assert code == 1
    assert captured.err.startswith("error:")


def test_cli_text_and_csv_output(tmp_path: Path, capsys) -> None:
    invoices = tmp_path / "invoices.json"
    receipts = tmp_path / "receipts.json"
    invoices.write_text(
        json.dumps(
            [
                {
                    "id": "INV-1",
                    "customer_id": "C1",
                    "amount": "100.00",
                    "due_date": "2026-01-10",
                }
            ]
        ),
        encoding="utf-8",
    )
    receipts.write_text(
        json.dumps(
            [
                {
                    "id": "PMT-1",
                    "customer_id": "C1",
                    "amount": "40.00",
                    "date": "2026-01-25",
                }
            ]
        ),
        encoding="utf-8",
    )

    code = main(["settle", str(invoices), str(receipts), "--format", "text"])
    captured = capsys.readouterr()
    assert code == 0
    assert "Applied: 40.00" in captured.out
    assert "INV-1  60.00" in captured.out

    out_file = tmp_path / "settlement.csv"
    code = main(
        [
            "settle",
            str(invoices),
            str(receipts),
            "--format",
            "csv",
            "--output",
            str(out_file),
        ]
    )
    captured = capsys.readouterr()
    assert code == 0
    assert "wrote" in captured.err
    csv_text = out_file.read_text(encoding="utf-8")
    assert "allocation,PMT-1,INV-1,40.00,C1,USD" in csv_text
    assert "open_invoice,,INV-1,60.00,C1,USD" in csv_text


def test_cli_json_includes_customer_summary(tmp_path: Path, capsys) -> None:
    invoices = tmp_path / "invoices.json"
    receipts = tmp_path / "receipts.json"
    invoices.write_text(
        json.dumps(
            [
                {
                    "id": "INV-1",
                    "customer_id": "C1",
                    "amount": "25.00",
                    "due_date": "2026-01-10",
                }
            ]
        ),
        encoding="utf-8",
    )
    receipts.write_text(
        json.dumps(
            [
                {
                    "id": "PMT-1",
                    "customer_id": "C1",
                    "amount": "25.00",
                    "date": "2026-01-25",
                }
            ]
        ),
        encoding="utf-8",
    )
    code = main(["settle", str(invoices), str(receipts)])
    payload = json.loads(capsys.readouterr().out)
    assert code == 0
    assert payload["by_customer"][0]["applied"] == "25.00"
    assert payload["open_invoices"] == []
