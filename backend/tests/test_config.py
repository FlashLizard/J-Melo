import json
import os
import subprocess
import sys

from core import config


def test_load_config_deep_merges_defaults(tmp_path, monkeypatch):
    config_file = tmp_path / "config.json"
    config_file.write_text(
        json.dumps(
            {
                "admin_token": "secret",
                "media_cache_policy": {"max_age_days": 7},
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(config, "CONFIG_FILE", config_file)

    loaded = config._load_config()

    assert loaded["admin_token"] == "secret"
    assert loaded["media_cache_policy"]["max_age_days"] == 7
    assert loaded["media_cache_policy"]["max_size_gb"] == config.DEFAULT_CONFIG["media_cache_policy"]["max_size_gb"]
    assert loaded["task_db_path"] == config.DEFAULT_CONFIG["task_db_path"]


def test_backend_relative_path_uses_backend_root():
    relative = config.backend_relative_path(config.BASE_DIR / "media_cache" / "song.mp3")

    assert relative == "media_cache/song.mp3"


def test_config_file_can_be_overridden_by_environment(tmp_path):
    config_file = tmp_path / "test-config.json"
    config_file.write_text('{"task_db_path": "isolated-task.db"}', encoding="utf-8")
    result = subprocess.run(
        [sys.executable, "-c", "from core.config import CONFIG_FILE, ADMIN_CONFIG; print(CONFIG_FILE); print(ADMIN_CONFIG['task_db_path'])"],
        cwd=config.BASE_DIR,
        env={**os.environ, "J_MELO_CONFIG_FILE": str(config_file)},
        text=True,
        capture_output=True,
        check=True,
    )

    assert str(config_file) in result.stdout
    assert "isolated-task.db" in result.stdout
