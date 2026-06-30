import pytest
from fastapi import HTTPException

import services.network as network
from services.network import normalize_non_empty_query, validate_external_http_url


def _mock_dns(monkeypatch, ip: str = "93.184.216.34") -> None:
    monkeypatch.setattr(
        network.socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(None, None, None, None, (ip, 443))],
    )


def test_validate_external_http_url_rejects_private_targets():
    with pytest.raises(HTTPException) as exc:
        validate_external_http_url("http://127.0.0.1:8000/internal")

    assert exc.value.status_code == 400


def test_validate_external_http_url_allows_public_https_without_fragment(monkeypatch):
    _mock_dns(monkeypatch)

    assert validate_external_http_url("https://example.com/path?q=1#frag") == "https://example.com/path?q=1"


def test_validate_external_http_url_enforces_allowed_hosts(monkeypatch):
    _mock_dns(monkeypatch)

    assert validate_external_http_url("https://utaten.com/lyric/example/", allowed_hosts=["utaten.com"])

    with pytest.raises(HTTPException):
        validate_external_http_url("https://example.com/lyric/example/", allowed_hosts=["utaten.com"])


def test_validate_external_http_url_rejects_domains_resolving_to_private_ips(monkeypatch):
    _mock_dns(monkeypatch, "127.0.0.1")

    with pytest.raises(HTTPException) as exc:
        validate_external_http_url("https://public-looking.example/image.jpg")

    assert exc.value.status_code == 400
    assert "resolves" in exc.value.detail


def test_validate_external_http_url_can_skip_dns_for_proxy_driven_downloaders(monkeypatch):
    _mock_dns(monkeypatch, "127.0.0.1")

    assert (
        validate_external_http_url("https://www.youtube.com/watch?v=abc", resolve_hostname=False)
        == "https://www.youtube.com/watch?v=abc"
    )


def test_normalize_non_empty_query():
    assert normalize_non_empty_query("  夜に   駆ける  ") == "夜に 駆ける"

    with pytest.raises(HTTPException):
        normalize_non_empty_query("   ")

