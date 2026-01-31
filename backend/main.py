import os
import json
import subprocess
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from faster_whisper import WhisperModel


# --- Configuration & Setup ---

# Check for GPU
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {DEVICE}")

# Create cache directory if it doesn't exist
CACHE_DIR = "media_cache"
os.makedirs(CACHE_DIR, exist_ok=True)

app = FastAPI()

# --- Global Models ---
# Load the WhisperX model on startup.
print("Loading Whisper model...")
try:
    model_size = "medium"

    # Run on GPU with FP16
    model = WhisperModel(model_size, device=DEVICE, compute_type="int8")
except Exception as e:
    import traceback
    traceback.print_exc() # 打印详细报错堆栈
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
        # 增加 encoding='utf-8' 防止 Windows 下中文乱码
        result = subprocess.run(command, capture_output=True, text=True, check=True, encoding='utf-8')
        return json.loads(result.stdout)
    except (subprocess.CalledProcessError, json.JSONDecodeError) as e:
        print(f"Detailed yt-dlp error: {e}")
        if isinstance(e, subprocess.CalledProcessError):
            print(e.stderr)
        raise HTTPException(status_code=400, detail=f"Failed to fetch media info: {str(e)}")

def download_media(info: dict, destination: str) -> None:
    url = info.get("webpage_url")
    # 增加 --cookies-from-browser firefox (可选，如果B站下载失败可能需要)
    command = ["yt-dlp", "-f", "bestaudio/best", "--extract-audio", "--audio-format", "mp3", "-o", destination, url]
    try:
        subprocess.run(command, check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Failed to download media. yt-dlp error: {e.stderr.decode('utf-8', errors='ignore')}")

# --- API Endpoints ---

app.mount(f"/{CACHE_DIR}", StaticFiles(directory=CACHE_DIR), name="media_cache")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 开发阶段允许所有来源，避免跨域烦恼
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

        if not os.path.exists(local_path) or request.force_redownload:
            print(f"Cache miss for {media_id}. Downloading...")
            # yt-dlp 的 output template 需要 %(ext)s
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
            media_url=f"/{CACHE_DIR}/{cached_filename}", # 返回完整 URL 方便前端调试
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
        
        # 假设 model.transcribe 返回的是 segments 生成器
        # 注意：Faster-Whisper 返回的是 (segments, info)
        segments, info = model.transcribe(
            audio_path, 
            language="ja", 
            word_timestamps=True # 关键：必须开启这个才有 words
        )
        
        # 因为 segments 是一个生成器，我们需要把它转换成列表
        # 这一步会真正执行推理
        segments_list = list(segments) 
        
        print("Transcription complete. Formatting output...")
        
        # --- 调用上面的转换函数 ---
        formatted_result = format_whisper_output(segments_list)
        
        # 清理内存
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
    """
    将 Faster-Whisper 或类似库的 Segment 对象列表转换为前端所需的 JSON 格式。
    同时处理 np.float64 类型转换。
    """
    formatted_segments = []

    for segment in segments:
        # 1. 处理单词列表 (Words)
        formatted_words = []
        # 检查 segment 是否有 words 属性 (Faster-Whisper 默认就有)
        if hasattr(segment, 'words') and segment.words:
            for word in segment.words:
                formatted_words.append({
                    "word": word.word,
                    # 必须使用 float() 将 np.float64 转换为原生 float
                    "start": float(word.start),
                    "end": float(word.end),
                    # 前端叫 'score'，后端模型输出通常叫 'probability'
                    "score": float(word.probability)
                })

        # 2. 处理段落 (Segment)
        formatted_segment = {
            "start": float(segment.start),
            "end": float(segment.end),
            "text": segment.text.strip(), # 去除首尾空格
            "words": formatted_words
        }
        
        formatted_segments.append(formatted_segment)

    # 3. 返回前端要求的根结构 {"segments": [...]}
    return {"segments": formatted_segments}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)