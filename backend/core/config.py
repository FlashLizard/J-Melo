import json
import os
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

import torch

BASE_DIR = Path(__file__).resolve().parents[1]
_config_file_env = os.environ.get("J_MELO_CONFIG_FILE")
CONFIG_FILE = (BASE_DIR / _config_file_env).resolve() if _config_file_env and not Path(_config_file_env).is_absolute() else Path(_config_file_env or BASE_DIR / "config.json")

DEFAULT_CONFIG: Dict[str, Any] = {
    "admin_token": None,
    "proxy": None,
    "cors_origins": ["*"],
    "media_cache_dir": "media_cache",
    "temp_data_dir": "temp_data",
    "transcription_cache_dir": "transcription_cache",
    "community_db_path": "shared_songs.db",
    "task_db_path": "task_queue.db",
    "transcription_model": "medium",
    "transcription_compute_type": "int8",
    "alignment_model": "base",
    "load_transcription_model": True,
    "load_alignment_model": True,
    "task_worker_enabled": True,
    "max_upload_mb": 50,
    "media_cache_policy": {"max_size_gb": 10, "max_age_days": 30},
    "token_cache_policy": {"max_size_mb": 100, "max_age_hours": 24},
    "transcription_cache_policy": {"max_size_mb": 500, "max_age_days": 30},
    "community_policy": {"max_size_mb": 500},
}


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    merged = deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _load_config() -> Dict[str, Any]:
    if not CONFIG_FILE.exists():
        return deepcopy(DEFAULT_CONFIG)
    try:
        with CONFIG_FILE.open("r", encoding="utf-8") as f:
            loaded_config = json.load(f)
        return _deep_merge(DEFAULT_CONFIG, loaded_config)
    except json.JSONDecodeError:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] WARNING: Could not decode config.json. Using default config.")
        return deepcopy(DEFAULT_CONFIG)


ADMIN_CONFIG = _load_config()

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CACHE_DIR = ADMIN_CONFIG["media_cache_dir"]
TEMP_DATA_DIR = ADMIN_CONFIG["temp_data_dir"]
TRANSCRIPTION_CACHE_DIR = ADMIN_CONFIG["transcription_cache_dir"]
MEDIA_ROUTE = "/media_cache"

CACHE_PATH = BASE_DIR / CACHE_DIR
TEMP_DATA_PATH = BASE_DIR / TEMP_DATA_DIR
TRANSCRIPTION_CACHE_PATH = BASE_DIR / TRANSCRIPTION_CACHE_DIR
COMMUNITY_DB_PATH = BASE_DIR / ADMIN_CONFIG["community_db_path"]
TASK_DB_PATH = BASE_DIR / ADMIN_CONFIG["task_db_path"]

for directory in [CACHE_PATH, TEMP_DATA_PATH, TRANSCRIPTION_CACHE_PATH]:
    directory.mkdir(parents=True, exist_ok=True)


def resolve_backend_path(path_like: str | Path) -> Path:
    path = Path(path_like)
    if path.is_absolute():
        return path
    return BASE_DIR / path


def backend_relative_path(path_like: str | Path) -> str:
    path = resolve_backend_path(path_like)
    try:
        return str(path.relative_to(BASE_DIR)).replace("\\", "/")
    except ValueError:
        return str(path)


def save_config() -> None:
    CONFIG_FILE.write_text(json.dumps(ADMIN_CONFIG, ensure_ascii=False, indent=4), encoding="utf-8")


def update_admin_config(values: Dict[str, Any]) -> Dict[str, Any]:
    ADMIN_CONFIG.update(_deep_merge(ADMIN_CONFIG, values))
    save_config()
    return ADMIN_CONFIG
