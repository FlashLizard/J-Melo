import ipaddress
import re
from typing import Iterable
from urllib.parse import urlparse, urlunparse

import httpx
from fastapi import HTTPException

from core.config import ADMIN_CONFIG

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

BLOCKED_HOSTS = {
    "0",
    "localhost",
    "localhost.localdomain",
    "host.docker.internal",
}


def _normalized_hostname(hostname: str | None) -> str:
    return (hostname or "").strip().rstrip(".").lower()


def _is_blocked_ip(hostname: str) -> bool:
    try:
        ip = ipaddress.ip_address(hostname.strip("[]"))
    except ValueError:
        return False
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def _is_blocked_hostname(hostname: str) -> bool:
    host = _normalized_hostname(hostname)
    return (
        not host
        or host in BLOCKED_HOSTS
        or host.endswith(".local")
        or host.endswith(".localhost")
        or _is_blocked_ip(host)
    )


def _matches_allowed_host(hostname: str, allowed_hosts: Iterable[str]) -> bool:
    host = _normalized_hostname(hostname)
    for allowed in allowed_hosts:
        allowed_host = _normalized_hostname(allowed)
        if host == allowed_host or host.endswith(f".{allowed_host}"):
            return True
    return False


def validate_external_http_url(raw_url: str, *, allowed_hosts: Iterable[str] | None = None) -> str:
    url = (raw_url or "").strip()
    if len(url) > 2048:
        raise HTTPException(status_code=400, detail="URL is too long")

    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Only http(s) URLs are supported")
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="URLs with embedded credentials are not supported")

    hostname = _normalized_hostname(parsed.hostname)
    if allowed_hosts and not _matches_allowed_host(hostname, allowed_hosts):
        raise HTTPException(status_code=400, detail="URL host is not allowed for this endpoint")
    if not allowed_hosts and _is_blocked_hostname(hostname):
        raise HTTPException(status_code=400, detail="Private or local network URLs are not allowed")

    return urlunparse(parsed._replace(fragment=""))


def normalize_non_empty_query(query: str, *, max_length: int = 200) -> str:
    normalized = re.sub(r"\s+", " ", (query or "").strip())
    if not normalized:
        raise HTTPException(status_code=400, detail="Query must not be empty")
    if len(normalized) > max_length:
        raise HTTPException(status_code=400, detail="Query is too long")
    return normalized


def async_client(*, timeout_seconds: float = 15.0, follow_redirects: bool = False) -> httpx.AsyncClient:
    proxy = ADMIN_CONFIG.get("proxy") or None
    timeout = httpx.Timeout(timeout_seconds, connect=min(10.0, timeout_seconds))
    return httpx.AsyncClient(proxy=proxy, timeout=timeout, follow_redirects=follow_redirects)

