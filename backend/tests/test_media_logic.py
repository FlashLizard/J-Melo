import sys

from services import media_logic


def test_yt_dlp_command_uses_current_python_module():
    command = media_logic._yt_dlp_command("--version")

    assert command[:3] == [sys.executable, "-m", "yt_dlp"]
    assert command[3] == "--version"


def test_safe_media_id_removes_path_and_shell_characters():
    assert media_logic.safe_media_id("../bad;id?.mp4") == "bad_id_mp4"
    assert media_logic.safe_media_id("") == "media"
