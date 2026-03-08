import os
import json
import shutil
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from fastapi import HTTPException
from core.config import ADMIN_CONFIG, CONFIG_FILE, CACHE_DIR, TEMP_DATA_DIR, TRANSCRIPTION_CACHE_DIR
from core.utils import get_dir_size, log_info

token_storage = {}

def get_cache_info():
    mc_s, mc_f = get_dir_size(CACHE_DIR); tc_s, tc_f = get_dir_size(TEMP_DATA_DIR); trc_s, trc_f = get_dir_size(TRANSCRIPTION_CACHE_DIR)
    return {"media_cache": {"size_bytes": mc_s, "file_count": mc_f}, "token_cache": {"size_bytes": tc_s, "file_count": tc_f}, "transcription_cache": {"size_bytes": trc_s, "file_count": trc_f}, "community_db": {"size_bytes": os.path.getsize("shared_songs.db") if os.path.exists("shared_songs.db") else 0}}

def clear_cache(cache_name: str, transcription_tasks_dict: dict):
    d = {"media": CACHE_DIR, "tokens": TEMP_DATA_DIR, "transcriptions": TRANSCRIPTION_CACHE_DIR}.get(cache_name)
    if not d: raise HTTPException(status_code=400)
    try:
        if cache_name == "transcriptions": transcription_tasks_dict.clear()
        for f in os.listdir(d):
            p = os.path.join(d, f)
            if os.path.isfile(p): os.unlink(p)
            elif os.path.isdir(p): shutil.rmtree(p)
        return {"message": "Success"}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

def update_config(request_data):
    if request_data.admin_token: ADMIN_CONFIG["admin_token"] = request_data.admin_token
    if request_data.proxy is not None: ADMIN_CONFIG["proxy"] = request_data.proxy if request_data.proxy.strip() else None
    for k in ["media_cache_policy", "token_cache_policy", "transcription_cache_policy", "community_policy"]:
        v = getattr(request_data, k)
        if v: ADMIN_CONFIG.setdefault(k, {}).update(v.dict(exclude_unset=True))
    with open(CONFIG_FILE, "w") as f: json.dump(ADMIN_CONFIG, f, indent=4)
    return {"message": "Success"}

def export_user_data(user_data: dict):
    token = secrets.token_urlsafe(16); expiry = datetime.utcnow() + timedelta(hours=24)
    file_path = os.path.join(TEMP_DATA_DIR, f"export_{token}.json")
    with open(file_path, "w", encoding="utf-8") as f: json.dump(user_data, f, ensure_ascii=False)
    token_storage[token] = {"file_path": file_path, "expiry_time": expiry}
    return {"token": token, "expires_at": expiry.isoformat()}

def import_user_data(token: str):
    info = token_storage.get(token)
    if not info:
        file_path = os.path.join(TEMP_DATA_DIR, f"export_{token}.json")
        if os.path.exists(file_path): info = {"file_path": file_path}
        else: raise HTTPException(status_code=404)
    try:
        with open(info["file_path"], "r", encoding="utf-8") as f: return json.load(f)
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

async def background_cleanup_task():
    while True:
        try:
            import asyncio
            await asyncio.sleep(3600); now = datetime.utcnow()
            for token, info in list(token_storage.items()):
                if "expiry_time" in info and now > info["expiry_time"]:
                    if os.path.exists(info["file_path"]): os.remove(info["file_path"])
                    del token_storage[token]
            for dir_p, policy, unit in [(CACHE_DIR, ADMIN_CONFIG["media_cache_policy"], "days"), (TEMP_DATA_DIR, ADMIN_CONFIG["token_cache_policy"], "hours"), (TRANSCRIPTION_CACHE_DIR, ADMIN_CONFIG.get("transcription_cache_policy", {}), "days")]:
                max_age, max_size = policy.get(f"max_age_{unit}"), policy.get("max_size_gb") if unit == "days" else policy.get("max_size_mb")
                if not os.path.exists(dir_p): continue
                files = sorted(Path(dir_p).iterdir(), key=os.path.getmtime)
                if max_age:
                    for f in files:
                        if (now - datetime.fromtimestamp(f.stat().st_mtime)) > (timedelta(days=max_age) if unit == "days" else timedelta(hours=max_age)): os.remove(f)
                        else: break
                if max_size:
                    limit = max_size * 1024**3 if unit == "days" else max_size * 1024**2; curr_size, _ = get_dir_size(dir_p)
                    while curr_size > limit and files: f = files.pop(0); curr_size -= f.stat().st_size; os.remove(f)
        except Exception as e: log_info(f"Cleanup error: {e}")
