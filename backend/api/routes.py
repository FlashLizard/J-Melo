import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.config import ADMIN_CONFIG, CACHE_PATH, MEDIA_ROUTE, TRANSCRIPTION_CACHE_PATH, resolve_backend_path
from core.models import (
    AlignRequest,
    AnnotateRequest,
    ClearCacheRequest,
    MediaFetchResponse,
    SharedSongUpload,
    TranscribeRequest,
    UpdateConfigRequest,
)
from core.utils import annotate_japanese_text, get_queue_position, parse_utaten_line_to_tokens
import services.admin_logic as admin_logic
import services.alignment_logic as alignment_logic
import services.community_logic as community_logic
import services.lyrics_logic as lyrics_logic
import services.lyrics_petit_logic as lyrics_petit_logic
import services.media_logic as media_logic
import services.task_queue as task_queue
import services.transcription_logic as transcription_logic

bearer_scheme = HTTPBearer()


def _task_status_response(task: task_queue.TaskRecord) -> Dict[str, Any]:
    response: Dict[str, Any] = {
        "id": task.id,
        "status": task.status,
        "message": task.message,
        "error": task.error,
        "queue_position": task_queue.get_queue_position(task.id),
        "display_name": task.display_name,
        "started_at": task.started_at,
        "completed_at": task.completed_at,
    }
    if task.status == "completed" and task.result:
        response["result"] = task.result
    return response


def register_routes(app: FastAPI, runtime: Dict[str, Any]) -> None:
    async def get_admin_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
        token = ADMIN_CONFIG.get("admin_token")
        if not token or credentials.scheme != "Bearer" or credentials.credentials != token:
            raise HTTPException(status_code=403, detail="Invalid admin token")
        return

    @app.get("/")
    def read_root():
        return {"message": "J-Melo Backend is running."}

    @app.get("/api/tasks/{task_id}")
    def get_task(task_id: str):
        task = task_queue.get_task(task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        return _task_status_response(task)

    @app.get("/api/media/fetch", response_model=MediaFetchResponse)
    def media_fetch(url: str = Query(...)):
        info = media_logic.fetch_media_info(url)
        mid = media_logic.safe_media_id(info.get("id") or info.get("display_id"), f"media_{uuid.uuid5(uuid.NAMESPACE_URL, url).hex}")
        if not mid:
            raise HTTPException(status_code=500, detail="ID extraction failed")
        local_path = CACHE_PATH / f"{mid}.mp3"
        if not local_path.exists():
            media_logic.download_media(info, str(local_path))
        return MediaFetchResponse(
            media_type="audio",
            title=info.get("title", "Unknown"),
            artist=info.get("artist") or info.get("uploader"),
            cover_url=info.get("thumbnail"),
            duration=info.get("duration", 0),
            media_url=f"{MEDIA_ROUTE}/{mid}.mp3",
            local_path=str(local_path),
        )

    @app.get("/api/media/search")
    async def api_media_search(q: str = Query(...)):
        return {"results": await media_logic.media_search(q)}

    @app.get("/api/media/proxy-image")
    async def api_proxy_image(url: str = Query(...)):
        content, mime_type = await media_logic.proxy_image(url)
        return Response(content=content, media_type=mime_type)

    @app.post("/api/transcribe")
    async def transcribe(request: TranscribeRequest):
        if not runtime.get("whisper_model"):
            raise HTTPException(status_code=500, detail="Whisper not loaded")
        media_id = os.path.splitext(os.path.basename(request.local_path))[0] or request.media_id
        local_path = resolve_backend_path(request.local_path)
        cache_path = TRANSCRIPTION_CACHE_PATH / f"{media_id}.json"
        if request.force_retranscribe:
            if cache_path.exists():
                cache_path.unlink()
        elif cache_path.exists():
            return {"status": "cached"}
        task = task_queue.create_task(
            "transcription",
            {
                "media_id": media_id,
                "audio_path": str(local_path),
                "cache_path": str(cache_path),
            },
            display_name=request.display_name,
            task_key=media_id,
        )
        return {
            "status": "started",
            "queue_position": task_queue.get_queue_position(task.id),
            "transcription_id": media_id,
            "task_id": task.id,
        }

    @app.get("/api/transcribe/status/{media_id}")
    async def trans_status(media_id: str, local_path: str = Query(None)):
        mid = os.path.splitext(os.path.basename(local_path))[0] if local_path else media_id
        cache_path = TRANSCRIPTION_CACHE_PATH / f"{mid}.json"
        if cache_path.exists():
            with cache_path.open("r", encoding="utf-8") as f:
                return {"status": "completed", "data": json.load(f)}
        task = task_queue.get_task_by_key("transcription", mid)
        if task:
            return {
                "status": task.status,
                "error": task.error,
                "queue_position": task_queue.get_queue_position(task.id),
                "task_id": task.id,
            }
        legacy_task = transcription_logic.TRANSCRIPTION_TASKS.get(mid)
        if legacy_task:
            return {"status": legacy_task["status"], "error": legacy_task.get("error"), "queue_position": get_queue_position(mid, transcription_logic.TRANSCRIPTION_TASKS)}
        return {"status": "not_found"}

    @app.get("/api/public/transcription-tasks")
    def public_get_trans_tasks():
        tasks = task_queue.list_tasks("transcription", limit=100)
        return {
            "tasks": [
                {
                    "id": task.task_key or task.id,
                    "task_id": task.id,
                    "status": task.status,
                    "display_name": task.display_name,
                    "started_at": task.started_at or task.created_at,
                    "error": task.error,
                    "queue_position": task_queue.get_queue_position(task.id),
                }
                for task in tasks
            ]
        }

    @app.post("/api/lyrics/align")
    async def start_alignment(request: AlignRequest):
        task_id = str(uuid.uuid4())
        task = task_queue.create_task(
            "alignment",
            {
                "song_id": request.song_id,
                "source_url": request.source_url,
                "local_path": request.local_path,
                "lyrics_data": request.lyrics_data,
                "align_mode": request.align_mode,
                "extract_vocals": request.extract_vocals,
                "replace_with_kana": request.replace_with_kana,
            },
            display_name=f"Song {request.song_id}",
            task_id=task_id,
            task_key=task_id,
            replace_terminal=False,
        )
        return {"status": "queued", "task_id": task.id}

    @app.get("/api/lyrics/align-status/{task_id}")
    async def get_alignment_status(task_id: str):
        task = task_queue.get_task(task_id)
        if task:
            if task.status == "completed":
                return {"status": "completed", "message": task.message, "result": task.result}
            if task.status == "failed":
                return {"status": "failed", "message": task.error}
            return {"status": task.status, "message": task.message or "Queued"}
        legacy_task = alignment_logic.ALIGNMENT_TASKS.get(task_id)
        if not legacy_task:
            raise HTTPException(status_code=404)
        return legacy_task

    @app.post("/api/lyrics/annotate")
    async def api_annotate_lyrics(request: AnnotateRequest):
        return {"annotated_text": annotate_japanese_text(request.text)}

    @app.post("/api/lyrics/parse-to-tokens")
    async def api_parse_to_tokens(request: AnnotateRequest):
        lines = []
        import re
        for line in request.text.split("\n"):
            if not line.strip():
                continue
            clean = re.sub(r"\[[^\]]+\]", "", line)
            lines.append({"text": clean, "tokens": parse_utaten_line_to_tokens(line), "startTime": 0, "endTime": 0, "translation": ""})
        return {"lyrics_data": lines}

    @app.get("/api/lyrics/search-utaten")
    async def search_utaten(q: str = Query(...)):
        return {"results": await lyrics_logic.search_utaten(q)}

    @app.get("/api/lyrics/fetch-utaten")
    async def fetch_utaten(url: str = Query(...)):
        return await lyrics_logic.fetch_utaten(url)

    @app.get("/api/lyrics/search-petitlyrics")
    async def api_search_petitlyrics(q: str = Query(...), artist: str = Query("")):
        return {"results": await lyrics_petit_logic.search_petitlyrics(q, artist)}

    @app.get("/api/lyrics/fetch-petitlyrics")
    async def api_fetch_petitlyrics(lyrics_id: str = Query(...)):
        return {"lyrics_data": await lyrics_petit_logic.fetch_petitlyrics_data(lyrics_id)}

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

    @app.get("/api/admin/cache-info", dependencies=[Depends(get_admin_user)])
    def admin_cache_info():
        return admin_logic.get_cache_info()

    @app.post("/api/admin/clear-cache", dependencies=[Depends(get_admin_user)])
    def admin_clear_cache(request: ClearCacheRequest):
        return admin_logic.clear_cache(request.cache_name, transcription_logic.TRANSCRIPTION_TASKS)

    @app.get("/api/admin/config", dependencies=[Depends(get_admin_user)])
    def admin_get_config():
        return {
            k: ADMIN_CONFIG.get(k)
            for k in [
                "admin_token",
                "proxy",
                "cors_origins",
                "media_cache_dir",
                "temp_data_dir",
                "transcription_cache_dir",
                "community_db_path",
                "task_db_path",
                "task_worker_enabled",
                "media_cache_policy",
                "token_cache_policy",
                "transcription_cache_policy",
                "community_policy",
                "max_upload_mb",
                "transcription_model",
                "transcription_compute_type",
                "alignment_model",
                "load_transcription_model",
                "load_alignment_model",
            ]
        }

    @app.post("/api/admin/config", dependencies=[Depends(get_admin_user)])
    def admin_update_config(request: UpdateConfigRequest):
        return admin_logic.update_config(request)

    @app.get("/api/admin/transcription-tasks", dependencies=[Depends(get_admin_user)])
    def admin_trans_tasks():
        return {
            task.task_key or task.id: {
                "status": task.status,
                "display_name": task.display_name,
                "started_at": task.started_at or task.created_at,
                "error": task.error,
                "task_id": task.id,
            }
            for task in task_queue.list_tasks("transcription", limit=100)
        }

    @app.delete("/api/admin/community/songs/{song_id}", dependencies=[Depends(get_admin_user)])
    def admin_delete_community_song(song_id: int):
        return community_logic.admin_delete_song(song_id)

    @app.post("/api/export")
    def export_data(payload: Dict[str, Any]):
        return admin_logic.export_user_data(payload)

    @app.get("/api/import")
    def import_data(token: str = Query(...)):
        return admin_logic.import_user_data(token)
