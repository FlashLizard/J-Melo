import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.routes import register_routes
from core.config import ADMIN_CONFIG, CACHE_PATH, DEVICE, MEDIA_ROUTE
from core.utils import log_info
import services.admin_logic as admin_logic
import services.alignment_logic as alignment_logic
import services.community_logic as community_logic
import services.task_queue as task_queue
import services.transcription_logic as transcription_logic

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s", datefmt="%Y-%m-%d %H:%M:%S")


def _env_flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _should_load_model(config_key: str) -> bool:
    return bool(ADMIN_CONFIG.get(config_key, True)) and not _env_flag("J_MELO_SKIP_MODELS")


async def _run_alignment_task(task: task_queue.TaskRecord, stable_whisper_model: Any) -> Dict[str, Any]:
    legacy_task_id = f"queue_{task.id}"
    alignment_logic.ALIGNMENT_TASKS[legacy_task_id] = {
        "status": "pending",
        "message": "Queued",
        "song_id": task.payload.get("song_id"),
    }
    await asyncio.to_thread(
        alignment_logic.run_alignment_task,
        legacy_task_id,
        task.payload.get("song_id"),
        task.payload.get("lyrics_data", []),
        task.payload.get("align_mode", "word"),
        stable_whisper_model,
        task.payload.get("source_url"),
        task.payload.get("local_path"),
        task.payload.get("extract_vocals", True),
        task.payload.get("replace_with_kana", False),
    )
    result = alignment_logic.ALIGNMENT_TASKS.get(legacy_task_id, {})
    if result.get("status") != "completed":
        raise RuntimeError(result.get("message") or "Alignment failed")
    return {
        "message": result.get("message", "Success"),
        **(result.get("result") or {}),
    }


def create_app() -> FastAPI:
    runtime: Dict[str, Any] = {"whisper_model": None, "stable_whisper_model": None}

    if _should_load_model("load_transcription_model"):
        log_info("Loading Whisper model...")
        try:
            from faster_whisper import WhisperModel

            runtime["whisper_model"] = WhisperModel(
                ADMIN_CONFIG.get("transcription_model", "medium"),
                device=DEVICE,
                compute_type=ADMIN_CONFIG.get("transcription_compute_type", "int8"),
            )
        except Exception as e:
            log_info(f"Error loading Whisper model: {e}")
    else:
        log_info("Skipping Whisper model loading.")

    if _should_load_model("load_alignment_model"):
        log_info("Loading Stable-Whisper model...")
        try:
            import stable_whisper

            runtime["stable_whisper_model"] = stable_whisper.load_model(
                ADMIN_CONFIG.get("alignment_model", "base"),
                device="cpu",
            )
        except Exception as e:
            log_info(f"WARNING: Could not load stable_whisper: {e}")
    else:
        log_info("Skipping Stable-Whisper model loading.")

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        community_logic.init_db()
        task_queue.init_db()

        async def transcription_handler(task: task_queue.TaskRecord) -> Dict[str, Any]:
            if not runtime.get("whisper_model"):
                raise RuntimeError("Whisper model not loaded")
            result = await asyncio.to_thread(
                transcription_logic.transcribe_to_cache,
                task.payload["audio_path"],
                task.payload["cache_path"],
                runtime["whisper_model"],
            )
            return {"message": "Success", "data": result, "result_path": task.payload["cache_path"]}

        async def alignment_handler(task: task_queue.TaskRecord) -> Dict[str, Any]:
            if not runtime.get("stable_whisper_model"):
                raise RuntimeError("Stable-Whisper model not loaded")
            return await _run_alignment_task(task, runtime["stable_whisper_model"])

        task_queue.register_handler("transcription", transcription_handler)
        task_queue.register_handler("alignment", alignment_handler)

        background_tasks = []
        if ADMIN_CONFIG.get("task_worker_enabled", True):
            background_tasks.append(asyncio.create_task(task_queue.worker_loop()))
        background_tasks.append(asyncio.create_task(admin_logic.background_cleanup_task()))
        try:
            yield
        finally:
            for background_task in background_tasks:
                background_task.cancel()
            await asyncio.gather(*background_tasks, return_exceptions=True)

    app = FastAPI(title="J-Melo Backend", lifespan=lifespan)
    app.mount(MEDIA_ROUTE, StaticFiles(directory=str(CACHE_PATH)), name="media_cache")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ADMIN_CONFIG.get("cors_origins", ["*"]),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_routes(app, runtime)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
