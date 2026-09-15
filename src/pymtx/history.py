"""Discover and load Cursor chat / agent sessions from local databases."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

from . import store
from .paths import CursorPaths, default_user_dir

_ROLE_BY_TYPE = {1: "user", 2: "assistant"}


class HistoryError(RuntimeError):
    """Raised when local app history cannot be read."""


@dataclass(frozen=True)
class Session:
    id: str
    name: str
    created_at_ms: int | None = None
    updated_at_ms: int | None = None
    mode: str | None = None
    workspace_id: str | None = None
    workspace_uri: str | None = None
    source: str = "unknown"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class Message:
    bubble_id: str
    role: str
    text: str
    created_at_ms: int | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class Conversation:
    session: Session
    messages: tuple[Message, ...]
    status: str | None = None
    model: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "session": self.session.to_dict(),
            "messages": [message.to_dict() for message in self.messages],
            "status": self.status,
            "model": self.model,
        }


class CursorHistory:
    """Read-only view of Cursor local app history."""

    def __init__(self, paths: CursorPaths):
        self.paths = paths

    @classmethod
    def from_user_dir(cls, user_dir: Path | None = None) -> CursorHistory:
        return cls(CursorPaths(user_dir or default_user_dir()))

    def list_sessions(self) -> list[Session]:
        sessions: dict[str, Session] = {}

        if self.paths.global_db.is_file():
            with store.open_vscdb(self.paths.global_db) as conn:
                headers = store.get_item(conn, "composer.composerHeaders")
                _merge_header_sessions(sessions, headers, source="headers")
                for key, payload in store.iter_items(conn, "cursorDiskKV", prefix="composerData:"):
                    composer_id = key.split(":", 1)[1] if ":" in key else None
                    if composer_id:
                        _merge_composer_payload(sessions, composer_id, payload, source="composerData")

        if self.paths.workspace_storage.is_dir():
            for workspace_dir in sorted(self.paths.workspace_storage.iterdir()):
                if not workspace_dir.is_dir():
                    continue
                workspace_id = workspace_dir.name
                workspace_uri = _workspace_uri(self.paths.workspace_json(workspace_id))
                db_path = self.paths.workspace_db(workspace_id)
                if not db_path.is_file():
                    continue
                with store.open_vscdb(db_path) as conn:
                    data = store.get_item(conn, "composer.composerData")
                    _merge_workspace_sessions(
                        sessions,
                        data,
                        workspace_id=workspace_id,
                        workspace_uri=workspace_uri,
                    )
                    _merge_selected_ids(
                        sessions,
                        data,
                        workspace_id=workspace_id,
                        workspace_uri=workspace_uri,
                    )

        return sorted(
            sessions.values(),
            key=lambda session: session.updated_at_ms or session.created_at_ms or 0,
            reverse=True,
        )

    def get_session(self, composer_id: str) -> Conversation:
        listed = {session.id: session for session in self.list_sessions()}
        session = listed.get(composer_id)
        payload: Any = None

        if not self.paths.global_db.is_file():
            raise HistoryError(f"global history database not found: {self.paths.global_db}")

        with store.open_vscdb(self.paths.global_db) as conn:
            payload = store.get_item(conn, f"composerData:{composer_id}", table="cursorDiskKV")
            if payload is None:
                raise HistoryError(f"conversation not found: {composer_id}")
            if session is None:
                session = _session_from_composer(composer_id, payload, source="composerData")
            messages = _messages_from_payload(conn, composer_id, payload)

        model = None
        if isinstance(payload, dict):
            config = payload.get("modelConfig") or {}
            if isinstance(config, dict):
                model = config.get("modelName")
            session = _enrich_session(session, payload)

        return Conversation(
            session=session,
            messages=tuple(messages),
            status=payload.get("status") if isinstance(payload, dict) else None,
            model=model,
        )


def format_timestamp(ms: int | None) -> str:
    if not ms:
        return ""
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")


def _workspace_uri(path: Path) -> str | None:
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    raw = data.get("folder") or data.get("workspace")
    if not isinstance(raw, str):
        return None
    parsed = urlparse(raw)
    if parsed.scheme == "file":
        return unquote(parsed.path)
    return unquote(raw)


def _merge_header_sessions(sessions: dict[str, Session], headers: Any, *, source: str) -> None:
    if not isinstance(headers, dict):
        return
    for entry in headers.get("allComposers") or []:
        if not isinstance(entry, dict):
            continue
        composer_id = entry.get("composerId")
        if not composer_id:
            continue
        workspace = entry.get("workspaceIdentifier") or {}
        uri = None
        workspace_id = None
        if isinstance(workspace, dict):
            workspace_id = workspace.get("id")
            uri_obj = workspace.get("uri") or {}
            if isinstance(uri_obj, dict):
                uri = uri_obj.get("fsPath") or uri_obj.get("external")
        sessions[composer_id] = _overlay(
            sessions.get(composer_id),
            Session(
                id=composer_id,
                name=str(entry.get("name") or "Untitled"),
                created_at_ms=_int_or_none(entry.get("createdAt")),
                updated_at_ms=_int_or_none(entry.get("lastUpdatedAt") or entry.get("createdAt")),
                mode=entry.get("unifiedMode") or entry.get("forceMode"),
                workspace_id=str(workspace_id) if workspace_id else None,
                workspace_uri=str(uri) if uri else None,
                source=source,
            ),
        )


def _merge_workspace_sessions(
    sessions: dict[str, Session],
    data: Any,
    *,
    workspace_id: str,
    workspace_uri: str | None,
) -> None:
    if not isinstance(data, dict):
        return
    for entry in data.get("allComposers") or []:
        if not isinstance(entry, dict):
            continue
        composer_id = entry.get("composerId")
        if not composer_id:
            continue
        sessions[composer_id] = _overlay(
            sessions.get(composer_id),
            Session(
                id=composer_id,
                name=str(entry.get("name") or "Untitled"),
                created_at_ms=_int_or_none(entry.get("createdAt")),
                updated_at_ms=_int_or_none(entry.get("lastUpdatedAt") or entry.get("createdAt")),
                mode=entry.get("unifiedMode") or entry.get("forceMode"),
                workspace_id=workspace_id,
                workspace_uri=workspace_uri,
                source="workspace",
            ),
        )


def _merge_selected_ids(
    sessions: dict[str, Session],
    data: Any,
    *,
    workspace_id: str,
    workspace_uri: str | None,
) -> None:
    if not isinstance(data, dict):
        return
    ids = list(data.get("selectedComposerIds") or []) + list(data.get("lastFocusedComposerIds") or [])
    for composer_id in ids:
        if not composer_id or composer_id in sessions:
            continue
        sessions[composer_id] = Session(
            id=str(composer_id),
            name="Untitled",
            workspace_id=workspace_id,
            workspace_uri=workspace_uri,
            source="workspace-selected",
        )


def _merge_composer_payload(
    sessions: dict[str, Session],
    composer_id: str,
    payload: Any,
    *,
    source: str,
) -> None:
    incoming = _session_from_composer(composer_id, payload, source=source)
    sessions[composer_id] = _overlay(sessions.get(composer_id), incoming)


def _session_from_composer(composer_id: str, payload: Any, *, source: str) -> Session:
    if not isinstance(payload, dict):
        return Session(id=composer_id, name="Untitled", source=source)
    return Session(
        id=composer_id,
        name=str(payload.get("name") or "Untitled"),
        created_at_ms=_int_or_none(payload.get("createdAt")),
        updated_at_ms=_int_or_none(payload.get("lastUpdatedAt") or payload.get("createdAt")),
        mode=payload.get("unifiedMode") or payload.get("forceMode"),
        source=source,
    )


def _enrich_session(session: Session, payload: dict[str, Any]) -> Session:
    return Session(
        id=session.id,
        name=session.name or str(payload.get("name") or "Untitled"),
        created_at_ms=session.created_at_ms or _int_or_none(payload.get("createdAt")),
        updated_at_ms=session.updated_at_ms
        or _int_or_none(payload.get("lastUpdatedAt") or payload.get("createdAt")),
        mode=session.mode or payload.get("unifiedMode") or payload.get("forceMode"),
        workspace_id=session.workspace_id,
        workspace_uri=session.workspace_uri,
        source=session.source,
    )


def _overlay(existing: Session | None, incoming: Session) -> Session:
    if existing is None:
        return incoming
    return Session(
        id=incoming.id,
        name=_prefer(existing.name, incoming.name, empty="Untitled"),
        created_at_ms=existing.created_at_ms or incoming.created_at_ms,
        updated_at_ms=existing.updated_at_ms or incoming.updated_at_ms,
        mode=existing.mode or incoming.mode,
        workspace_id=existing.workspace_id or incoming.workspace_id,
        workspace_uri=existing.workspace_uri or incoming.workspace_uri,
        source=existing.source if existing.source != "unknown" else incoming.source,
    )


def _prefer(primary: str, fallback: str, *, empty: str) -> str:
    if primary and primary != empty:
        return primary
    return fallback or empty


def _messages_from_payload(conn, composer_id: str, payload: Any) -> list[Message]:
    if not isinstance(payload, dict):
        return []
    headers = payload.get("fullConversationHeadersOnly") or []
    conversation_map = payload.get("conversationMap") or {}
    messages: list[Message] = []
    for header in headers:
        if not isinstance(header, dict):
            continue
        bubble_id = header.get("bubbleId")
        if not bubble_id:
            continue
        blob = store.get_item(conn, f"bubbleId:{composer_id}:{bubble_id}", table="cursorDiskKV")
        mapped = conversation_map.get(bubble_id) if isinstance(conversation_map, dict) else None
        body = blob if isinstance(blob, dict) else mapped if isinstance(mapped, dict) else {}
        role_type = body.get("type") if isinstance(body, dict) else header.get("type")
        text = ""
        created = None
        if isinstance(body, dict):
            text = str(body.get("text") or "")
            created = _int_or_none(body.get("createdAt"))
            role_type = body.get("type", role_type)
        messages.append(
            Message(
                bubble_id=str(bubble_id),
                role=_ROLE_BY_TYPE.get(role_type, "unknown"),
                text=text,
                created_at_ms=created,
            )
        )
    return messages


def _int_or_none(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    return None
