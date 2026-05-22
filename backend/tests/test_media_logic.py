import sys

import pytest
from fastapi import HTTPException

from services import media_logic


def test_yt_dlp_command_uses_current_python_module():
    command = media_logic._yt_dlp_command("--version")

    assert command[:3] == [sys.executable, "-m", "yt_dlp"]
    assert command[3] == "--version"


def test_safe_media_id_removes_path_and_shell_characters():
    assert media_logic.safe_media_id("../bad;id?.mp4") == "bad_id_mp4"
    assert media_logic.safe_media_id("") == "media"


def test_media_command_emfile_returns_busy_error(monkeypatch):
    def raise_too_many_files(*args, **kwargs):
        raise OSError(24, "Too many open files")

    monkeypatch.setattr(media_logic.subprocess, "run", raise_too_many_files)

    with pytest.raises(HTTPException) as exc:
        media_logic._run_media_command(["yt-dlp", "--version"], timeout=1)

    assert exc.value.status_code == 503
    assert "busy" in exc.value.detail.lower()
