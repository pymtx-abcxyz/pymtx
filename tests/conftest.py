from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any


def write_vscdb(
    path: Path,
    *,
    items: dict[str, Any] | None = None,
    kv: dict[str, Any] | None = None,
) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    try:
        conn.execute("CREATE TABLE ItemTable (key TEXT UNIQUE, value BLOB)")
        conn.execute("CREATE TABLE cursorDiskKV (key TEXT UNIQUE, value BLOB)")
        _insert(conn, "ItemTable", items or {})
        _insert(conn, "cursorDiskKV", kv or {})
        conn.commit()
    finally:
        conn.close()
    return path


def write_workspace(
    user_dir: Path,
    workspace_id: str,
    folder: str,
    *,
    items: dict[str, Any] | None = None,
) -> Path:
    workspace_dir = user_dir / "workspaceStorage" / workspace_id
    workspace_dir.mkdir(parents=True, exist_ok=True)
    (workspace_dir / "workspace.json").write_text(
        json.dumps({"folder": folder}),
        encoding="utf-8",
    )
    return write_vscdb(workspace_dir / "state.vscdb", items=items)


def _insert(conn: sqlite3.Connection, table: str, rows: dict[str, Any]) -> None:
    for key, value in rows.items():
        raw = json.dumps(value) if not isinstance(value, str) else value
        conn.execute(f"INSERT INTO {table} (key, value) VALUES (?, ?)", (key, raw))
