import os
import json
import subprocess
import torch
import httpx
import asyncio
from datetime import datetime, timedelta
import secrets
import shutil
import sqlite3
from pathlib import Path
from fastapi import Depends, FastAPI, HTTPException, Response, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from faster_whisper import WhisperModel
from typing import Dict, Any

# --- Configuration & Setup ---

CONFIG_FILE = "config.json"
DEFAULT_CONFIG = {
    "admin_token": None,
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
            print("WARNING: Could not decode config.json. Using default config.")
else:
    print("WARNING: config.json not found. Admin endpoints will be disabled.")

if not ADMIN_CONFIG.get("admin_token"):
    print("WARNING: 'admin_token' not found in config. Admin endpoints will be disabled.")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {DEVICE}")

CACHE_DIR = "media_cache"
os.makedirs(CACHE_DIR, exist_ok=True)
TEMP_DATA_DIR = "temp_data"
os.makedirs(TEMP_DATA_DIR, exist_ok=True)
TRANSCRIPTION_CACHE_DIR = "transcription_cache"
os.makedirs(TRANSCRIPTION_CACHE_DIR, exist_ok=True)

app = FastAPI()

# In-memory storage for simplicity. For production, consider a more robust solution like Redis.
token_storage = {}
TRANSCRIPTION_TASKS = {} # media_id -> {"status", "error", "started_at", "completed_at", "result_path"}

# --- Global Models ---
print("Loading Whisper model...")
try:
    model_size = "medium"
    model = WhisperModel(model_size, device=DEVICE, compute_type="int8")
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"Error loading WhisperX model: {e}")
    model = None

# --- Security ---
bearer_scheme = HTTPBearer()

async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    token = ADMIN_CONFIG.get("admin_token")
    if not token or credentials.scheme != "Bearer" or credentials.credentials != token:
        raise HTTPException(status_code=403, detail="Invalid or missing admin token")
    return

# --- Pydantic Models ---
class UserData(BaseModel):
    songs: list
    words: list
    settings: dict
    promptTemplates: list
    cardTemplates: list

class MediaFetchResponse(BaseModel):
    media_type: str
    title: str
    artist: str | None = None
    cover_url: str | None = None
    duration: float
    media_url: str
    local_path: str

class TranscribeRequest(BaseModel):
    media_id: str
    local_path: str
    display_name: str | None = "Unknown Track"
    force_retranscribe: bool = False

class ClearCacheRequest(BaseModel):
    cache_name: str

class CachePolicy(BaseModel):
    max_size_gb: int | None = None
    max_age_days: int | None = None
    max_size_mb: int | None = None
    max_age_hours: int | None = None

class UpdateConfigRequest(BaseModel):
    media_cache_policy: CachePolicy | None = None
    token_cache_policy: CachePolicy | None = None
    transcription_cache_policy: CachePolicy | None = None
    community_policy: CachePolicy | None = None

class SharedSongUpload(BaseModel):
    title: str
    artist: str | None = None
    cover_url: str | None = None
    sharer_name: str
    song_data: dict
    words_data: list

# --- Services ---
def fetch_media_info(url: str) -> dict:
    command = ["yt-dlp", "--dump-json", "--no-playlist", url]
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True, encoding='utf-8')
        return json.loads(result.stdout)
    except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
        print(f"Detailed yt-dlp error: {e}")
        if isinstance(e, subprocess.CalledProcessError):
            print(e.stderr)
        raise HTTPException(status_code=400, detail=f"Failed to fetch media info: {str(e)}")

def download_media(info: dict, destination: str) -> None:
    url = info.get("webpage_url")
    command = ["yt-dlp", "-f", "bestaudio/best", "--extract-audio", "--audio-format", "mp3", "-o", destination, url]
    try:
        subprocess.run(command, check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Failed to download media. yt-dlp error: {e.stderr.decode('utf-8', errors='ignore')}")

# --- API Endpoints ---
app.mount(f"/{CACHE_DIR}", StaticFiles(directory=CACHE_DIR), name="media_cache")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "J-Melo Backend is running."}

@app.get("/api/media/proxy-image")
async def proxy_image(url: str = Query(..., description="The URL of the image to proxy")):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, follow_redirects=True)
            response.raise_for_status()
            return Response(content=response.content, media_type=response.headers['content-type'])
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"Error fetching image: {e.response.status_code} {e.response.reason_phrase}")
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Network error fetching image: {e}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

@app.get("/api/media/fetch", response_model=MediaFetchResponse) # Changed to GET
def media_fetch(url: str = Query(..., description="The URL of the media to fetch")): # Changed to Query parameter
    try:
        info = fetch_media_info(url) # Use the url from Query
        media_id = info.get("id")
        if not media_id:
            raise HTTPException(status_code=500, detail="Could not extract a unique ID from the media.")
        file_extension = "mp3"
        cached_filename = f"{media_id}.{file_extension}"
        local_path = os.path.join(CACHE_DIR, cached_filename)
        # Note: force_redownload removed as it would complicate GET, not critical for this use case
        if not os.path.exists(local_path): # Only download if not exists
            print(f"Cache miss for {media_id}. Downloading...")
            download_destination_template = os.path.join(CACHE_DIR, f"{media_id}.%(ext)s")
            download_media(info, download_destination_template)
            print("Download complete.")
        else:
            print(f"Cache hit for {media_id}.")
        return MediaFetchResponse(
            media_type="audio",
            title=info.get("title", "Unknown Title"),
            artist=info.get("artist") or info.get("uploader"),
            cover_url=info.get("thumbnail"),
            duration=info.get("duration", 0),
            media_url=f"/{CACHE_DIR}/{cached_filename}",
            local_path=local_path
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

# Semaphore to limit concurrent transcriptions to 1, preventing GPU/CPU overload
TRANSCRIPTION_SEMAPHORE = asyncio.Semaphore(1)

def run_transcription_blocking(audio_path: str, whisper_model: WhisperModel):
    """Synchronous function that runs the actual transcription."""
    print(f"Starting transcription for {audio_path}...")
    segments, _ = whisper_model.transcribe(audio_path, language="ja", word_timestamps=True)
    segments_list = list(segments)
    print("Transcription complete. Formatting output...")
    formatted_result = format_whisper_output(segments_list)
    
    # Manual garbage collection to free up memory, especially important for GPU memory
    import gc
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        
    return formatted_result

async def process_transcription_task(media_id: str, audio_path: str, cache_path: str):
    try:
        async with TRANSCRIPTION_SEMAPHORE:
            TRANSCRIPTION_TASKS[media_id]["status"] = "processing"
            result = await asyncio.to_thread(run_transcription_blocking, audio_path, model)
            
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False)
                
            TRANSCRIPTION_TASKS[media_id]["status"] = "completed"
            TRANSCRIPTION_TASKS[media_id]["completed_at"] = datetime.utcnow().isoformat()
            TRANSCRIPTION_TASKS[media_id]["result_path"] = cache_path
    except Exception as e:
        TRANSCRIPTION_TASKS[media_id]["status"] = "error"
        TRANSCRIPTION_TASKS[media_id]["error"] = str(e)
        import traceback
        traceback.print_exc()

def get_queue_position(target_media_id: str) -> int:
    """Calculate how many tasks are ahead of the target task in the queue."""
    pending_tasks = [
        media_id for media_id, task in TRANSCRIPTION_TASKS.items()
        if task.get("status") == "pending"
    ]
    # Sort by started_at to simulate a queue
    pending_tasks.sort(key=lambda m_id: TRANSCRIPTION_TASKS[m_id].get("started_at", ""))
    
    try:
        return pending_tasks.index(target_media_id)
    except ValueError:
        return 0 # Not in pending queue (might be processing or completed)

@app.post("/api/transcribe")
async def transcribe_audio(request: TranscribeRequest):
    if not model:
        raise HTTPException(status_code=500, detail="WhisperX model is not loaded.")
    
    media_id = request.media_id
    audio_path = request.local_path
    force_retranscribe = request.force_retranscribe
    cache_path = os.path.join(TRANSCRIPTION_CACHE_DIR, f"{media_id}.json")

    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail=f"Audio file not found at path: {audio_path}")

    if force_retranscribe:
        if os.path.exists(cache_path):
            os.remove(cache_path)
        if media_id in TRANSCRIPTION_TASKS:
            del TRANSCRIPTION_TASKS[media_id]

    if os.path.exists(cache_path) and not force_retranscribe:
        return {"status": "cached", "message": "Transcription result exists in cache."}

    task = TRANSCRIPTION_TASKS.get(media_id)
    if task:
        if task["status"] in ["pending", "processing"]:
            queue_pos = get_queue_position(media_id)
            return {"status": "running", "message": "Transcription is already in progress.", "queue_position": queue_pos, "details": task}
        elif task["status"] == "completed" and not force_retranscribe:
            return {"status": "cached", "message": "Transcription completed.", "details": task}

    # Start new task
    TRANSCRIPTION_TASKS[media_id] = {
        "status": "pending",
        "started_at": datetime.utcnow().isoformat(),
        "audio_path": audio_path,
        "display_name": request.display_name
    }
    
    asyncio.create_task(process_transcription_task(media_id, audio_path, cache_path))
    
    queue_pos = get_queue_position(media_id)
    return {"status": "started", "message": "Transcription started in background.", "queue_position": queue_pos}

@app.get("/api/transcribe/status/{media_id}")
async def get_transcribe_status(media_id: str):
    cache_path = os.path.join(TRANSCRIPTION_CACHE_DIR, f"{media_id}.json")
    
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {"status": "completed", "data": data}
        except Exception as e:
            return {"status": "error", "error": f"Failed to load cached result: {str(e)}"}
            
    task = TRANSCRIPTION_TASKS.get(media_id)
    if task:
        queue_pos = get_queue_position(media_id) if task["status"] == "pending" else 0
        return {"status": task["status"], "error": task.get("error"), "queue_position": queue_pos, "details": task}
        
    return {"status": "not_found", "message": "No transcription found or running for this ID."}

def format_whisper_output(segments):
    formatted_segments = []
    for segment in segments:
        formatted_words = []
        if hasattr(segment, 'words') and segment.words:
            for word in segment.words:
                formatted_words.append({
                    "word": word.word,
                    "start": float(word.start),
                    "end": float(word.end),
                    "score": float(word.probability)
                })
        formatted_segment = {
            "start": float(segment.start),
            "end": float(segment.end),
            "text": segment.text.strip(),
            "words": formatted_words
        }
        formatted_segments.append(formatted_segment)
    return {"segments": formatted_segments}

# --- Data Backup & Restore Endpoints ---

@app.post("/api/export")
def export_data(data: UserData, expire_hours: int = Query(24, ge=1, le=24)):
    token = secrets.token_hex(16)
    expiry_time = datetime.utcnow() + timedelta(hours=expire_hours)
    file_path = os.path.join(TEMP_DATA_DIR, f"{token}.json")

    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data.dict(), f, ensure_ascii=False, indent=4)
    
    token_storage[token] = {
        "expiry_time": expiry_time,
        "file_path": file_path
    }
    
    return {"token": token, "expires_at": expiry_time.isoformat()}

@app.get("/api/import")
def import_data(token: str = Query(...)):
    if token not in token_storage:
        raise HTTPException(status_code=404, detail="Token not found.")

    token_info = token_storage[token]

    if datetime.utcnow() > token_info["expiry_time"]:
        # Clean up expired token and file immediately
        if os.path.exists(token_info["file_path"]):
            os.remove(token_info["file_path"])
        del token_storage[token]
        raise HTTPException(status_code=410, detail="Token has expired.")

    file_path = token_info["file_path"]
    if not os.path.exists(file_path):
        del token_storage[token] # Clean up inconsistent record
        raise HTTPException(status_code=404, detail="Data file not found.")

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    # Clean up after successful retrieval
    os.remove(file_path)
    del token_storage[token]

    return data

# --- Community Sharing Endpoints ---

@app.post("/api/community/share")
def share_song(payload: SharedSongUpload):
    if not payload.sharer_name or not payload.sharer_name.strip():
        raise HTTPException(status_code=400, detail="Sharer name is required.")
        
    db_path = "shared_songs.db"
    
    # Enforce community quota
    quota_mb = ADMIN_CONFIG.get("community_policy", {}).get("max_size_mb")
    if quota_mb and os.path.exists(db_path):
        current_size = os.path.getsize(db_path)
        if current_size > quota_mb * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Community server storage quota exceeded. Cannot share more songs at this time.")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO shared_songs (title, artist, cover_url, sharer_name, song_data, words_data) VALUES (?, ?, ?, ?, ?, ?)",
            (
                payload.title,
                payload.artist,
                payload.cover_url,
                payload.sharer_name,
                json.dumps(payload.song_data, ensure_ascii=False),
                json.dumps(payload.words_data, ensure_ascii=False)
            )
        )
        conn.commit()
        return {"message": "Song shared successfully!", "id": cursor.lastrowid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/community/songs")
def list_shared_songs(q: str = None, sharer: str = None, limit: int = 50, offset: int = 0):
    conn = sqlite3.connect("shared_songs.db")
    cursor = conn.cursor()
    
    query = "SELECT id, title, artist, cover_url, sharer_name, created_at FROM shared_songs WHERE 1=1"
    params = []
    
    if q:
        query += " AND (title LIKE ? OR artist LIKE ?)"
        params.extend([f"%{q}%", f"%{q}%"])
    
    if sharer:
        query += " AND sharer_name = ?"
        params.append(sharer)
        
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    
    try:
        cursor.execute(query, params)
        rows = cursor.fetchall()
        songs = []
        for row in rows:
            songs.append({
                "id": row[0],
                "title": row[1],
                "artist": row[2],
                "cover_url": row[3],
                "sharer_name": row[4],
                "created_at": row[5]
            })
        return {"songs": songs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/community/songs/{song_id}")
def get_shared_song(song_id: int):
    conn = sqlite3.connect("shared_songs.db")
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT song_data, words_data FROM shared_songs WHERE id = ?", (song_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Shared song not found.")
        
        return {
            "songs": [json.loads(row[0])],
            "words": json.loads(row[1])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.delete("/api/community/songs/{song_id}")
def delete_shared_song(song_id: int, sharer_name: str = Query(...)):
    conn = sqlite3.connect("shared_songs.db")
    cursor = conn.cursor()
    try:
        # Check ownership
        cursor.execute("SELECT sharer_name FROM shared_songs WHERE id = ?", (song_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Shared song not found.")
            
        if row[0] != sharer_name:
            raise HTTPException(status_code=403, detail="You do not have permission to delete this song.")
            
        cursor.execute("DELETE FROM shared_songs WHERE id = ?", (song_id,))
        conn.commit()
        return {"message": "Shared song deleted successfully."}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# --- Admin Endpoints ---

def get_dir_size(path='.'):
    total_size = 0
    file_count = 0
    if not os.path.exists(path):
        return 0, 0
    for entry in os.scandir(path):
        if entry.is_file():
            total_size += entry.stat().st_size
            file_count += 1
        elif entry.is_dir():
            size, count = get_dir_size(entry.path)
            total_size += size
            file_count += count
    return total_size, file_count

@app.get("/api/admin/cache-info", dependencies=[Depends(get_admin_user)])
def get_cache_info():
    media_cache_size, media_cache_files = get_dir_size(CACHE_DIR)
    token_cache_size, token_cache_files = get_dir_size(TEMP_DATA_DIR)
    transcription_cache_size, transcription_cache_files = get_dir_size(TRANSCRIPTION_CACHE_DIR)
    
    community_db_size = 0
    if os.path.exists("shared_songs.db"):
        community_db_size = os.path.getsize("shared_songs.db")
        
    return {
        "media_cache": {
            "size_bytes": media_cache_size,
            "file_count": media_cache_files
        },
        "token_cache": {
            "size_bytes": token_cache_size,
            "file_count": token_cache_files
        },
        "transcription_cache": {
            "size_bytes": transcription_cache_size,
            "file_count": transcription_cache_files
        },
        "community_db": {
            "size_bytes": community_db_size
        }
    }

@app.post("/api/admin/clear-cache", dependencies=[Depends(get_admin_user)])
def clear_cache(request: ClearCacheRequest):
    if request.cache_name == "media":
        dir_to_clear = CACHE_DIR
    elif request.cache_name == "tokens":
        dir_to_clear = TEMP_DATA_DIR
    elif request.cache_name == "transcriptions":
        dir_to_clear = TRANSCRIPTION_CACHE_DIR
        TRANSCRIPTION_TASKS.clear() # Also clear active tasks from memory
    else:
        raise HTTPException(status_code=400, detail="Invalid cache name specified.")

    try:
        for filename in os.listdir(dir_to_clear):
            file_path = os.path.join(dir_to_clear, filename)
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
        return {"message": f"Successfully cleared the {request.cache_name} cache."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {e}")

@app.get("/api/admin/config", dependencies=[Depends(get_admin_user)])
def get_config():
    return {
        "media_cache_policy": ADMIN_CONFIG.get("media_cache_policy"),
        "token_cache_policy": ADMIN_CONFIG.get("token_cache_policy"),
        "transcription_cache_policy": ADMIN_CONFIG.get("transcription_cache_policy"),
        "community_policy": ADMIN_CONFIG.get("community_policy"),
    }

@app.post("/api/admin/config", dependencies=[Depends(get_admin_user)])
def update_config(request: UpdateConfigRequest):
    if request.media_cache_policy:
        ADMIN_CONFIG["media_cache_policy"].update(request.media_cache_policy.dict(exclude_unset=True))
    if request.token_cache_policy:
        ADMIN_CONFIG["token_cache_policy"].update(request.token_cache_policy.dict(exclude_unset=True))
    if request.transcription_cache_policy:
        ADMIN_CONFIG.setdefault("transcription_cache_policy", {}).update(request.transcription_cache_policy.dict(exclude_unset=True))
    if request.community_policy:
        ADMIN_CONFIG.setdefault("community_policy", {}).update(request.community_policy.dict(exclude_unset=True))
    
    with open(CONFIG_FILE, "w") as f:
        json.dump(ADMIN_CONFIG, f, indent=4)
    
    return {"message": "Configuration updated successfully."}

@app.get("/api/admin/transcription-tasks", dependencies=[Depends(get_admin_user)])
def admin_get_transcription_tasks():
    # Return a filtered copy of tasks to avoid sending actual file paths
    tasks = {}
    for media_id, info in TRANSCRIPTION_TASKS.items():
        tasks[media_id] = {
            "status": info.get("status"),
            "display_name": info.get("display_name"),
            "started_at": info.get("started_at"),
            "completed_at": info.get("completed_at"),
            "error": info.get("error")
        }
    return tasks

@app.get("/api/admin/community/songs", dependencies=[Depends(get_admin_user)])
def admin_list_shared_songs(limit: int = 100, offset: int = 0):
    conn = sqlite3.connect("shared_songs.db")
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, title, artist, sharer_name, created_at FROM shared_songs ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset))
        rows = cursor.fetchall()
        songs = []
        for row in rows:
            songs.append({
                "id": row[0],
                "title": row[1],
                "artist": row[2],
                "sharer_name": row[3],
                "created_at": row[4]
            })
        
        cursor.execute("SELECT COUNT(id) FROM shared_songs")
        total = cursor.fetchone()[0]
        
        return {"songs": songs, "total": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.delete("/api/admin/community/songs/{song_id}", dependencies=[Depends(get_admin_user)])
def admin_delete_shared_song(song_id: int):
    conn = sqlite3.connect("shared_songs.db")
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM shared_songs WHERE id = ?", (song_id,))
        conn.commit()
        if cursor.rowcount == 0:
             raise HTTPException(status_code=404, detail="Song not found")
        return {"message": "Shared song deleted successfully by admin."}
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# --- Background Tasks ---

async def background_cleanup_task():
    while True:
        await asyncio.sleep(3600)  # Run every hour
        print("Running background cleanup task...")

        now = datetime.utcnow()
        
        # 1. Clean expired temp tokens (in-memory list)
        expired_tokens = [token for token, info in token_storage.items() if now > info["expiry_time"]]
        for token in expired_tokens:
            info = token_storage.pop(token, None)
            if info and os.path.exists(info["file_path"]):
                print(f"Cleaning up expired data file: {info['file_path']}")
                os.remove(info["file_path"])

        # 2. Clean token cache directory based on file age and directory size
        token_policy = ADMIN_CONFIG["token_cache_policy"]
        max_age_hours = token_policy.get("max_age_hours")
        max_size_mb = token_policy.get("max_size_mb")

        files = sorted(Path(TEMP_DATA_DIR).iterdir(), key=os.path.getmtime)
        
        # Age-based cleaning
        if max_age_hours is not None:
            for file_path in files:
                if file_path.is_file():
                    file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                    if (now - file_mtime) > timedelta(hours=max_age_hours):
                        print(f"Token file {file_path} is older than {max_age_hours} hours, deleting.")
                        os.remove(file_path)
                    else:
                        break # Files are sorted by time, so we can stop

        # Size-based cleaning
        if max_size_mb is not None:
            total_size_bytes, _ = get_dir_size(TEMP_DATA_DIR)
            max_size_bytes = max_size_mb * 1024 * 1024
            files = sorted(Path(TEMP_DATA_DIR).iterdir(), key=os.path.getmtime) # Re-fetch sorted files
            while total_size_bytes > max_size_bytes and files:
                oldest_file = files.pop(0)
                if oldest_file.is_file():
                    file_size = oldest_file.stat().st_size
                    print(f"Token cache size ({total_size_bytes / 1024 / 1024:.2f} MB) exceeds limit ({max_size_mb} MB). Deleting oldest file: {oldest_file}")
                    os.remove(oldest_file)
                    total_size_bytes -= file_size

        # 3. Clean media cache directory based on file age and directory size
        media_policy = ADMIN_CONFIG["media_cache_policy"]
        max_age_days = media_policy.get("max_age_days")
        max_size_gb = media_policy.get("max_size_gb")

        files = sorted(Path(CACHE_DIR).iterdir(), key=os.path.getmtime)

        # Age-based cleaning
        if max_age_days is not None:
            for file_path in files:
                if file_path.is_file():
                    file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                    if (now - file_mtime) > timedelta(days=max_age_days):
                        print(f"Media file {file_path} is older than {max_age_days} days, deleting.")
                        os.remove(file_path)
                    else:
                        break # Files are sorted by time

        # Size-based cleaning
        if max_size_gb is not None:
            total_size_bytes, _ = get_dir_size(CACHE_DIR)
            max_size_bytes = max_size_gb * 1024 * 1024 * 1024
            files = sorted(Path(CACHE_DIR).iterdir(), key=os.path.getmtime)
            while total_size_bytes > max_size_bytes and files:
                oldest_file = files.pop(0)
                if oldest_file.is_file():
                    file_size = oldest_file.stat().st_size
                    print(f"Media cache size ({total_size_bytes / 1024**3:.2f} GB) exceeds limit ({max_size_gb} GB). Deleting oldest file: {oldest_file}")
                    os.remove(oldest_file)
                    total_size_bytes -= file_size

        # 4. Clean transcription cache directory
        transcription_policy = ADMIN_CONFIG.get("transcription_cache_policy", {})
        max_age_days_trans = transcription_policy.get("max_age_days")
        max_size_mb_trans = transcription_policy.get("max_size_mb")

        files = sorted(Path(TRANSCRIPTION_CACHE_DIR).iterdir(), key=os.path.getmtime)

        # Age-based cleaning
        if max_age_days_trans is not None:
            for file_path in files:
                if file_path.is_file():
                    file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                    if (now - file_mtime) > timedelta(days=max_age_days_trans):
                        print(f"Transcription file {file_path} is older than {max_age_days_trans} days, deleting.")
                        os.remove(file_path)
                    else:
                        break

        # Size-based cleaning
        if max_size_mb_trans is not None:
            total_size_bytes, _ = get_dir_size(TRANSCRIPTION_CACHE_DIR)
            max_size_bytes = max_size_mb_trans * 1024 * 1024
            files = sorted(Path(TRANSCRIPTION_CACHE_DIR).iterdir(), key=os.path.getmtime)
            while total_size_bytes > max_size_bytes and files:
                oldest_file = files.pop(0)
                if oldest_file.is_file():
                    file_size = oldest_file.stat().st_size
                    print(f"Transcription cache size ({total_size_bytes / 1024 / 1024:.2f} MB) exceeds limit ({max_size_mb_trans} MB). Deleting oldest file: {oldest_file}")
                    os.remove(oldest_file)
                    total_size_bytes -= file_size

@app.on_event("startup")
async def startup_event():
    # Initialize SQLite DB for community shared songs
    conn = sqlite3.connect("shared_songs.db")
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS shared_songs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            artist TEXT,
            cover_url TEXT,
            sharer_name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            song_data TEXT NOT NULL,
            words_data TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()
    
    asyncio.create_task(background_cleanup_task())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
