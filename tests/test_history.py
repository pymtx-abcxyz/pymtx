from __future__ import annotations

from pathlib import Path

import pytest

from pymtx.history import CursorHistory, HistoryError
from tests.helpers import COMPOSER_ID, seed_user_dir, write_vscdb, write_workspace


def test_list_sessions_from_headers(tmp_path: Path) -> None:
    user_dir = tmp_path / "User"
    seed_user_dir(user_dir)
    sessions = CursorHistory.from_user_dir(user_dir).list_sessions()
    assert len(sessions) == 1
    session = sessions[0]
    assert session.id == COMPOSER_ID
    assert session.name == "General verification"
    assert session.mode == "agent"
    assert session.workspace_uri == "/workspace/pymtx"
    assert session.source == "headers"


def test_get_session_reads_bubbles(tmp_path: Path) -> None:
    user_dir = tmp_path / "User"
    seed_user_dir(user_dir)
    conversation = CursorHistory.from_user_dir(user_dir).get_session(COMPOSER_ID)
    assert conversation.model == "composer-1"
    assert conversation.status == "completed"
    assert [message.role for message in conversation.messages] == ["user", "assistant"]
    assert [message.text for message in conversation.messages] == [
        "check",
        "The repo is empty.",
    ]


def test_workspace_all_composers_and_legacy_map(tmp_path: Path) -> None:
    user_dir = tmp_path / "User"
    legacy_id = "legacy-composer"
    write_vscdb(
        user_dir / "globalStorage" / "state.vscdb",
        kv={
            f"composerData:{legacy_id}": {
                "composerId": legacy_id,
                "name": "Legacy chat",
                "unifiedMode": "chat",
                "createdAt": 1_600_000_000_000,
                "fullConversationHeadersOnly": [{"bubbleId": "b1", "type": 1}],
                "conversationMap": {"b1": {"type": 1, "text": "hello from map"}},
            }
        },
    )
    write_workspace(
        user_dir,
        "ws1",
        "file:///tmp/demo",
        items={
            "composer.composerData": {
                "allComposers": [
                    {
                        "composerId": legacy_id,
                        "name": "Legacy chat",
                        "createdAt": 1_600_000_000_000,
                        "unifiedMode": "chat",
                    }
                ]
            }
        },
    )
    history = CursorHistory.from_user_dir(user_dir)
    sessions = history.list_sessions()
    assert sessions[0].id == legacy_id
    assert sessions[0].workspace_uri == "/tmp/demo"
    conversation = history.get_session(legacy_id)
    assert conversation.messages[0].text == "hello from map"


def test_missing_conversation_raises(tmp_path: Path) -> None:
    user_dir = tmp_path / "User"
    write_vscdb(user_dir / "globalStorage" / "state.vscdb")
    with pytest.raises(HistoryError, match="not found"):
        CursorHistory.from_user_dir(user_dir).get_session("missing")
