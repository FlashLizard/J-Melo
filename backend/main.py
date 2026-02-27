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
import base64
from pathlib import Path
from bs4 import BeautifulSoup
from fastapi import Depends, FastAPI, HTTPException, Response, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from faster_whisper import WhisperModel
from typing import Dict, Any, List

# --- Configuration & Setup ---

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
TRANSCRIPTION_TASKS = {} # audio_identifier -> {"status", "error", "started_at", "completed_at", "result_path", "display_name"}
BACKGROUND_TASKS: List[asyncio.Task] = []

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
    admin_token: str | None = None
    proxy: str | None = None
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
    proxy = ADMIN_CONFIG.get("proxy")
    if proxy:
        command.extend(["--proxy", proxy])
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
    # To fix mobile browser seeking desync (where audio plays slower than the reported currentTime),
    # we must force a Constant Bitrate (CBR) re-encoding. VBR or direct extraction often leads to 
    # corrupt seeking tables in HTML5 <audio> elements.
    command = [
        "yt-dlp", 
        "-f", "bestaudio", 
        "--extract-audio", 
        "--audio-format", "mp3", 
        "--audio-quality", "128K", # Forces CBR 128kbps in yt-dlp's ffmpeg call
        "-o", destination, 
        url
    ]
    proxy = ADMIN_CONFIG.get("proxy")
    if proxy:
        command.extend(["--proxy", proxy])
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
    proxy = ADMIN_CONFIG.get("proxy")
    async with httpx.AsyncClient(proxy=proxy) as client:
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
    
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail=f"Audio file not found at path: {audio_path}")
        
    audio_filename = os.path.basename(audio_path)
    audio_identifier = os.path.splitext(audio_filename)[0]
    cache_path = os.path.join(TRANSCRIPTION_CACHE_DIR, f"{audio_identifier}.json")

    if force_retranscribe:
        if os.path.exists(cache_path):
            os.remove(cache_path)
        if audio_identifier in TRANSCRIPTION_TASKS:
            del TRANSCRIPTION_TASKS[audio_identifier]

    if os.path.exists(cache_path) and not force_retranscribe:
        return {"status": "cached", "message": "Transcription result exists in cache."}

    task = TRANSCRIPTION_TASKS.get(audio_identifier)
    if task:
        if task["status"] in ["pending", "processing"]:
            queue_pos = get_queue_position(audio_identifier)
            return {"status": "running", "message": "Transcription is already in progress.", "queue_position": queue_pos, "details": task}
        elif task["status"] == "completed" and not force_retranscribe:
            return {"status": "cached", "message": "Transcription completed.", "details": task}

    TRANSCRIPTION_TASKS[audio_identifier] = {
        "status": "pending",
        "started_at": datetime.utcnow().isoformat(),
        "audio_path": audio_path,
        "display_name": request.display_name
    }
    
    asyncio.create_task(process_transcription_task(audio_identifier, audio_path, cache_path))
    
    queue_pos = get_queue_position(audio_identifier)
    return {"status": "started", "message": "Transcription started in background.", "queue_position": queue_pos, "transcription_id": audio_identifier}

@app.get("/api/transcribe/status/{media_id}")
async def get_transcribe_status(media_id: str, local_path: str = Query(None)):
    audio_identifier = media_id
    if local_path and os.path.exists(local_path):
         audio_identifier = os.path.splitext(os.path.basename(local_path))[0]
         
    cache_path = os.path.join(TRANSCRIPTION_CACHE_DIR, f"{audio_identifier}.json")
    
    if os.path.exists(cache_path):
        try:
            with open(cache_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {"status": "completed", "data": data}
        except Exception as e:
            return {"status": "error", "error": f"Failed to load cached result: {str(e)}"}
            
    task = TRANSCRIPTION_TASKS.get(audio_identifier)
    if task:
        queue_pos = get_queue_position(audio_identifier) if task["status"] == "pending" else 0
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
        if os.path.exists(token_info["file_path"]):
            os.remove(token_info["file_path"])
        del token_storage[token]
        raise HTTPException(status_code=410, detail="Token has expired.")

    file_path = token_info["file_path"]
    if not os.path.exists(file_path):
        del token_storage[token]
        raise HTTPException(status_code=404, detail="Data file not found.")

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    os.remove(file_path)
    del token_storage[token]

    return data

def search_media(query: str, results: int = 10) -> list:
    search_prefix = "ytsearch"
    command = ["yt-dlp", f"{search_prefix}{results}:{query}", "--dump-json", "--no-playlist", "--flat-playlist"]
    proxy = ADMIN_CONFIG.get("proxy")
    if proxy:
        command.extend(["--proxy", proxy])
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True, encoding='utf-8')
        search_results = []
        for line in result.stdout.strip().split('\n'):
            if not line: continue
            info = json.loads(line)
            item_id = info.get("id")
            url = f"https://www.youtube.com/watch?v={item_id}"
            search_results.append({
                "id": item_id, "title": info.get("title"), "uploader": info.get("uploader") or info.get("channel"),
                "duration": info.get("duration"), "url": url,
                "thumbnail": info.get("thumbnail") or (info.get("thumbnails")[0].get("url") if info.get("thumbnails") else None)
            })
        return search_results
    except subprocess.CalledProcessError as e:
        print(f"yt-dlp search error: {e.stderr}")
        return []
    except Exception as e:
        print(f"Unexpected search error: {str(e)}")
        return []

@app.get("/api/media/search")
def media_search(q: str = Query(..., description="Search query")):
    results = search_media(q)
    return {"results": results}

# --- External Tools ---

@app.get("/api/lyrics/search-utaten")
async def search_utaten_lyrics(q: str = Query(..., description="Song title to search on utaten")):
    url = f"https://utaten.com/search?sort=popular_sort_asc&artist_name=&title={q}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    proxy = ADMIN_CONFIG.get("proxy")
    
    async with httpx.AsyncClient(proxy=proxy) as client:
        try:
            response = await client.get(url, headers=headers, follow_redirects=True)
            response.raise_for_status()
            html = response.text
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch Utaten search page: {str(e)}")

    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'html.parser')
        results = []
        
        # Utaten search results are in a table, each row is a song
        for row in soup.select("tr"):
            title_td = row.select_one("td:has(.searchResult__title)")
            artist_td = row.select_one("td.searchResult__artist")
            
            if title_td and artist_td:
                title_a = title_td.select_one(".searchResult__title a")
                artist_a = artist_td.select_one("p a")
                
                if title_a:
                    title = title_a.get_text(strip=True)
                    href = title_a.get("href")
                    if href and href.startswith("/"):
                        href = "https://utaten.com" + href
                    
                    artist = artist_a.get_text(strip=True) if artist_a else "Unknown"
                    
                    results.append({
                        "title": title,
                        "artist": artist,
                        "url": href
                    })
                    
        return {"results": results}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error parsing Utaten search results: {str(e)}")

@app.get("/api/lyrics/fetch-utaten")
async def fetch_utaten_lyrics(url: str = Query(..., description="The Utaten URL to fetch lyrics from")):
    if not url.startswith("https://utaten.com/"):
        raise HTTPException(status_code=400, detail="Invalid URL. Only utaten.com URLs are supported.")
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    proxy = ADMIN_CONFIG.get("proxy")
    
    async with httpx.AsyncClient(proxy=proxy) as client:
        try:
            response = await client.get(url, headers=headers, follow_redirects=True)
            response.raise_for_status()
            html = response.text
            
            # Save HTML for debugging
            with open("debug_utaten.html", "w", encoding="utf-8") as debug_file:
                debug_file.write(html)
                
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch Utaten page: {str(e)}")

    try:
        # Use html5lib because Utaten's HTML is often malformed (e.g., unclosed tags, naked text nodes)
        soup = BeautifulSoup(html, 'html5lib')
        lyrics_div = soup.select_one(".hiragana")
        if not lyrics_div:
            raise HTTPException(status_code=404, detail="Could not find lyrics content on the page.")

        def process_node(element):
            clean = ""
            furi = ""
            if not hasattr(element, 'children'):
                return clean, furi
                
            for child in element.children:
                if isinstance(child, str):
                    clean += child
                    furi += child
                elif child.name == "br":
                    clean += "\n"
                    furi += "\n"
                elif child.name == "span" and "ruby" in child.get("class", []):
                    rb = child.select_one(".rb")
                    rt = child.select_one(".rt")
                    if rb and rt:
                        rb_text = rb.get_text().strip()
                        rt_text = rt.get_text().strip()
                        clean += rb_text
                        furi += f"{rb_text}[{rt_text}]"
                    else:
                        text = child.get_text()
                        clean += text
                        furi += text
                elif child.name == "ruby":
                    rt = child.select_one("rt")
                    rb_text = ""
                    for c in child.children:
                        if isinstance(c, str): rb_text += c
                        elif c.name != "rt": rb_text += c.get_text()
                    
                    rt_text = rt.get_text() if rt else ""
                    clean += rb_text
                    if rt_text:
                        furi += f"{rb_text}[{rt_text}]"
                    else:
                        furi += rb_text
                elif hasattr(child, 'children'):
                    c, f = process_node(child)
                    clean += c
                    furi += f
            return clean, furi

        total_clean, total_furi = process_node(lyrics_div)
        
        import re
        # Clean up multiple consecutive newlines and leading/trailing whitespace on lines
        total_furi = "\n".join([line.strip() for line in total_furi.split("\n")])
        total_furi = re.sub(r'\n{3,}', '\n\n', total_furi).strip()
        
        total_clean = "\n".join([line.strip() for line in total_clean.split("\n")])
        total_clean = re.sub(r'\n{3,}', '\n\n', total_clean).strip()

        return {
            "clean_text": total_clean,
            "furigana_text": total_furi
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing Utaten lyrics: {str(e)}")

@app.post("/api/community/share")
def share_song(payload: SharedSongUpload):
    if not payload.sharer_name or not payload.sharer_name.strip():
        raise HTTPException(status_code=400, detail="Sharer name is required.")
    db_path = "shared_songs.db"
    quota_mb = ADMIN_CONFIG.get("community_policy", {}).get("max_size_mb")
    if quota_mb and os.path.exists(db_path):
        if os.path.getsize(db_path) > quota_mb * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Community server storage quota exceeded.")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        # Extract cover data if present
        cover_blob = None
        cover_image_data = payload.song_data.get("coverImageData")
        if cover_image_data:
            if "," in cover_image_data:
                cover_image_data = cover_image_data.split(",")[1]
            cover_blob = base64.b64decode(cover_image_data)

        cursor.execute(
            "INSERT INTO shared_songs (title, artist, cover_url, sharer_name, song_data, words_data, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                payload.title,
                payload.artist,
                payload.cover_url, # Original URL as fallback
                payload.sharer_name,
                json.dumps(payload.song_data, ensure_ascii=False),
                json.dumps(payload.words_data, ensure_ascii=False),
                cover_blob
            )
        )
        song_id = cursor.lastrowid
        
        # Update the cover_url to point to our internal server endpoint
        if cover_blob:
            new_cover_url = f"/api/community/songs/{song_id}/cover"
            cursor.execute("UPDATE shared_songs SET cover_url = ? WHERE id = ?", (new_cover_url, song_id))
            
        conn.commit()
        return {"message": "Song shared successfully!", "id": song_id}
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
        songs = [{"id": r[0], "title": r[1], "artist": r[2], "cover_url": r[3], "sharer_name": r[4], "created_at": r[5]} for r in rows]
        return {"songs": songs}
    finally:
        conn.close()

@app.get("/api/community/songs/{song_id}")
def get_shared_song(song_id: int):
    conn = sqlite3.connect("shared_songs.db")
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT song_data, words_data, cover_image, cover_url FROM shared_songs WHERE id = ?", (song_id,))
        row = cursor.fetchone()
        if not row: raise HTTPException(status_code=404, detail="Shared song not found.")
        
        song_data = json.loads(row[0])
        words_data = json.loads(row[1])
        cover_image = row[2]
        cover_url = row[3]
        
        if cover_image:
            encoded_string = base64.b64encode(cover_image).decode('utf-8')
            song_data["coverImageData"] = f"data:image/jpeg;base64,{encoded_string}"
        
        song_data["cover_url"] = cover_url
        return {"songs": [song_data], "words": words_data}
    finally:
        conn.close()

@app.get("/api/community/songs/{song_id}/cover")
def get_community_cover(song_id: int):
    conn = sqlite3.connect("shared_songs.db")
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT cover_image FROM shared_songs WHERE id = ?", (song_id,))
        row = cursor.fetchone()
        if not row or not row[0]:
            raise HTTPException(status_code=404, detail="Cover not found.")
        return Response(content=row[0], media_type="image/jpeg")
    finally:
        conn.close()

@app.delete("/api/community/songs/{song_id}")
def delete_shared_song(song_id: int, sharer_name: str = Query(...)):
    conn = sqlite3.connect("shared_songs.db")
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT sharer_name FROM shared_songs WHERE id = ?", (song_id,))
        row = cursor.fetchone()
        if not row or row[0] != sharer_name: raise HTTPException(status_code=403, detail="Permission denied.")
        cursor.execute("DELETE FROM shared_songs WHERE id = ?", (song_id,))
        conn.commit()
        return {"message": "Deleted successfully."}
    finally:
        conn.close()

def get_dir_size(path='.'):
    total_size = 0
    file_count = 0
    if not os.path.exists(path): return 0, 0
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
    community_db_size = os.path.getsize("shared_songs.db") if os.path.exists("shared_songs.db") else 0
    return {
        "media_cache": {"size_bytes": media_cache_size, "file_count": media_cache_files},
        "token_cache": {"size_bytes": token_cache_size, "file_count": token_cache_files},
        "transcription_cache": {"size_bytes": transcription_cache_size, "file_count": transcription_cache_files},
        "community_db": {"size_bytes": community_db_size}
    }

@app.post("/api/admin/clear-cache", dependencies=[Depends(get_admin_user)])
def clear_cache(request: ClearCacheRequest):
    dir_to_clear = {"media": CACHE_DIR, "tokens": TEMP_DATA_DIR, "transcriptions": TRANSCRIPTION_CACHE_DIR}.get(request.cache_name)
    if not dir_to_clear: raise HTTPException(status_code=400, detail="Invalid cache name.")
    try:
        if request.cache_name == "transcriptions": TRANSCRIPTION_TASKS.clear()
        for filename in os.listdir(dir_to_clear):
            file_path = os.path.join(dir_to_clear, filename)
            if os.path.isfile(file_path) or os.path.islink(file_path): os.unlink(file_path)
            elif os.path.isdir(file_path): shutil.rmtree(file_path)
        return {"message": "Cleared successfully."}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/config", dependencies=[Depends(get_admin_user)])
def get_config():
    return {k: ADMIN_CONFIG.get(k) for k in ["admin_token", "proxy", "media_cache_policy", "token_cache_policy", "transcription_cache_policy", "community_policy"]}

@app.post("/api/admin/config", dependencies=[Depends(get_admin_user)])
def update_config(request: UpdateConfigRequest):
    if request.admin_token: ADMIN_CONFIG["admin_token"] = request.admin_token
    if request.proxy is not None: ADMIN_CONFIG["proxy"] = request.proxy if request.proxy.strip() else None
    if request.media_cache_policy: ADMIN_CONFIG["media_cache_policy"].update(request.media_cache_policy.dict(exclude_unset=True))
    if request.token_cache_policy: ADMIN_CONFIG["token_cache_policy"].update(request.token_cache_policy.dict(exclude_unset=True))
    if request.transcription_cache_policy: ADMIN_CONFIG.setdefault("transcription_cache_policy", {}).update(request.transcription_cache_policy.dict(exclude_unset=True))
    if request.community_policy: ADMIN_CONFIG.setdefault("community_policy", {}).update(request.community_policy.dict(exclude_unset=True))
    with open(CONFIG_FILE, "w") as f: json.dump(ADMIN_CONFIG, f, indent=4)
    return {"message": "Updated successfully."}

@app.get("/api/admin/transcription-tasks", dependencies=[Depends(get_admin_user)])
def admin_get_transcription_tasks():
    return {m_id: {"status": i.get("status"), "display_name": i.get("display_name"), "started_at": i.get("started_at"), "completed_at": i.get("completed_at"), "error": i.get("error")} for m_id, i in TRANSCRIPTION_TASKS.items()}

@app.get("/api/public/transcription-tasks")
def public_get_transcription_tasks():
    """Public endpoint to view the status of all transcription tasks."""
    tasks = []
    # Sort tasks by start time to show a clear queue order
    sorted_tasks = sorted(TRANSCRIPTION_TASKS.items(), key=lambda item: item[1].get('started_at', ''))
    
    for media_id, info in sorted_tasks:
        tasks.append({
            "id": media_id,
            "status": info.get("status"),
            "display_name": info.get("display_name"),
            "started_at": info.get("started_at"),
            "completed_at": info.get("completed_at"),
            "error": info.get("error"),
        })
    return {"tasks": tasks}

@app.get("/api/admin/community/songs", dependencies=[Depends(get_admin_user)])
def admin_list_shared_songs(limit: int = 100, offset: int = 0):
    conn = sqlite3.connect("shared_songs.db")
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, title, artist, sharer_name, created_at FROM shared_songs ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit, offset))
        songs = [{"id": r[0], "title": r[1], "artist": r[2], "sharer_name": r[3], "created_at": r[4]} for r in cursor.fetchall()]
        cursor.execute("SELECT COUNT(id) FROM shared_songs")
        return {"songs": songs, "total": cursor.fetchone()[0]}
    finally:
        conn.close()

@app.delete("/api/admin/community/songs/{song_id}")
def admin_delete_shared_song(song_id: int):
    conn = sqlite3.connect("shared_songs.db")
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM shared_songs WHERE id = ?", (song_id,))
        conn.commit()
        return {"message": "Deleted by admin."}
    finally:
        conn.close()

async def background_cleanup_task():
    while True:
        try:
            await asyncio.sleep(3600)
            now = datetime.utcnow()
            for token, info in list(token_storage.items()):
                if now > info["expiry_time"]:
                    if os.path.exists(info["file_path"]): os.remove(info["file_path"])
                    del token_storage[token]
            for dir_path, policy, unit in [(CACHE_DIR, ADMIN_CONFIG["media_cache_policy"], "days"), (TEMP_DATA_DIR, ADMIN_CONFIG["token_cache_policy"], "hours"), (TRANSCRIPTION_CACHE_DIR, ADMIN_CONFIG.get("transcription_cache_policy", {}), "days")]:
                max_age = policy.get(f"max_age_{unit}")
                max_size = policy.get("max_size_gb") if unit == "days" else policy.get("max_size_mb")
                if not os.path.exists(dir_path): continue
                files = sorted(Path(dir_path).iterdir(), key=os.path.getmtime)
                if max_age:
                    for f in files:
                        if (now - datetime.fromtimestamp(f.stat().st_mtime)) > (timedelta(days=max_age) if unit == "days" else timedelta(hours=max_age)): os.remove(f)
                        else: break
                if max_size:
                    curr_size, _ = get_dir_size(dir_path)
                    limit = max_size * 1024**3 if unit == "days" else max_size * 1024**2
                    files = sorted(Path(dir_path).iterdir(), key=os.path.getmtime)
                    while curr_size > limit and files:
                        f = files.pop(0)
                        curr_size -= f.stat().st_size
                        os.remove(f)
        except asyncio.CancelledError: break
        except Exception as e: print(f"Cleanup error: {e}")

@app.on_event("startup")
async def startup_event():
    conn = sqlite3.connect("shared_songs.db")
    # Added cover_image column as BLOB
    conn.execute("CREATE TABLE IF NOT EXISTS shared_songs (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, artist TEXT, cover_url TEXT, sharer_name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, song_data TEXT NOT NULL, words_data TEXT NOT NULL, cover_image BLOB)")
    conn.close()
    task = asyncio.create_task(background_cleanup_task())
    BACKGROUND_TASKS.append(task)

@app.on_event("shutdown")
async def shutdown_event():
    for task in BACKGROUND_TASKS:
        task.cancel()
    await asyncio.gather(*BACKGROUND_TASKS, return_exceptions=True)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
