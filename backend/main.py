import os
import json
import subprocess
import torch
import httpx
from fastapi import FastAPI, HTTPException, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from faster_whisper import WhisperModel

# --- Configuration & Setup ---

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {DEVICE}")

CACHE_DIR = "media_cache"
os.makedirs(CACHE_DIR, exist_ok=True)

app = FastAPI()

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

# --- Pydantic Models ---
# Removed MediaFetchRequest as it's no longer needed for GET method

class MediaFetchResponse(BaseModel):
    media_type: str
    title: str
    artist: str | None = None
    cover_url: str | None = None
    duration: float
    media_url: str
    local_path: str

class TranscribeRequest(BaseModel):
    local_path: str

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
async def media_fetch(url: str = Query(..., description="The URL of the media to fetch")): # Changed to Query parameter
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

@app.post("/api/transcribe")
async def transcribe_audio(request: TranscribeRequest):
    if not model:
        raise HTTPException(status_code=500, detail="WhisperX model is not loaded.")
    audio_path = request.local_path
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail=f"Audio file not found at path: {audio_path}")
    try:
        print(f"Transcribing audio from {audio_path}...")
        segments, info = model.transcribe(audio_path, language="ja", word_timestamps=True)
        segments_list = list(segments) 
        print("Transcription complete. Formatting output...")
        formatted_result = format_whisper_output(segments_list)
        import gc
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        return formatted_result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Transcribe error: {str(e)}")

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)