from __future__ import annotations

from pathlib import Path

import pytest

from pymtx.history import CursorHistory, HistoryError

from .conftest import write_vscdb, write_workspace

COMPOSER_ID = "fda95e1a-7d3a-4113-942f-7e033e454bef"
USER_BUBBLE = "11111111-1111-1111-1111-111111111111"
ASSISTANT_BUBBLE = "22222222-2222-2222-2222-222222222222"


def _seed_user_dir(user_dir: Path) -> None:
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


def test_list_sessions_from_headers(tmp_path: Path) -> None:
    user_dir = tmp_path / "User"
    _seed_user_dir(user_dir)
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
    _seed_user_dir(user_dir)
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
