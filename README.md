# pymtx

Read **Cursor local app history** from this machine. Chats and agent sessions live in SQLite on the computer running the Cursor UI; pymtx lists them and prints the conversation without uploading anything.

```bash
pip install -e ".[dev]"
pymtx paths
pymtx list
pymtx show <composer-id>
```

## What it reads

Cursor keeps conversation data locally under the `User` directory:

| Platform | Default path |
| --- | --- |
| macOS | `~/Library/Application Support/Cursor/User` |
| Linux | `~/.config/Cursor/User` |
| Windows | `%APPDATA%\Cursor\User` |

Override with `--user-dir` or `CURSOR_USER_DIR`. pymtx looks at:

- `globalStorage/state.vscdb` — conversation content (`composerData:…`, `bubbleId:…`) and the Cursor 3.0+ sidebar index (`composer.composerHeaders`)
- `workspaceStorage/<id>/state.vscdb` — older per-project chat lists (`allComposers`) and `workspace.json` for the project path

Reads copy the database (and WAL sidecars) first so a running Cursor process is not written to.

## Library

```python
from pymtx import CursorHistory

history = CursorHistory.from_user_dir()
for session in history.list_sessions():
    print(session.id, session.name, session.workspace_uri)

conversation = history.get_session(session.id)
for message in conversation.messages:
    print(message.role, message.text)
```

## Safety

Local history can include prompts, file paths, and file contents. pymtx only reads files on disk. Do not pipe raw dumps into a shared log or remote service.

## Development

```bash
python -m pytest
```
