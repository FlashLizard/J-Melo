import os
import json
import torch

CONFIG_FILE = "config.json"
DEFAULT_CONFIG = {
    "admin_token": None,
    "proxy": None,
    "media_cache_policy": {"max_size_gb": 10, "max_age_days": 30},
    "token_cache_policy": {"max_size_mb": 100, "max_age_hours": 24},
    "transcription_cache_policy": {"max_size_mb": 500, "max_age_days": 30},
    "community_policy": {"max_size_mb": 500}
}

ADMIN_CONFIG = DEFAULT_CONFIG.copy()

if os.path.exists(CONFIG_FILE):
    with open(CONFIG_FILE, "r") as f:
        try:
            loaded_config = json.load(f)
            ADMIN_CONFIG.update(loaded_config)
        except json.JSONDecodeError:
            from datetime import datetime
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] WARNING: Could not decode config.json. Using default config.")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
CACHE_DIR = "media_cache"
TEMP_DATA_DIR = "temp_data"
TRANSCRIPTION_CACHE_DIR = "transcription_cache"

os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(TEMP_DATA_DIR, exist_ok=True)
os.makedirs(TRANSCRIPTION_CACHE_DIR, exist_ok=True)
