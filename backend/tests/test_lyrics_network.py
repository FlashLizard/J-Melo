import pytest
from fastapi import HTTPException

from services.lyrics_petit_logic import _duration_ms_to_seconds, _validate_lyrics_id


def test_petitlyrics_id_must_be_numeric():
    assert _validate_lyrics_id(" 2830733 ") == "2830733"

    with pytest.raises(HTTPException) as exc:
        _validate_lyrics_id("../2830733")

    assert exc.value.status_code == 400


def test_petitlyrics_duration_ms_to_seconds():
    assert _duration_ms_to_seconds("275069") == 275.07
    assert _duration_ms_to_seconds("") is None
    assert _duration_ms_to_seconds("0") is None
    assert _duration_ms_to_seconds("bad") is None

