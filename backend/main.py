import os
import json
import uuid
import threading
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Response, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from faster_whisper import WhisperModel

# --- Core Module Imports ---
from core.config import ADMIN_CONFIG, DEVICE, CACHE_DIR, TEMP_DATA_DIR, TRANSCRIPTION_CACHE_DIR
from core.models import (
    UserData, MediaFetchResponse, TranscribeRequest, ClearCacheRequest, 
    UpdateConfigRequest, SharedSongUpload, AnnotateRequest, AlignRequest
)
from core.utils import (
    log_info, get_queue_position, annotate_japanese_text, parse_utaten_line_to_tokens
)

# --- Service Module Imports ---
import services.media_logic as media_logic
import services.transcription_logic as transcription_logic
import services.alignment_logic as alignment_logic
import services.lyrics_logic as lyrics_logic
import services.community_logic as community_logic
import services.admin_logic as admin_logic

# Configure logging
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s: %(message)s', datefmt='%Y-%m-%d %H:%M:%S')

# --- Global Models ---
log_info("Loading Whisper model...")
whisper_model = None
try:
    whisper_model = WhisperModel("medium", device=DEVICE, compute_type="int8")
except Exception as e:
    log_info(f"Error loading Whisper model: {e}")

log_info("Loading Stable-Whisper model...")
stable_whisper_model = None
try:
    import stable_whisper
    stable_whisper_model = stable_whisper.load_model('base', device='cpu')
except Exception as e:
    log_info(f"WARNING: Could not load stable_whisper: {e}")

# --- App Setup ---
app = FastAPI()
bearer_scheme = HTTPBearer()

async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    token = ADMIN_CONFIG.get("admin_token")
    if not token or credentials.scheme != "Bearer" or credentials.credentials != token:
        raise HTTPException(status_code=403, detail="Invalid admin token")
    return

app.mount(f"/{CACHE_DIR}", StaticFiles(directory=CACHE_DIR), name="media_cache")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.get("/")
def read_root(): return {"message": "J-Melo Backend is running."}

# --- Media Endpoints ---

@app.get("/api/media/fetch", response_model=MediaFetchResponse)
def media_fetch(url: str = Query(...)):
    info = media_logic.fetch_media_info(url)
    mid = info.get("id")
    if not mid: raise HTTPException(status_code=500, detail="ID extraction failed")
    local_path = os.path.join(CACHE_DIR, f"{mid}.mp3")
    if not os.path.exists(local_path): 
        media_logic.download_media(info, local_path)
    return MediaFetchResponse(
        media_type="audio", 
        title=info.get("title", "Unknown"), 
        artist=info.get("artist") or info.get("uploader"), 
        cover_url=info.get("thumbnail"), 
        duration=info.get("duration", 0), 
        media_url=f"/{CACHE_DIR}/{mid}.mp3", 
        local_path=local_path
    )

@app.get("/api/media/search")
async def api_media_search(q: str = Query(...)):
    return {"results": await media_logic.media_search(q)}

@app.get("/api/media/proxy-image")
async def api_proxy_image(url: str = Query(...)):
    content, mime_type = await media_logic.proxy_image(url)
    return Response(content=content, media_type=mime_type)

# --- Transcription Endpoints ---

@app.post("/api/transcribe")
async def transcribe(request: TranscribeRequest):
    if not whisper_model: raise HTTPException(status_code=500, detail="Whisper not loaded")
    mid = os.path.splitext(os.path.basename(request.local_path))[0]
    cache_path = os.path.join(TRANSCRIPTION_CACHE_DIR, f"{mid}.json")
    if request.force_retranscribe:
        if os.path.exists(cache_path): os.remove(cache_path)
        if mid in transcription_logic.TRANSCRIPTION_TASKS: del transcription_logic.TRANSCRIPTION_TASKS[mid]
    elif os.path.exists(cache_path): return {"status": "cached"}
    transcription_logic.TRANSCRIPTION_TASKS[mid] = {"status": "pending", "started_at": datetime.utcnow().isoformat(), "display_name": request.display_name}
    asyncio.create_task(transcription_logic.process_transcription_task(mid, request.local_path, cache_path, whisper_model))
    return {"status": "started", "queue_position": get_queue_position(mid, transcription_logic.TRANSCRIPTION_TASKS), "transcription_id": mid}

@app.get("/api/transcribe/status/{media_id}")
async def trans_status(media_id: str, local_path: str = Query(None)):
    mid = os.path.splitext(os.path.basename(local_path))[0] if local_path else media_id
    cache_path = os.path.join(TRANSCRIPTION_CACHE_DIR, f"{mid}.json")
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f: return {"status": "completed", "data": json.load(f)}
    task = transcription_logic.TRANSCRIPTION_TASKS.get(mid)
    if task: return {"status": task["status"], "error": task.get("error"), "queue_position": get_queue_position(mid, transcription_logic.TRANSCRIPTION_TASKS)}
    return {"status": "not_found"}

@app.get("/api/public/transcription-tasks")
def public_get_trans_tasks():
    tasks = transcription_logic.TRANSCRIPTION_TASKS
    sorted_tasks = sorted(tasks.items(), key=lambda x: x[1].get('started_at', ''))
    return {"tasks": [{"id": mid, **info, "queue_position": get_queue_position(mid, tasks)} for mid, info in sorted_tasks]}

# --- Alignment Endpoints ---

@app.post("/api/lyrics/align")
async def start_alignment(request: AlignRequest):
    tid = str(uuid.uuid4())
    alignment_logic.ALIGNMENT_TASKS[tid] = {"status": "pending", "message": "Queued", "song_id": request.song_id}
    threading.Thread(target=alignment_logic.run_alignment_task, args=(tid, request.song_id, request.lyrics_data, request.align_mode, stable_whisper_model, request.source_url, request.local_path, request.extract_vocals, request.replace_with_kana)).start()
    return {"status": "queued", "task_id": tid}

@app.get("/api/lyrics/align-status/{task_id}")
async def get_alignment_status(task_id: str):
    task = alignment_logic.ALIGNMENT_TASKS.get(task_id)
    if not task: raise HTTPException(status_code=404)
    return task

# --- Lyrics Processing Endpoints ---

@app.post("/api/lyrics/annotate")
async def api_annotate_lyrics(request: AnnotateRequest):
    return {"annotated_text": annotate_japanese_text(request.text)}

@app.post("/api/lyrics/parse-to-tokens")
async def api_parse_to_tokens(request: AnnotateRequest):
    lines = []; import re
    for l in request.text.split('\n'):
        if not l.strip(): continue
        clean = re.sub(r'\[[^\]]+\]', '', l)
        lines.append({"text": clean, "tokens": parse_utaten_line_to_tokens(l), "startTime": 0, "endTime": 0, "translation": ""})
    return {"lyrics_data": lines}

@app.get("/api/lyrics/search-utaten")
async def search_utaten(q: str = Query(...)):
    return {"results": await lyrics_logic.search_utaten(q)}

@app.get("/api/lyrics/fetch-utaten")
async def fetch_utaten(url: str = Query(...)):
    return await lyrics_logic.fetch_utaten(url)

# --- Community Endpoints ---

@app.post("/api/community/share")
def share_song(payload: SharedSongUpload):
    return community_logic.share_song(payload)

@app.get("/api/community/songs")
def list_songs(q: str = None, sharer: str = None, limit: int = 50, offset: int = 0):
    return {"songs": community_logic.list_songs(q, sharer, limit, offset)}

@app.get("/api/community/songs/{song_id}")
def get_song(song_id: int):
    return community_logic.get_song(song_id)

@app.delete("/api/community/songs/{song_id}")
def delete_song(song_id: int, sharer_name: str = Query(...)):
    return community_logic.delete_song(song_id, sharer_name)

@app.get("/api/community/songs/{song_id}/cover")
def get_cover(song_id: int):
    blob = community_logic.get_cover(song_id)
    return Response(content=blob, media_type="image/jpeg")

# --- Admin Endpoints ---

@app.get("/api/admin/cache-info", dependencies=[Depends(get_admin_user)])
def admin_cache_info():
    return admin_logic.get_cache_info()

@app.post("/api/admin/clear-cache", dependencies=[Depends(get_admin_user)])
def admin_clear_cache(request: ClearCacheRequest):
    return admin_logic.clear_cache(request.cache_name, transcription_logic.TRANSCRIPTION_TASKS)

@app.get("/api/admin/config", dependencies=[Depends(get_admin_user)])
def admin_get_config():
    return {k: ADMIN_CONFIG.get(k) for k in ["admin_token", "proxy", "media_cache_policy", "token_cache_policy", "transcription_cache_policy", "community_policy"]}

@app.post("/api/admin/config", dependencies=[Depends(get_admin_user)])
def admin_update_config(request: UpdateConfigRequest):
    return admin_logic.update_config(request)

@app.get("/api/admin/transcription-tasks", dependencies=[Depends(get_admin_user)])
def admin_trans_tasks():
    return {mid: {"status": i.get("status"), "display_name": i.get("display_name"), "started_at": i.get("started_at"), "error": i.get("error")} for mid, i in transcription_logic.TRANSCRIPTION_TASKS.items()}

@app.delete("/api/admin/community/songs/{song_id}", dependencies=[Depends(get_admin_user)])
def admin_delete_community_song(song_id: int):
    return community_logic.admin_delete_song(song_id)

# --- Data Import/Export Endpoints ---

@app.post("/api/export")
def export_data(payload: Dict[str, Any]):
    return admin_logic.export_user_data(payload)

@app.get("/api/import")
def import_data(token: str = Query(...)):
    return admin_logic.import_user_data(token)

# --- Lifecycle ---

@app.on_event("startup")
async def startup_event():
    community_logic.init_db()
    asyncio.create_task(admin_logic.background_cleanup_task())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
