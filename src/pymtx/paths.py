"""Platform paths for Cursor's local user data."""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class CursorPaths:
    """Resolved locations under a Cursor user-data directory."""

    user_dir: Path

    @property
    def global_db(self) -> Path:
        return self.user_dir / "globalStorage" / "state.vscdb"

    @property
    def workspace_storage(self) -> Path:
        return self.user_dir / "workspaceStorage"

    def workspace_db(self, workspace_id: str) -> Path:
        return self.workspace_storage / workspace_id / "state.vscdb"

    def workspace_json(self, workspace_id: str) -> Path:
        return self.workspace_storage / workspace_id / "workspace.json"


def default_user_dir(*, env: dict[str, str] | None = None, platform: str | None = None) -> Path:
    """Return the default Cursor `User` directory for this machine.

    Override with `CURSOR_USER_DIR` when Cursor was installed in a custom location.
    """

    environ = env if env is not None else os.environ
    override = environ.get("CURSOR_USER_DIR")
    if override:
        return Path(override).expanduser()

    system = (platform or sys.platform).lower()
    home = Path(environ.get("HOME") or Path.home())

    if system.startswith("win") or system == "cygwin":
        appdata = environ.get("APPDATA")
        if appdata:
            return Path(appdata) / "Cursor" / "User"
        return home / "AppData" / "Roaming" / "Cursor" / "User"

    if system == "darwin":
        return home / "Library" / "Application Support" / "Cursor" / "User"

    xdg = environ.get("XDG_CONFIG_HOME")
    if xdg:
        return Path(xdg) / "Cursor" / "User"
    return home / ".config" / "Cursor" / "User"
