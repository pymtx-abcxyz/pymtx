from __future__ import annotations

import json
from pathlib import Path

from pymtx.cli import main
from tests.helpers import COMPOSER_ID, seed_user_dir, write_vscdb


def test_cli_paths(tmp_path: Path, capsys) -> None:
    user_dir = tmp_path / "User"
    user_dir.mkdir()
    assert main(["--user-dir", str(user_dir), "paths"]) == 0
    out = capsys.readouterr().out
    assert str(user_dir) in out
    assert "global_db_exists\tfalse" in out


def test_cli_list_and_show(tmp_path: Path, capsys) -> None:
    user_dir = tmp_path / "User"
    seed_user_dir(user_dir)
    assert main(["--user-dir", str(user_dir), "list"]) == 0
    listed = capsys.readouterr().out
    assert COMPOSER_ID in listed
    assert "General verification" in listed

    assert main(["--user-dir", str(user_dir), "show", COMPOSER_ID]) == 0
    shown = capsys.readouterr().out
    assert "[user (2023-11-14 22:13)]" in shown or "[user" in shown
    assert "check" in shown
    assert "The repo is empty." in shown


def test_cli_json_list(tmp_path: Path, capsys) -> None:
    user_dir = tmp_path / "User"
    seed_user_dir(user_dir)
    assert main(["--user-dir", str(user_dir), "list", "--json"]) == 0
    payload = json.loads(capsys.readouterr().out)
    assert payload[0]["id"] == COMPOSER_ID


def test_cli_show_missing(tmp_path: Path, capsys) -> None:
    user_dir = tmp_path / "User"
    write_vscdb(user_dir / "globalStorage" / "state.vscdb")
    assert main(["--user-dir", str(user_dir), "show", "nope"]) == 1
    assert "not found" in capsys.readouterr().err
