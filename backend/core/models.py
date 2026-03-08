from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class UserData(BaseModel):
    songs: list
    words: list
    settings: dict
    promptTemplates: list
    cardTemplates: list

class MediaFetchResponse(BaseModel):
    media_type: str
    title: str
    artist: Optional[str] = None
    cover_url: Optional[str] = None
    duration: float
    media_url: str
    local_path: str

class TranscribeRequest(BaseModel):
    media_id: str
    local_path: str
    display_name: Optional[str] = "Unknown Track"
    force_retranscribe: bool = False

class ClearCacheRequest(BaseModel):
    cache_name: str

class CachePolicy(BaseModel):
    max_size_gb: Optional[int] = None
    max_age_days: Optional[int] = None
    max_size_mb: Optional[int] = None
    max_age_hours: Optional[int] = None

class UpdateConfigRequest(BaseModel):
    admin_token: Optional[str] = None
    proxy: Optional[str] = None
    media_cache_policy: Optional[CachePolicy] = None
    token_cache_policy: Optional[CachePolicy] = None
    transcription_cache_policy: Optional[CachePolicy] = None
    community_policy: Optional[CachePolicy] = None

class SharedSongUpload(BaseModel):
    title: str
    artist: Optional[str] = None
    cover_url: Optional[str] = None
    sharer_name: str
    song_data: dict
    words_data: list

class AnnotateRequest(BaseModel):
    text: str

class AlignRequest(BaseModel):
    song_id: int
    source_url: Optional[str] = None
    local_path: Optional[str] = None
    lyrics_data: List[Dict[str, Any]]
    align_mode: str = "word"
    extract_vocals: bool = True
    replace_with_kana: bool = False
