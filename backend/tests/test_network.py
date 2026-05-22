import pytest
from fastapi import HTTPException

from services.network import normalize_non_empty_query, validate_external_http_url


def test_validate_external_http_url_rejects_private_targets():
    with pytest.raises(HTTPException) as exc:
        validate_external_http_url("http://127.0.0.1:8000/internal")

    assert exc.value.status_code == 400


def test_validate_external_http_url_allows_public_https_without_fragment():
    assert validate_external_http_url("https://example.com/path?q=1#frag") == "https://example.com/path?q=1"


def test_validate_external_http_url_enforces_allowed_hosts():
    assert validate_external_http_url("https://utaten.com/lyric/example/", allowed_hosts=["utaten.com"])

    with pytest.raises(HTTPException):
        validate_external_http_url("https://example.com/lyric/example/", allowed_hosts=["utaten.com"])


def test_normalize_non_empty_query():
    assert normalize_non_empty_query("  夜に   駆ける  ") == "夜に 駆ける"

    with pytest.raises(HTTPException):
        normalize_non_empty_query("   ")

