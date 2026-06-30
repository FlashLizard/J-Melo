import sys

import pytest
from fastapi import HTTPException

from services import media_logic


def test_yt_dlp_command_uses_current_python_module():
    command = media_logic._yt_dlp_command("--version")

    assert command[:3] == [sys.executable, "-m", "yt_dlp"]
    assert "--version" in command


def test_yt_dlp_command_includes_backend_media_config(monkeypatch):
    monkeypatch.setitem(media_logic.ADMIN_CONFIG, "proxy", "http://127.0.0.1:7890")
    monkeypatch.setitem(media_logic.ADMIN_CONFIG, "yt_dlp_force_ipv4", True)
    monkeypatch.setitem(media_logic.ADMIN_CONFIG, "yt_dlp_cookies_file", "private/cookies.txt")
    monkeypatch.setitem(media_logic.ADMIN_CONFIG, "yt_dlp_js_runtimes", "node:/usr/bin/node")
    monkeypatch.setitem(media_logic.ADMIN_CONFIG, "yt_dlp_extractor_args", ["youtube:player_client=web_safari"])
    monkeypatch.setitem(media_logic.ADMIN_CONFIG, "yt_dlp_extra_args", ["--geo-bypass"])

    command = media_logic._yt_dlp_command("--dump-json", "https://www.youtube.com/watch?v=abc")

    assert "--force-ipv4" in command
    assert command[command.index("--proxy") + 1] == "http://127.0.0.1:7890"
    assert command[command.index("--cookies") + 1].endswith("private\\cookies.txt") or command[command.index("--cookies") + 1].endswith("private/cookies.txt")
    assert command[command.index("--js-runtimes") + 1] == "node:/usr/bin/node"
    assert command[command.index("--extractor-args") + 1] == "youtube:player_client=web_safari"
    assert "--geo-bypass" in command


def test_youtube_retry_args_added_for_unavailable_without_player_override(monkeypatch):
    monkeypatch.setitem(media_logic.ADMIN_CONFIG, "yt_dlp_extractor_args", [])

    retry_args = media_logic._youtube_retry_args(
        "https://www.youtube.com/watch?v=fgT8pbHVaOU",
        "ERROR: Video unavailable. This video is not available",
    )

    assert retry_args == ["--extractor-args", "youtube:player_client=mweb,web_safari,web_embedded,android,ios"]


def test_youtube_retry_args_respect_configured_player_client(monkeypatch):
    monkeypatch.setitem(media_logic.ADMIN_CONFIG, "yt_dlp_extractor_args", ["youtube:player_client=ios"])

    retry_args = media_logic._youtube_retry_args(
        "https://www.youtube.com/watch?v=fgT8pbHVaOU",
        "ERROR: Video unavailable. This video is not available",
    )

    assert retry_args == []


def test_bilibili_urls_get_browser_headers():
    args = media_logic._provider_initial_args("https://www.bilibili.com/video/BV1Vs411j7nQ")

    assert "--add-header" in args
    assert "Referer:https://www.bilibili.com" in args
    assert "Origin:https://www.bilibili.com" in args
    assert any(item.startswith("User-Agent:Mozilla/5.0") for item in args)


def test_bilibili_hint_explains_412_workaround():
    detail = media_logic._with_provider_hint(
        "https://www.bilibili.com/video/BV1Vs411j7nQ",
        "HTTP Error 412: Precondition Failed",
    )

    assert "BiliBili" in detail
    assert "HTTP 412" in detail
    assert "Referer/Origin/User-Agent" in detail


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
