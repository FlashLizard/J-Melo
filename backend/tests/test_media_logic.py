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


def test_media_index_returns_existing_cached_file(tmp_path, monkeypatch):
    monkeypatch.setattr(media_logic, "MEDIA_INDEX_PATH", tmp_path / "media_index.db")
    monkeypatch.setattr(media_logic, "_media_index_initialized", False)
    audio_path = tmp_path / "song.mp3"
    audio_path.write_bytes(b"audio")
    payload = {
        "media_type": "audio",
        "title": "Cached song",
        "artist": "Artist",
        "cover_url": None,
        "duration": 12,
        "media_url": "/media_cache/song.mp3",
        "local_path": str(audio_path),
    }

    media_logic.save_indexed_media("https://example.com/watch?v=1", payload, "song")

    cached = media_logic.get_indexed_media("https://example.com/watch?v=1")

    assert cached == payload


def test_media_index_discards_missing_cached_file(tmp_path, monkeypatch):
    monkeypatch.setattr(media_logic, "MEDIA_INDEX_PATH", tmp_path / "media_index.db")
    monkeypatch.setattr(media_logic, "_media_index_initialized", False)
    payload = {
        "media_type": "audio",
        "title": "Missing song",
        "artist": None,
        "cover_url": None,
        "duration": 0,
        "media_url": "/media_cache/missing.mp3",
        "local_path": str(tmp_path / "missing.mp3"),
    }
    media_logic.save_indexed_media("https://example.com/watch?v=missing", payload, "missing")

    assert media_logic.get_indexed_media("https://example.com/watch?v=missing") is None
