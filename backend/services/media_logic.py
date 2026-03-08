import os
import json
import subprocess
import httpx
from fastapi import HTTPException
from core.config import ADMIN_CONFIG, CACHE_DIR
from core.utils import log_info

def fetch_media_info(url: str) -> dict:
    command = ["yt-dlp", "--dump-json", "--no-playlist", url]
    proxy = ADMIN_CONFIG.get("proxy")
    if proxy: command.extend(["--proxy", proxy])
    try:
        result = subprocess.run(command, capture_output=True, text=True, check=True, encoding='utf-8')
        return json.loads(result.stdout)
    except Exception as e:
        log_info(f"yt-dlp error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to fetch media info: {str(e)}")

def download_media(info: dict, destination: str) -> None:
    url = info.get("webpage_url")
    command = ["yt-dlp", "-f", "bestaudio", "--extract-audio", "--audio-format", "mp3", "--audio-quality", "128K", "-o", destination, url]
    proxy = ADMIN_CONFIG.get("proxy")
    if proxy: command.extend(["--proxy", proxy])
    try:
        subprocess.run(command, check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {e.stderr.decode('utf-8', errors='ignore')}")

async def media_search(query: str):
    command = ["yt-dlp", "--dump-json", "--no-playlist", "--flat-playlist", f"ytsearch5:{query}"]
    proxy = ADMIN_CONFIG.get("proxy")
    if proxy: command.extend(["--proxy", proxy])
    
    try:
        import asyncio
        def run():
            proc = subprocess.run(command, capture_output=True, text=True, check=True, encoding='utf-8')
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
    except Exception as e:
        log_info(f"Search error: {e}")
        return []

async def proxy_image(url: str):
    proxy = ADMIN_CONFIG.get("proxy")
    # CRITICAL: AsyncClient requires AsyncHTTPTransport
    mounts = {"http://": httpx.AsyncHTTPTransport(proxy=proxy), "https://": httpx.AsyncHTTPTransport(proxy=proxy)} if proxy else None
    
    async with httpx.AsyncClient(mounts=mounts) as client:
        try:
            resp = await client.get(url, timeout=10.0, follow_redirects=True)
            resp.raise_for_status()
            return resp.content, resp.headers.get("Content-Type", "image/jpeg")
        except Exception as e:
            log_info(f"Image proxy error for {url}: {e}")
            raise HTTPException(status_code=500, detail="Failed to proxy image")
