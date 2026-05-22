import os
import json
import re
import subprocess
import sys
from urllib.parse import urljoin

import httpx
from fastapi import HTTPException
from core.config import ADMIN_CONFIG
from core.utils import log_info
from services.network import DEFAULT_USER_AGENT, async_client, normalize_non_empty_query, validate_external_http_url

IMAGE_PROXY_MAX_BYTES = 8 * 1024 * 1024
YTDLP_INFO_TIMEOUT_SECONDS = 90
YTDLP_DOWNLOAD_TIMEOUT_SECONDS = 240
YTDLP_SEARCH_TIMEOUT_SECONDS = 60


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


def fetch_media_info(url: str) -> dict:
    normalized_url = validate_external_http_url(url)
    command = _yt_dlp_command("--dump-json", "--no-playlist", "--socket-timeout", "20", normalized_url)
    command.extend(_proxy_args())
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True, encoding="utf-8", timeout=YTDLP_INFO_TIMEOUT_SECONDS)
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
        subprocess.run(command, check=True, capture_output=True, timeout=YTDLP_DOWNLOAD_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Timed out while downloading media")
    except subprocess.CalledProcessError as e:
        detail = _extract_yt_dlp_error(e.stderr, "Download failed")
        raise HTTPException(status_code=502, detail=f"Download failed: {detail}")

async def media_search(query: str):
    query = normalize_non_empty_query(query)
    command = _yt_dlp_command("--dump-json", "--no-playlist", "--flat-playlist", "--socket-timeout", "20", f"ytsearch5:{query}")
    command.extend(_proxy_args())
    
    try:
        import asyncio
        def run():
            proc = subprocess.run(command, capture_output=True, text=True, check=True, encoding="utf-8", timeout=YTDLP_SEARCH_TIMEOUT_SECONDS)
            results = []
            for line in proc.stdout.strip().split('\n'):
                if not line: continue
                item = json.loads(line)
                results.append({
                    "id": item.get("id"),
                    "title": item.get("title"),
                    "url": f"https://www.youtube.com/watch?v={item.get('id')}",
                    "duration": item.get("duration"),
                    "thumbnail": f"https://i.ytimg.com/vi/{item.get('id')}/hqdefault.jpg",
                    "uploader": item.get("uploader")
                })
            return results
        return await asyncio.to_thread(run)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Timed out while searching media")
    except subprocess.CalledProcessError as e:
        log_info(f"Search error: {_extract_yt_dlp_error(e.stderr, 'search failed')}")
        return []
    except Exception as e:
        log_info(f"Search error: {e}")
        return []

async def proxy_image(url: str):
    current_url = validate_external_http_url(url)
    headers = {"User-Agent": DEFAULT_USER_AGENT, "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8"}

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
