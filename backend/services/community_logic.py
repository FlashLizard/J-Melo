import sqlite3
import json
import base64
import os
from fastapi import HTTPException
from core.config import ADMIN_CONFIG

def init_db():
    conn = sqlite3.connect("shared_songs.db")
    conn.execute("CREATE TABLE IF NOT EXISTS shared_songs (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, artist TEXT, cover_url TEXT, sharer_name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, song_data TEXT NOT NULL, words_data TEXT NOT NULL, cover_image BLOB)")
    conn.close()

def share_song(payload):
    db_path = "shared_songs.db"; quota_mb = ADMIN_CONFIG.get("community_policy", {}).get("max_size_mb", 500)
    if os.path.exists(db_path) and os.path.getsize(db_path) > quota_mb * 1024 * 1024: raise HTTPException(status_code=413)
    conn = sqlite3.connect(db_path); cursor = conn.cursor()
    try:
        cover_blob = None; cover_data = payload.song_data.get("coverImageData")
        if cover_data and "," in cover_data: cover_blob = base64.b64decode(cover_data.split(",")[1])
        cursor.execute("INSERT INTO shared_songs (title, artist, cover_url, sharer_name, song_data, words_data, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?)", (payload.title, payload.artist, payload.cover_url, payload.sharer_name, json.dumps(payload.song_data, ensure_ascii=False), json.dumps(payload.words_data, ensure_ascii=False), cover_blob))
        sid = cursor.lastrowid
        if cover_blob: cursor.execute("UPDATE shared_songs SET cover_url = ? WHERE id = ?", (f"/api/community/songs/{sid}/cover", sid))
        conn.commit(); return {"message": "Success", "id": sid}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))
    finally: conn.close()

def list_songs(q=None, sharer=None, limit=50, offset=0):
    conn = sqlite3.connect("shared_songs.db"); cursor = conn.cursor()
    query, params = "SELECT id, title, artist, cover_url, sharer_name, created_at FROM shared_songs WHERE 1=1", []
    if q: query += " AND (title LIKE ? OR artist LIKE ?)"; params.extend([f"%{q}%", f"%{q}%"])
    if sharer: query += " AND sharer_name = ?"; params.append(sharer)
    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"; params.extend([limit, offset])
    try:
        cursor.execute(query, params)
        return [{"id": r[0], "title": r[1], "artist": r[2], "cover_url": r[3], "sharer_name": r[4], "created_at": r[5]} for r in cursor.fetchall()]
    finally: conn.close()

def get_song(song_id: int):
    conn = sqlite3.connect("shared_songs.db"); cursor = conn.cursor()
    try:
        cursor.execute("SELECT song_data, words_data, cover_image, cover_url FROM shared_songs WHERE id = ?", (song_id,))
        row = cursor.fetchone()
        if not row: raise HTTPException(status_code=404)
        song_data, words_data = json.loads(row[0]), json.loads(row[1])
        if row[2]: song_data["coverImageData"] = f"data:image/jpeg;base64,{base64.b64encode(row[2]).decode('utf-8')}"
        song_data["cover_url"] = row[3]; return {"songs": [song_data], "words": words_data}
    finally: conn.close()

def delete_song(song_id: int, sharer_name: str):
    conn = sqlite3.connect("shared_songs.db"); cursor = conn.cursor()
    try:
        cursor.execute("SELECT sharer_name FROM shared_songs WHERE id = ?", (song_id,))
        row = cursor.fetchone()
        if not row or row[0] != sharer_name: raise HTTPException(status_code=403)
        cursor.execute("DELETE FROM shared_songs WHERE id = ?", (song_id,)); conn.commit(); return {"message": "Deleted"}
    finally: conn.close()

def admin_delete_song(song_id: int):
    conn = sqlite3.connect("shared_songs.db")
    try: conn.execute("DELETE FROM shared_songs WHERE id = ?", (song_id,)); conn.commit(); return {"message": "Deleted"}
    finally: conn.close()

def get_cover(song_id: int):
    conn = sqlite3.connect("shared_songs.db"); cursor = conn.cursor()
    try:
        cursor.execute("SELECT cover_image FROM shared_songs WHERE id = ?", (song_id,))
        row = cursor.fetchone()
        if not row or not row[0]: raise HTTPException(status_code=404)
        return row[0]
    finally: conn.close()
