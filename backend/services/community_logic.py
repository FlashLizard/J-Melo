import base64
import json
import sqlite3
from contextlib import contextmanager

from fastapi import HTTPException

from core.config import ADMIN_CONFIG, COMMUNITY_DB_PATH


def connect():
    conn = sqlite3.connect(COMMUNITY_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def connection():
    conn = connect()
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def init_db():
    with connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS shared_songs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                artist TEXT,
                cover_url TEXT,
                sharer_name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                song_data TEXT NOT NULL,
                words_data TEXT NOT NULL,
                cover_image BLOB
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_shared_songs_created ON shared_songs(created_at)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_shared_songs_sharer ON shared_songs(sharer_name)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_shared_songs_title_artist ON shared_songs(title, artist)")


def _decode_cover_blob(song_data: dict):
    cover_data = song_data.get("coverImageData")
    if not cover_data or "," not in cover_data:
        return None
    try:
        return base64.b64decode(cover_data.split(",", 1)[1])
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid cover image data")


def _payload_size_bytes(payload) -> int:
    return len(json.dumps(payload.song_data, ensure_ascii=False).encode("utf-8")) + len(
        json.dumps(payload.words_data, ensure_ascii=False).encode("utf-8")
    )


def share_song(payload):
    init_db()
    quota_mb = ADMIN_CONFIG.get("community_policy", {}).get("max_size_mb", 500)
    max_upload_mb = ADMIN_CONFIG.get("max_upload_mb", 50)
    if _payload_size_bytes(payload) > max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Shared song payload is too large")

    if COMMUNITY_DB_PATH.exists() and COMMUNITY_DB_PATH.stat().st_size > quota_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Community database quota exceeded")

    cover_blob = _decode_cover_blob(payload.song_data)
    with connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO shared_songs
                (title, artist, cover_url, sharer_name, song_data, words_data, cover_image)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.title,
                payload.artist,
                payload.cover_url,
                payload.sharer_name,
                json.dumps(payload.song_data, ensure_ascii=False),
                json.dumps(payload.words_data, ensure_ascii=False),
                cover_blob,
            ),
        )
        sid = cursor.lastrowid
        if cover_blob:
            cursor.execute(
                "UPDATE shared_songs SET cover_url = ? WHERE id = ?",
                (f"/api/community/songs/{sid}/cover", sid),
            )
        return {"message": "Success", "id": sid}


def list_songs(q=None, sharer=None, limit=50, offset=0):
    init_db()
    limit = max(1, min(int(limit or 50), 100))
    offset = max(0, int(offset or 0))
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

    with connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        return [
            {
                "id": row["id"],
                "title": row["title"],
                "artist": row["artist"],
                "cover_url": row["cover_url"],
                "sharer_name": row["sharer_name"],
                "created_at": row["created_at"],
            }
            for row in cursor.fetchall()
        ]


def get_song(song_id: int):
    init_db()
    with connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT song_data, words_data, cover_image, cover_url FROM shared_songs WHERE id = ?", (song_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404)
        song_data = json.loads(row["song_data"])
        words_data = json.loads(row["words_data"])
        if row["cover_image"]:
            encoded_cover = base64.b64encode(row["cover_image"]).decode("utf-8")
            song_data["coverImageData"] = f"data:image/jpeg;base64,{encoded_cover}"
        song_data["cover_url"] = row["cover_url"]
        return {"songs": [song_data], "words": words_data}


def delete_song(song_id: int, sharer_name: str):
    init_db()
    with connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT sharer_name FROM shared_songs WHERE id = ?", (song_id,))
        row = cursor.fetchone()
        if not row or row["sharer_name"] != sharer_name:
            raise HTTPException(status_code=403)
        cursor.execute("DELETE FROM shared_songs WHERE id = ?", (song_id,))
        return {"message": "Deleted"}


def admin_delete_song(song_id: int):
    init_db()
    with connection() as conn:
        conn.execute("DELETE FROM shared_songs WHERE id = ?", (song_id,))
    return {"message": "Deleted"}


def get_cover(song_id: int):
    init_db()
    with connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT cover_image FROM shared_songs WHERE id = ?", (song_id,))
        row = cursor.fetchone()
        if not row or not row["cover_image"]:
            raise HTTPException(status_code=404)
        return row["cover_image"]
