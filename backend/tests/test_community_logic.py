import base64

import pytest
from fastapi import HTTPException

from core.models import SharedSongUpload
from services import community_logic


@pytest.fixture()
def isolated_community(tmp_path, monkeypatch):
    db_path = tmp_path / "community.db"
    monkeypatch.setattr(community_logic, "COMMUNITY_DB_PATH", db_path)
    monkeypatch.setitem(community_logic.ADMIN_CONFIG, "max_upload_mb", 1)
    monkeypatch.setitem(community_logic.ADMIN_CONFIG, "community_policy", {"max_size_mb": 10})
    community_logic.init_db()
    return db_path


def _payload(sharer_name="alice"):
    image = base64.b64encode(b"fake-jpeg").decode("ascii")
    return SharedSongUpload(
        title="夜に駆ける",
        artist="YOASOBI",
        sharer_name=sharer_name,
        cover_url=None,
        song_data={
            "id": 1,
            "title": "夜に駆ける",
            "artist": "YOASOBI",
            "coverImageData": f"data:image/jpeg;base64,{image}",
        },
        words_data=[{"surface": "夜", "reading": "よる"}],
    )


def test_share_list_get_and_cover(isolated_community):
    created = community_logic.share_song(_payload())

    songs = community_logic.list_songs(q="夜", limit=1000, offset=-5)
    imported = community_logic.get_song(created["id"])
    cover = community_logic.get_cover(created["id"])

    assert created["id"] == 1
    assert len(songs) == 1
    assert songs[0]["cover_url"] == "/api/community/songs/1/cover"
    assert imported["songs"][0]["title"] == "夜に駆ける"
    assert imported["songs"][0]["coverImageData"].startswith("data:image/jpeg;base64,")
    assert imported["words"] == [{"surface": "夜", "reading": "よる"}]
    assert cover == b"fake-jpeg"


def test_delete_requires_matching_sharer(isolated_community):
    created = community_logic.share_song(_payload(sharer_name="alice"))

    with pytest.raises(HTTPException) as error:
        community_logic.delete_song(created["id"], "bob")
    assert error.value.status_code == 403

    result = community_logic.delete_song(created["id"], "alice")
    assert result == {"message": "Deleted"}
    assert community_logic.list_songs() == []


def test_upload_size_limit(isolated_community, monkeypatch):
    monkeypatch.setitem(community_logic.ADMIN_CONFIG, "max_upload_mb", 0)

    with pytest.raises(HTTPException) as error:
        community_logic.share_song(_payload())

    assert error.value.status_code == 413
