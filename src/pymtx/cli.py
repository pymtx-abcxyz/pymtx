"""Command-line interface for Cursor local app history."""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from . import __version__
from .history import Conversation, CursorHistory, HistoryError, Session, format_timestamp
from .paths import CursorPaths, default_user_dir
from .store import StoreError


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="pymtx",
        description="Read Cursor local app history (chats and agent sessions) from this machine.",
    )
    parser.add_argument("--version", action="version", version=f"pymtx {__version__}")
    parser.add_argument(
        "--user-dir",
        help="Cursor User directory. Defaults to the platform path or CURSOR_USER_DIR.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("paths", help="Print resolved Cursor history locations")

    list_parser = sub.add_parser("list", help="List local chat and agent sessions")
    list_parser.add_argument("--json", action="store_true", help="Emit JSON")
    list_parser.add_argument("--workspace", help="Filter by workspace path substring")

    show_parser = sub.add_parser("show", help="Print one conversation")
    show_parser.add_argument("composer_id", help="Composer / conversation id")
    show_parser.add_argument("--json", action="store_true", help="Emit JSON")

    args = parser.parse_args(list(argv) if argv is not None else None)
    user_dir = Path(args.user_dir).expanduser() if args.user_dir else default_user_dir()
    paths = CursorPaths(user_dir)

    try:
        if args.command == "paths":
            return _cmd_paths(paths)
        history = CursorHistory(paths)
        if args.command == "list":
            return _cmd_list(history, json_out=args.json, workspace=args.workspace)
        return _cmd_show(history, args.composer_id, json_out=args.json)
    except (HistoryError, StoreError) as exc:
        print(f"pymtx: {exc}", file=sys.stderr)
        return 1


def _cmd_paths(paths: CursorPaths) -> int:
    print(f"user_dir\t{paths.user_dir}")
    print(f"global_db\t{paths.global_db}")
    print(f"workspaces\t{paths.workspace_storage}")
    print(f"global_db_exists\t{str(paths.global_db.is_file()).lower()}")
    return 0


def _cmd_list(history: CursorHistory, *, json_out: bool, workspace: str | None) -> int:
    sessions = history.list_sessions()
    if workspace:
        needle = workspace.lower()
        sessions = [
            session
            for session in sessions
            if needle in (session.workspace_uri or "").lower()
            or needle in (session.workspace_id or "").lower()
        ]
    if json_out:
        print(json.dumps([session.to_dict() for session in sessions], indent=2))
        return 0
    if not sessions:
        print("No local Cursor conversations found.")
        return 0
    print(_format_table(sessions))
    return 0


def _cmd_show(history: CursorHistory, composer_id: str, *, json_out: bool) -> int:
    conversation = history.get_session(composer_id)
    if json_out:
        print(json.dumps(conversation.to_dict(), indent=2))
        return 0
    print(_format_conversation(conversation))
    return 0


def _format_table(sessions: list[Session]) -> str:
    rows = [["ID", "MODE", "UPDATED", "NAME", "WORKSPACE"]]
    for session in sessions:
        rows.append(
            [
                session.id,
                session.mode or "",
                format_timestamp(session.updated_at_ms or session.created_at_ms),
                session.name,
                session.workspace_uri or session.workspace_id or "",
            ]
        )
    widths = [max(len(row[i]) for row in rows) for i in range(len(rows[0]))]
    lines = []
    for index, row in enumerate(rows):
        line = "  ".join(cell.ljust(widths[i]) for i, cell in enumerate(row))
        lines.append(line.rstrip())
        if index == 0:
            lines.append("  ".join("-" * widths[i] for i in range(len(widths))))
    return "\n".join(lines)


def _format_conversation(conversation: Conversation) -> str:
    session = conversation.session
    header = [
        f"id: {session.id}",
        f"name: {session.name}",
        f"mode: {session.mode or ''}",
        f"model: {conversation.model or ''}",
        f"status: {conversation.status or ''}",
        f"workspace: {session.workspace_uri or session.workspace_id or ''}",
        f"updated: {format_timestamp(session.updated_at_ms or session.created_at_ms)}",
        "",
    ]
    body = []
    for message in conversation.messages:
        stamp = format_timestamp(message.created_at_ms)
        label = message.role
        if stamp:
            label = f"{label} ({stamp})"
        body.append(f"[{label}]")
        body.append(message.text or "")
        body.append("")
    return "\n".join(header + body).rstrip() + "\n"


if __name__ == "__main__":
    raise SystemExit(main())
