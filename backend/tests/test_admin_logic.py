from core.models import CachePolicy, UpdateConfigRequest
from services import admin_logic


def test_update_config_accepts_runtime_and_restart_fields(monkeypatch):
    saved = {"called": False}
    config = {
        "media_cache_policy": {"max_size_gb": 10, "max_age_days": 30},
        "token_cache_policy": {"max_size_mb": 100, "max_age_hours": 24},
        "transcription_cache_policy": {"max_size_mb": 500, "max_age_days": 30},
        "community_policy": {"max_size_mb": 500},
    }

    monkeypatch.setattr(admin_logic, "ADMIN_CONFIG", config)
    monkeypatch.setattr(admin_logic, "save_config", lambda: saved.update(called=True))

    result = admin_logic.update_config(
        UpdateConfigRequest(
            cors_origins=["http://localhost:3000"],
            media_cache_dir="custom_media",
            task_worker_enabled=False,
            max_upload_mb=12,
            transcription_model="small",
            load_transcription_model=False,
            load_alignment_model=False,
            media_cache_policy=CachePolicy(max_age_days=7),
        )
    )

    assert result == {"message": "Success", "restart_required": True}
    assert saved["called"] is True
    assert config["cors_origins"] == ["http://localhost:3000"]
    assert config["media_cache_dir"] == "custom_media"
    assert config["task_worker_enabled"] is False
    assert config["max_upload_mb"] == 12
    assert config["transcription_model"] == "small"
    assert config["load_transcription_model"] is False
    assert config["load_alignment_model"] is False
    assert config["media_cache_policy"] == {"max_size_gb": 10, "max_age_days": 7}


def test_export_import_user_data_uses_temp_path(tmp_path, monkeypatch):
    monkeypatch.setattr(admin_logic, "TEMP_DATA_PATH", tmp_path)
    admin_logic.token_storage.clear()

    exported = admin_logic.export_user_data({"version": 2, "songs": [{"title": "test"}]})
    imported = admin_logic.import_user_data(exported["token"])

    assert imported == {"version": 2, "songs": [{"title": "test"}]}
