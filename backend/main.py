import os
import json
import subprocess
import torch
import whisperx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from omegaconf import ListConfig, DictConfig # 显式导入配置类

# --- 🟢 核心修复：双重保险 ---

# 1. 白名单策略：告诉 PyTorch 信任 Omegaconf (解决 WeightsUnpickler error)
try:
    torch.serialization.add_safe_globals([ListConfig, DictConfig])
except Exception as e:
    print(f"Warning: Could not add safe globals: {e}")

# 2. 强制覆盖策略：Monkey Patch torch.load
# 无论调用者传什么参数，都强制 weights_only=False
original_torch_load = torch.load

def patched_torch_load(*args, **kwargs):
    # 强制覆盖，不进行 if 判断
    kwargs['weights_only'] = False 
    return original_torch_load(*args, **kwargs)

torch.load = patched_torch_load
# --- 🟢 核心修复结束 ---


# --- Configuration & Setup ---

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {DEVICE}")

CACHE_DIR = "media_cache"
os.makedirs(CACHE_DIR, exist_ok=True)

app = FastAPI()

# --- Global Models ---
print("Loading WhisperX model...")
try:
    # 这里的 language="ja" 预设可以加快加载速度，但如果不确定可以去掉
    model = whisperx.load_model("base", DEVICE, compute_type="int8")
    print("WhisperX model loaded successfully.")
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"Error loading WhisperX model: {e}")
    model = None

# --- Pydantic Models ---

class MediaFetchRequest(BaseModel):
    url: str
    force_redownload: bool = False

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
        raise HTTPException(status_code=500, detail=f"Failed to download media: {e.stderr.decode('utf-8', errors='ignore')}")

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

@app.post("/api/media/fetch", response_model=MediaFetchResponse)
async def media_fetch(request: MediaFetchRequest):
    try:
        info = fetch_media_info(request.url)
        media_id = info.get("id")
        if not media_id:
            raise HTTPException(status_code=500, detail="Could not extract a unique ID from the media.")

        file_extension = "mp3"
        cached_filename = f"{media_id}.{file_extension}"
        local_path = os.path.join(CACHE_DIR, cached_filename)

        media_is_video = info.get("is_video", False)
        returned_media_type = "video" if media_is_video else "audio"

        if not os.path.exists(local_path) or request.force_redownload:
            print(f"Cache miss for {media_id}. Downloading...")
            download_destination_template = os.path.join(CACHE_DIR, f"{media_id}.%(ext)s")
            # If it's a video, don't extract audio, download best video format
            if media_is_video:
                command = ["yt-dlp", "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]", "--recode-video", "mp4", "-o", download_destination_template, info.get("webpage_url")]
            else:
                command = ["yt-dlp", "-f", "bestaudio/best", "--extract-audio", "--audio-format", "mp3", "-o", download_destination_template, info.get("webpage_url")]
            
            try:
                subprocess.run(command, check=True, capture_output=True)
                # Update cached_filename based on actual downloaded extension if it's video
                if media_is_video:
                    actual_ext = "mp4" # Assuming recode-video to mp4
                    cached_filename = f"{media_id}.{actual_ext}"
                    local_path = os.path.join(CACHE_DIR, cached_filename)
            except subprocess.CalledProcessError as e:
                raise HTTPException(status_code=500, detail=f"Failed to download media: {e.stderr.decode('utf-8', errors='ignore')}")
            print("Download complete.")
        else:
            print(f"Cache hit for {media_id}.")
            # If it's a video, ensure filename reflects mp4
            if media_is_video:
                actual_ext = "mp4"
                cached_filename = f"{media_id}.{actual_ext}"
                local_path = os.path.join(CACHE_DIR, cached_filename)

        return MediaFetchResponse(
            media_type=returned_media_type,
            title=info.get("title", "Unknown Title"),
            artist=info.get("artist") or info.get("uploader"),
            cover_url=info.get("thumbnail"),
            duration=info.get("duration", 0),
            media_url=f"/{CACHE_DIR}/{cached_filename}",
            local_path=local_path
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transcribe")
async def transcribe_audio(request: TranscribeRequest):
    if not model:
        raise HTTPException(status_code=500, detail="WhisperX model is not loaded.")
    
    audio_path = request.local_path
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail=f"Audio file not found at path: {audio_path}")

    try:
        print(f"Loading audio from {audio_path}...")
        audio = whisperx.load_audio(audio_path)

        print("Transcribing audio...")
        # 显式指定日语，提高准确率
        result = model.transcribe(audio, batch_size=4, language="ja")
        
        print("Transcription complete. Aligning...")
        
        # --- 强制对齐逻辑 ---
        model_a, metadata = whisperx.load_align_model(language_code=result["language"], device=DEVICE)
        result = whisperx.align(result["segments"], model_a, metadata, audio, DEVICE, return_char_alignments=False)
        
        # 清理显存
        import gc
        del model_a
        torch.cuda.empty_cache()
        gc.collect()

        print("Alignment complete.")
        return result

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Transcribe error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)