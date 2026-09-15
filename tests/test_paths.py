from pathlib import Path

from pymtx.paths import default_user_dir


def test_linux_default_uses_xdg_or_home(tmp_path: Path) -> None:
    home = tmp_path / "home"
    env = {"HOME": str(home)}
    assert default_user_dir(env=env, platform="linux") == home / ".config" / "Cursor" / "User"

    env["XDG_CONFIG_HOME"] = str(tmp_path / "xdg")
    assert default_user_dir(env=env, platform="linux") == tmp_path / "xdg" / "Cursor" / "User"


def test_macos_and_windows_defaults(tmp_path: Path) -> None:
    home = tmp_path / "home"
    env = {"HOME": str(home)}
    assert (
        default_user_dir(env=env, platform="darwin")
        == home / "Library" / "Application Support" / "Cursor" / "User"
    )

    env["APPDATA"] = str(tmp_path / "roaming")
    assert default_user_dir(env=env, platform="win32") == tmp_path / "roaming" / "Cursor" / "User"


def test_cursor_user_dir_override(tmp_path: Path) -> None:
    custom = tmp_path / "custom-user"
    env = {"HOME": str(tmp_path), "CURSOR_USER_DIR": str(custom)}
    assert default_user_dir(env=env, platform="linux") == custom
