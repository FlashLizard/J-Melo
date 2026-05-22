import asyncio
import json
import os
import re
import sqlite3
import subprocess
import sys
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import httpx
from fastapi import HTTPException

from core.config import ADMIN_CONFIG, BASE_DIR, CACHE_PATH, MEDIA_ROUTE
from core.utils import log_info
from services.network import DEFAULT_USER_AGENT, async_client, normalize_non_empty_query, validate_external_http_url

IMAGE_PROXY_MAX_BYTES = 8 * 1024 * 1024
YTDLP_INFO_TIMEOUT_SECONDS = 90
YTDLP_DOWNLOAD_TIMEOUT_SECONDS = 240
YTDLP_SEARCH_TIMEOUT_SECONDS = 60
MEDIA_INDEX_PATH = BASE_DIR / "media_cache_index.db"


def _positive_int_config(key: str, default: int) -> int:
    try:
        value = int(ADMIN_CONFIG.get(key, default))
    except (TypeError, ValueError):
        return default
    return max(1, value)


_MEDIA_COMMAND_SEMAPHORE_LOCK = threading.Lock()
_media_command_limit = _positive_int_config("media_command_concurrency", 1)
_MEDIA_COMMAND_SEMAPHORE = threading.BoundedSemaphore(_media_command_limit)
_MEDIA_INDEX_LOCK = threading.Lock()
_media_index_initialized = False
_media_fetch_locks: dict[str, asyncio.Lock] = {}
_media_fetch_locks_guard: asyncio.Lock | None = None
_media_fetch_locks_loop: asyncio.AbstractEventLoop | None = None
_async_media_command_semaphore: asyncio.BoundedSemaphore | None = None
_async_media_command_loop: asyncio.AbstractEventLoop | None = None
_async_media_command_limit = 0
_async_image_proxy_semaphore: asyncio.BoundedSemaphore | None = None
_async_image_proxy_loop: asyncio.AbstractEventLoop | None = None
_async_image_proxy_limit = 0


def _yt_dlp_command(*args: str) -> list[str]:
    return [sys.executable, "-m", "yt_dlp", *args]


def safe_media_id(raw_id: str | None, fallback: str = "media") -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", (raw_id or "").strip()).strip("._-")
    return (cleaned or fallback)[:120]


def _proxy_args() -> list[str]:
    proxy = ADMIN_CONFIG.get("proxy")
    return ["--proxy", proxy] if proxy else []


def _extract_yt_dlp_error(stderr: bytes | str | None, fallback: str) -> str:
    text = stderr.decode("utf-8", errors="ignore") if isinstance(stderr, bytes) else (stderr or "")
    useful_lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not useful_lines:
        return fallback
    return useful_lines[-1][:500]


def _decode_process_output(value: bytes | None, text: bool) -> bytes | str:
    if value is None:
        value = b""
    return value.decode("utf-8", errors="ignore") if text else value


def _stdout_target_for_async(stdout):
    if stdout == subprocess.DEVNULL:
        return asyncio.subprocess.DEVNULL
    return asyncio.subprocess.PIPE


def _get_thread_media_command_semaphore() -> threading.BoundedSemaphore:
    global _media_command_limit, _MEDIA_COMMAND_SEMAPHORE
    limit = _positive_int_config("media_command_concurrency", 1)
    with _MEDIA_COMMAND_SEMAPHORE_LOCK:
        if _media_command_limit != limit:
            _MEDIA_COMMAND_SEMAPHORE = threading.BoundedSemaphore(limit)
            _media_command_limit = limit
        return _MEDIA_COMMAND_SEMAPHORE


def _run_media_command(command: list[str], *, timeout: int, text: bool = False, stdout=None) -> subprocess.CompletedProcess:
    semaphore = _get_thread_media_command_semaphore()
    queue_timeout = _positive_int_config("media_command_queue_timeout_seconds", 30)
    acquired = semaphore.acquire(timeout=queue_timeout)
    if not acquired:
        raise HTTPException(status_code=503, detail="Media command queue is busy. Please try again later.")

    try:
        return subprocess.run(
            command,
            check=True,
            stdin=subprocess.DEVNULL,
            stdout=stdout if stdout is not None else subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=text,
            encoding="utf-8" if text else None,
            timeout=timeout,
        )
    except OSError as e:
        if getattr(e, "errno", None) == 24:
            log_info("Media command failed because the server has too many open files")
            raise HTTPException(status_code=503, detail="Media worker is busy. Please try again in a moment.")
        raise HTTPException(status_code=502, detail=f"Failed to start media command: {e}")
    finally:
        semaphore.release()


def _get_async_media_command_semaphore() -> asyncio.BoundedSemaphore:
    global _async_media_command_limit, _async_media_command_loop, _async_media_command_semaphore
    loop = asyncio.get_running_loop()
    limit = _positive_int_config("media_command_concurrency", 1)
    if (
        _async_media_command_semaphore is None
        or _async_media_command_loop is not loop
        or _async_media_command_limit != limit
    ):
        _async_media_command_semaphore = asyncio.BoundedSemaphore(limit)
        _async_media_command_loop = loop
        _async_media_command_limit = limit
    return _async_media_command_semaphore


def _get_async_image_proxy_semaphore() -> asyncio.BoundedSemaphore:
    global _async_image_proxy_limit, _async_image_proxy_loop, _async_image_proxy_semaphore
    loop = asyncio.get_running_loop()
    limit = _positive_int_config("image_proxy_concurrency", 8)
    if _async_image_proxy_semaphore is None or _async_image_proxy_loop is not loop or _async_image_proxy_limit != limit:
        _async_image_proxy_semaphore = asyncio.BoundedSemaphore(limit)
        _async_image_proxy_loop = loop
        _async_image_proxy_limit = limit
    return _async_image_proxy_semaphore


async def _run_media_command_async(
    command: list[str],
    *,
    timeout: int,
    text: bool = False,
    stdout=None,
) -> subprocess.CompletedProcess:
    semaphore = _get_async_media_command_semaphore()
    queue_timeout = _positive_int_config("media_command_queue_timeout_seconds", 30)
    try:
        await asyncio.wait_for(semaphore.acquire(), timeout=queue_timeout)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=503, detail="Media command queue is busy. Please try again later.")

    try:
        try:
            process = await asyncio.create_subprocess_exec(
                *command,
                stdin=asyncio.subprocess.DEVNULL,
                stdout=_stdout_target_for_async(stdout),
                stderr=asyncio.subprocess.PIPE,
            )
        except OSError as e:
            if getattr(e, "errno", None) == 24:
                log_info("Media command failed because the server has too many open files")
                raise HTTPException(status_code=503, detail="Media worker is busy. Please try again in a moment.")
            raise HTTPException(status_code=502, detail=f"Failed to start media command: {e}")

        try:
            stdout_data, stderr_data = await asyncio.wait_for(process.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            process.kill()
            await process.communicate()
            raise subprocess.TimeoutExpired(command, timeout)

        stdout_value = _decode_process_output(stdout_data, text)
        stderr_value = _decode_process_output(stderr_data, text)
        if process.returncode:
            raise subprocess.CalledProcessError(process.returncode, command, output=stdout_value, stderr=stderr_value)
        return subprocess.CompletedProcess(command, process.returncode, stdout_value, stderr_value)
    finally:
        semaphore.release()


def _connect_media_index() -> sqlite3.Connection:
    MEDIA_INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(MEDIA_INDEX_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def _media_index_connection():
    conn = _connect_media_index()
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def init_media_index() -> None:
    global _media_index_initialized
    with _MEDIA_INDEX_LOCK:
        if _media_index_initialized and MEDIA_INDEX_PATH.exists():
            return
        with _media_index_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS media_cache_index (
                    source_url TEXT PRIMARY KEY,
                    media_id TEXT NOT NULL,
                    media_type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    artist TEXT,
                    cover_url TEXT,
                    duration REAL NOT NULL,
                    media_url TEXT NOT NULL,
                    local_path TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_media_cache_updated ON media_cache_index(updated_at)")
    _media_index_initialized = True


def _media_file_available(path_like: str) -> bool:
    path = Path(path_like)
    try:
        return path.exists() and path.is_file() and path.stat().st_size > 0
    except OSError:
        return False


def get_indexed_media(source_url: str) -> dict | None:
    init_media_index()
    with _media_index_connection() as conn:
        row = conn.execute("SELECT * FROM media_cache_index WHERE source_url = ?", (source_url,)).fetchone()
        if not row:
            return None
        if not _media_file_available(row["local_path"]):
            conn.execute("DELETE FROM media_cache_index WHERE source_url = ?", (source_url,))
            return None
        return {
            "media_type": row["media_type"],
            "title": row["title"],
            "artist": row["artist"],
            "cover_url": row["cover_url"],
            "duration": row["duration"],
            "media_url": row["media_url"],
            "local_path": row["local_path"],
        }


def save_indexed_media(source_url: str, payload: dict, media_id: str) -> None:
    init_media_index()
    with _media_index_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO media_cache_index
              (source_url, media_id, media_type, title, artist, cover_url, duration, media_url, local_path, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source_url,
                media_id,
                payload["media_type"],
                payload["title"],
                payload.get("artist"),
                payload.get("cover_url"),
                payload.get("duration") or 0,
                payload["media_url"],
                payload["local_path"],
                datetime.now(timezone.utc).isoformat(),
            ),
        )


def _build_media_payload(info: dict, source_url: str) -> tuple[str, Path, dict]:
    media_id = safe_media_id(info.get("id") or info.get("display_id"), f"media_{uuid.uuid5(uuid.NAMESPACE_URL, source_url).hex}")
    if not media_id:
        raise HTTPException(status_code=500, detail="ID extraction failed")
    local_path = CACHE_PATH / f"{media_id}.mp3"
    payload = {
        "media_type": "audio",
        "title": info.get("title", "Unknown"),
        "artist": info.get("artist") or info.get("uploader"),
        "cover_url": info.get("thumbnail"),
        "duration": info.get("duration", 0),
        "media_url": f"{MEDIA_ROUTE}/{media_id}.mp3",
        "local_path": str(local_path),
    }
    return media_id, local_path, payload


async def _get_fetch_lock(source_url: str) -> asyncio.Lock:
    global _media_fetch_locks_guard, _media_fetch_locks_loop, _media_fetch_locks
    loop = asyncio.get_running_loop()
    if _media_fetch_locks_guard is None or _media_fetch_locks_loop is not loop:
        _media_fetch_locks_guard = asyncio.Lock()
        _media_fetch_locks_loop = loop
        _media_fetch_locks = {}
    async with _media_fetch_locks_guard:
        lock = _media_fetch_locks.get(source_url)
        if lock is None:
            lock = asyncio.Lock()
            _media_fetch_locks[source_url] = lock
        return lock


def fetch_media_info(url: str) -> dict:
    normalized_url = validate_external_http_url(url)
    command = _yt_dlp_command("--dump-json", "--no-playlist", "--socket-timeout", "20", normalized_url)
    command.extend(_proxy_args())
    try:
        result = _run_media_command(command, timeout=YTDLP_INFO_TIMEOUT_SECONDS, text=True)
        return json.loads(result.stdout)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Timed out while fetching media information")
    except subprocess.CalledProcessError as e:
        detail = _extract_yt_dlp_error(e.stderr, "Failed to fetch media information")
        log_info(f"yt-dlp info error: {detail}")
        raise HTTPException(status_code=400, detail=detail)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Media provider returned an invalid response")


async def fetch_media_info_async(url: str) -> dict:
    normalized_url = validate_external_http_url(url)
    command = _yt_dlp_command("--dump-json", "--no-playlist", "--socket-timeout", "20", normalized_url)
    command.extend(_proxy_args())
    try:
        result = await _run_media_command_async(command, timeout=YTDLP_INFO_TIMEOUT_SECONDS, text=True)
        return json.loads(result.stdout)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Timed out while fetching media information")
    except subprocess.CalledProcessError as e:
        detail = _extract_yt_dlp_error(e.stderr, "Failed to fetch media information")
        log_info(f"yt-dlp info error: {detail}")
        raise HTTPException(status_code=400, detail=detail)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Media provider returned an invalid response")


def download_media(info: dict, destination: str) -> None:
    url = validate_external_http_url(info.get("webpage_url") or info.get("original_url") or "")
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    command = _yt_dlp_command(
        "-f",
        "bestaudio/best",
        "--socket-timeout",
        "20",
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "128K",
        "-o",
        destination,
        url,
    )
    command.extend(_proxy_args())
    try:
        _run_media_command(command, timeout=YTDLP_DOWNLOAD_TIMEOUT_SECONDS, stdout=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Timed out while downloading media")
    except subprocess.CalledProcessError as e:
        detail = _extract_yt_dlp_error(e.stderr, "Download failed")
        raise HTTPException(status_code=502, detail=f"Download failed: {detail}")


async def download_media_async(info: dict, destination: str) -> None:
    url = validate_external_http_url(info.get("webpage_url") or info.get("original_url") or "")
    os.makedirs(os.path.dirname(destination), exist_ok=True)
    command = _yt_dlp_command(
        "-f",
        "bestaudio/best",
        "--socket-timeout",
        "20",
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "128K",
        "-o",
        destination,
        url,
    )
    command.extend(_proxy_args())
    try:
        await _run_media_command_async(command, timeout=YTDLP_DOWNLOAD_TIMEOUT_SECONDS, stdout=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Timed out while downloading media")
    except subprocess.CalledProcessError as e:
        detail = _extract_yt_dlp_error(e.stderr, "Download failed")
        raise HTTPException(status_code=502, detail=f"Download failed: {detail}")


async def fetch_media(url: str) -> dict:
    normalized_url = validate_external_http_url(url)
    cached = await asyncio.to_thread(get_indexed_media, normalized_url)
    if cached:
        return cached

    lock = await _get_fetch_lock(normalized_url)
    async with lock:
        cached = await asyncio.to_thread(get_indexed_media, normalized_url)
        if cached:
            return cached

        info = await fetch_media_info_async(normalized_url)
        media_id, local_path, payload = _build_media_payload(info, normalized_url)
        if not _media_file_available(str(local_path)):
            await download_media_async(info, str(local_path))
        if not _media_file_available(str(local_path)):
            raise HTTPException(status_code=502, detail="Media download finished but the audio file is missing")

        await asyncio.to_thread(save_indexed_media, normalized_url, payload, media_id)
        for extra_url in [info.get("webpage_url"), info.get("original_url")]:
            if extra_url:
                try:
                    extra_normalized = validate_external_http_url(extra_url)
                    await asyncio.to_thread(save_indexed_media, extra_normalized, payload, media_id)
                except HTTPException:
                    pass
        return payload


async def media_search(query: str):
    query = normalize_non_empty_query(query)
    command = _yt_dlp_command("--dump-json", "--no-playlist", "--flat-playlist", "--socket-timeout", "20", f"ytsearch5:{query}")
    command.extend(_proxy_args())

    try:
        proc = await _run_media_command_async(command, timeout=YTDLP_SEARCH_TIMEOUT_SECONDS, text=True)
        results = []
        for line in proc.stdout.strip().split("\n"):
            if not line:
                continue
            item = json.loads(line)
            results.append({
                "id": item.get("id"),
                "title": item.get("title"),
                "url": f"https://www.youtube.com/watch?v={item.get('id')}",
                "duration": item.get("duration"),
                "thumbnail": f"https://i.ytimg.com/vi/{item.get('id')}/hqdefault.jpg",
                "uploader": item.get("uploader"),
            })
        return results
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Timed out while searching media")
    except subprocess.CalledProcessError as e:
        log_info(f"Search error: {_extract_yt_dlp_error(e.stderr, 'search failed')}")
        return []
    except HTTPException:
        raise
    except Exception as e:
        log_info(f"Search error: {e}")
        return []


async def proxy_image(url: str):
    current_url = validate_external_http_url(url)
    headers = {"User-Agent": DEFAULT_USER_AGENT, "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"}
    semaphore = _get_async_image_proxy_semaphore()
    try:
        await asyncio.wait_for(semaphore.acquire(), timeout=10)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=503, detail="Image proxy queue is busy. Please try again later.")

    try:
        async with async_client(timeout_seconds=15.0) as client:
            try:
                for _ in range(4):
                    async with client.stream("GET", current_url, headers=headers, follow_redirects=False) as resp:
                        if 300 <= resp.status_code < 400 and resp.headers.get("Location"):
                            current_url = validate_external_http_url(urljoin(str(resp.url), resp.headers["Location"]))
                            continue

                        resp.raise_for_status()
                        content_type = resp.headers.get("Content-Type", "image/jpeg").split(";", 1)[0].strip().lower()
                        if not content_type.startswith("image/"):
                            raise HTTPException(status_code=415, detail="Proxied URL did not return an image")

                        content_length = resp.headers.get("Content-Length")
                        if content_length and int(content_length) > IMAGE_PROXY_MAX_BYTES:
                            raise HTTPException(status_code=413, detail="Image is too large to proxy")

                        chunks: list[bytes] = []
                        total = 0
                        async for chunk in resp.aiter_bytes():
                            total += len(chunk)
                            if total > IMAGE_PROXY_MAX_BYTES:
                                raise HTTPException(status_code=413, detail="Image is too large to proxy")
                            chunks.append(chunk)
                        return b"".join(chunks), content_type or "image/jpeg"

                raise HTTPException(status_code=400, detail="Too many image redirects")
            except httpx.HTTPStatusError as e:
                log_info(f"Image proxy upstream status for {current_url}: {e.response.status_code}")
                raise HTTPException(status_code=e.response.status_code, detail="Image upstream returned an error")
            except HTTPException:
                raise
            except Exception as e:
                log_info(f"Image proxy error for {current_url}: {e}")
                raise HTTPException(status_code=500, detail="Failed to proxy image")
    finally:
        semaphore.release()
