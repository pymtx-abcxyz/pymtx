"""Read-only helpers for Cursor's SQLite key-value stores."""

from __future__ import annotations

import json
import shutil
import sqlite3
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

_TABLES = frozenset({"ItemTable", "cursorDiskKV"})


class StoreError(RuntimeError):
    """Raised when a Cursor database cannot be opened or parsed."""


def _table(name: str) -> str:
    if name not in _TABLES:
        raise StoreError(f"unknown table: {name}")
    return name


def _sidecar_paths(db_path: Path) -> list[Path]:
    return [db_path, Path(f"{db_path}-wal"), Path(f"{db_path}-shm")]


@contextmanager
def open_vscdb(db_path: Path) -> Iterator[sqlite3.Connection]:
    """Open a `.vscdb` file without mutating the original.

    Copies the database and WAL sidecars into a temp dir first so a running
    Cursor process does not lock or race the read.
    """

    if not db_path.is_file():
        raise StoreError(f"database not found: {db_path}")

    with tempfile.TemporaryDirectory(prefix="pymtx-") as tmp:
        dest_dir = Path(tmp)
        dest = dest_dir / db_path.name
        for src in _sidecar_paths(db_path):
            if src.exists():
                shutil.copy2(src, dest_dir / src.name)
        conn = sqlite3.connect(f"file:{dest}?mode=ro", uri=True)
        try:
            yield conn
        finally:
            conn.close()


def table_exists(conn: sqlite3.Connection, name: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
        (name,),
    ).fetchone()
    return row is not None


def get_item(conn: sqlite3.Connection, key: str, table: str = "ItemTable") -> Any | None:
    table = _table(table)
    if not table_exists(conn, table):
        return None
    row = conn.execute(f"SELECT value FROM {table} WHERE key = ?", (key,)).fetchone()
    if row is None:
        return None
    return _decode(row[0])


def iter_items(
    conn: sqlite3.Connection,
    table: str,
    prefix: str | None = None,
) -> Iterator[tuple[str, Any]]:
    table = _table(table)
    if not table_exists(conn, table):
        return
    if prefix:
        cursor = conn.execute(
            f"SELECT key, value FROM {table} WHERE key LIKE ?",
            (f"{prefix}%",),
        )
    else:
        cursor = conn.execute(f"SELECT key, value FROM {table}")
    for key, value in cursor:
        yield key, _decode(value)


def _decode(raw: Any) -> Any:
    if raw is None:
        return None
    if isinstance(raw, bytes):
        text = raw.decode("utf-8")
    else:
        text = str(raw)
    text = text.strip()
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text
