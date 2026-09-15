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


COMPOSER_ID = "fda95e1a-7d3a-4113-942f-7e033e454bef"
USER_BUBBLE = "11111111-1111-1111-1111-111111111111"
ASSISTANT_BUBBLE = "22222222-2222-2222-2222-222222222222"


def seed_user_dir(user_dir: Path) -> None:
    write_vscdb(
        user_dir / "globalStorage" / "state.vscdb",
        items={
            "composer.composerHeaders": {
                "allComposers": [
                    {
                        "composerId": COMPOSER_ID,
                        "name": "General verification",
                        "createdAt": 1_700_000_000_000,
                        "lastUpdatedAt": 1_700_000_100_000,
                        "unifiedMode": "agent",
                        "workspaceIdentifier": {
                            "id": "abc123",
                            "uri": {"fsPath": "/workspace/pymtx", "scheme": "file"},
                        },
                    }
                ]
            }
        },
        kv={
            f"composerData:{COMPOSER_ID}": {
                "composerId": COMPOSER_ID,
                "name": "General verification",
                "status": "completed",
                "unifiedMode": "agent",
                "createdAt": 1_700_000_000_000,
                "modelConfig": {"modelName": "composer-1"},
                "fullConversationHeadersOnly": [
                    {"bubbleId": USER_BUBBLE, "type": 1},
                    {"bubbleId": ASSISTANT_BUBBLE, "type": 2},
                ],
                "conversationMap": {},
            },
            f"bubbleId:{COMPOSER_ID}:{USER_BUBBLE}": {
                "type": 1,
                "text": "check",
                "createdAt": 1_700_000_000_000,
            },
            f"bubbleId:{COMPOSER_ID}:{ASSISTANT_BUBBLE}": {
                "type": 2,
                "text": "The repo is empty.",
                "createdAt": 1_700_000_050_000,
            },
        },
    )
    write_workspace(
        user_dir,
        "abc123",
        "file:///workspace/pymtx",
        items={
            "composer.composerData": {
                "selectedComposerIds": [COMPOSER_ID],
                "hasMigratedComposerData": True,
            }
        },
    )


def _insert(conn: sqlite3.Connection, table: str, rows: dict[str, Any]) -> None:
    for key, value in rows.items():
        raw = json.dumps(value) if not isinstance(value, str) else value
        conn.execute(f"INSERT INTO {table} (key, value) VALUES (?, ?)", (key, raw))
