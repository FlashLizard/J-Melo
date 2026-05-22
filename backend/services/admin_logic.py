import asyncio
import json
import os
import secrets
import shutil
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import HTTPException

from core.config import (
    ADMIN_CONFIG,
    CACHE_PATH,
    COMMUNITY_DB_PATH,
    TEMP_DATA_PATH,
    TRANSCRIPTION_CACHE_PATH,
    save_config,
)
from core.utils import get_dir_size, log_info

token_storage = {}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _remove_path(path: Path) -> None:
    if path.is_file() or path.is_symlink():
        path.unlink()
    elif path.is_dir():
        shutil.rmtree(path)


def _community_song_count() -> int:
    if not COMMUNITY_DB_PATH.exists():
        return 0
    try:
        with closing(sqlite3.connect(COMMUNITY_DB_PATH)) as conn, conn:
            return conn.execute("SELECT COUNT(*) FROM shared_songs").fetchone()[0]
    except Exception:
        return 0


def get_cache_info():
    media_size, media_count = get_dir_size(CACHE_PATH)
    token_size, token_count = get_dir_size(TEMP_DATA_PATH)
    transcription_size, transcription_count = get_dir_size(TRANSCRIPTION_CACHE_PATH)

    return {
        "media_cache": {"size_bytes": media_size, "file_count": media_count},
        "token_cache": {"size_bytes": token_size, "file_count": token_count},
        "transcription_cache": {"size_bytes": transcription_size, "file_count": transcription_count},
        "community_db": {
            "size_bytes": COMMUNITY_DB_PATH.stat().st_size if COMMUNITY_DB_PATH.exists() else 0,
            "song_count": _community_song_count(),
        },
    }


def clear_cache(cache_name: str, transcription_tasks_dict: dict):
    cache_paths = {
        "media": CACHE_PATH,
        "tokens": TEMP_DATA_PATH,
        "transcriptions": TRANSCRIPTION_CACHE_PATH,
    }
    target = cache_paths.get(cache_name)
    if not target:
        raise HTTPException(status_code=400, detail="Unknown cache name")

    try:
        if cache_name == "transcriptions":
            transcription_tasks_dict.clear()
        target.mkdir(parents=True, exist_ok=True)
        for child in target.iterdir():
            _remove_path(child)
        return {"message": "Success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def update_config(request_data):
    scalar_fields = [
        "cors_origins",
        "media_cache_dir",
        "temp_data_dir",
        "transcription_cache_dir",
        "community_db_path",
        "task_db_path",
        "task_worker_enabled",
        "max_upload_mb",
        "media_command_concurrency",
        "media_command_queue_timeout_seconds",
        "image_proxy_concurrency",
        "transcription_model",
        "transcription_compute_type",
        "alignment_model",
        "load_transcription_model",
        "load_alignment_model",
    ]

    if request_data.admin_token:
        ADMIN_CONFIG["admin_token"] = request_data.admin_token
    if request_data.proxy is not None:
        ADMIN_CONFIG["proxy"] = request_data.proxy if request_data.proxy.strip() else None

    for key in scalar_fields:
        value = getattr(request_data, key, None)
        if value is not None:
            ADMIN_CONFIG[key] = value

    for key in ["media_cache_policy", "token_cache_policy", "transcription_cache_policy", "community_policy"]:
        value = getattr(request_data, key)
        if value:
            updates = value.model_dump(exclude_unset=True) if hasattr(value, "model_dump") else value.dict(exclude_unset=True)
            ADMIN_CONFIG.setdefault(key, {}).update(updates)

    save_config()
    return {"message": "Success", "restart_required": True}


def export_user_data(user_data: dict):
    token = secrets.token_urlsafe(16)
    expiry = _utc_now() + timedelta(hours=24)
    file_path = TEMP_DATA_PATH / f"export_{token}.json"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(json.dumps(user_data, ensure_ascii=False), encoding="utf-8")
    token_storage[token] = {"file_path": str(file_path), "expiry_time": expiry}
    return {"token": token, "expires_at": expiry.isoformat()}


def import_user_data(token: str):
    info = token_storage.get(token)
    if not info:
        file_path = TEMP_DATA_PATH / f"export_{token}.json"
        if file_path.exists():
            info = {"file_path": str(file_path)}
        else:
            raise HTTPException(status_code=404, detail="Token not found")
    try:
        return json.loads(Path(info["file_path"]).read_text(encoding="utf-8"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _cleanup_expired_tokens(now: datetime) -> None:
    for token, info in list(token_storage.items()):
        if "expiry_time" in info and now > info["expiry_time"]:
            file_path = Path(info["file_path"])
            if file_path.exists():
                file_path.unlink()
            del token_storage[token]


def _cleanup_directory_by_policy(directory: Path, policy: dict, age_unit: str) -> None:
    if not directory.exists():
        return
    files = sorted([p for p in directory.iterdir() if p.exists()], key=lambda p: p.stat().st_mtime)
    now = _utc_now()

    max_age = policy.get(f"max_age_{age_unit}")
    if max_age:
        max_age_delta = timedelta(days=max_age) if age_unit == "days" else timedelta(hours=max_age)
        for file_path in list(files):
            modified = datetime.fromtimestamp(file_path.stat().st_mtime, tz=timezone.utc)
            if now - modified > max_age_delta:
                _remove_path(file_path)
                files.remove(file_path)
            else:
                break

    max_size = policy.get("max_size_gb") if age_unit == "days" else policy.get("max_size_mb")
    if max_size:
        limit = max_size * (1024**3 if age_unit == "days" else 1024**2)
        current_size, _ = get_dir_size(directory)
        while current_size > limit and files:
            file_path = files.pop(0)
            file_size = file_path.stat().st_size if file_path.exists() else 0
            _remove_path(file_path)
            current_size -= file_size


def _run_cleanup_cycle() -> None:
    _cleanup_expired_tokens(_utc_now())
    _cleanup_directory_by_policy(CACHE_PATH, ADMIN_CONFIG["media_cache_policy"], "days")
    _cleanup_directory_by_policy(TEMP_DATA_PATH, ADMIN_CONFIG["token_cache_policy"], "hours")
    _cleanup_directory_by_policy(
        TRANSCRIPTION_CACHE_PATH,
        ADMIN_CONFIG.get("transcription_cache_policy", {}),
        "days",
    )


async def background_cleanup_task():
    while True:
        try:
            await asyncio.sleep(3600)
            await asyncio.to_thread(_run_cleanup_cycle)
        except Exception as e:
            log_info(f"Cleanup error: {e}")
