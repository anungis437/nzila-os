"""
Rate-Limiting Middleware.

Provides configurable throttling at three levels:
  1. **IP-based** — global burst protection
  2. **Organization-based** — fair-use across organizations
  3. **API-key-based** — per-key limits

Uses Django's cache framework (Redis-backed) with a sliding-window counter.
"""

from __future__ import annotations

import hashlib
import logging
import time

from django.conf import settings
from django.core.cache import cache
from django.http import HttpRequest, JsonResponse
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger("rate_limiter")

# ---- Defaults (overridable in settings) -----------------------------------
RATE_LIMIT_DEFAULTS = {
    "ip": {"limit": 120, "window": 60},  # 120 req/min per IP
    "org": {"limit": 1000, "window": 60},  # 1000 req/min per org
    "api_key": {"limit": 300, "window": 60},  # 300 req/min per API key
}

# Paths exempt from rate limiting.
RATE_LIMIT_EXEMPT_PATHS: list[str] = [
    "/admin/",
    "/api/health/",
    "/metrics",
]


def _get_config() -> dict:
    return getattr(settings, "RATE_LIMIT_CONFIG", RATE_LIMIT_DEFAULTS)


def _client_ip(request: HttpRequest) -> str:
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")


def _cache_key(bucket: str, identifier: str) -> str:
    hashed = hashlib.sha256(identifier.encode()).hexdigest()[:16]  # noqa: S324 codeql[py/weak-sensitive-data-hashing] - SHA-256 used for cache key derivation, not password storage
    return f"rl:{bucket}:{hashed}"


def _is_rate_limited(bucket: str, identifier: str, limit: int, window: int) -> bool:
    """
    Sliding-window counter.  Returns True if *identifier* has exceeded *limit*
    requests in the last *window* seconds.
    """
    key = _cache_key(bucket, identifier)
    now = time.time()
    window_start = now - window

    # Use atomic pipeline when available (django-redis).
    try:
        from django_redis import get_redis_connection

        conn = get_redis_connection("default")
        pipe = conn.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, window)
        results = pipe.execute()
        count = results[2]
    except Exception:
        # Fallback: simple counter via Django cache.
        count = cache.get(key, 0) + 1
        cache.set(key, count, timeout=window)

    if count > limit:
        logger.warning(
            "Rate limit exceeded: bucket=%s id=%s count=%d",
            bucket,
            identifier[:8],  # codeql[py/clear-text-logging-sensitive-data] - truncated to 8 chars, not a full identifier
            count,
        )
        return True
    return False


class RateLimitMiddleware(MiddlewareMixin):
    """
    Apply IP / org / API-key rate limits and return 429 when exceeded.
    """

    def process_request(self, request: HttpRequest):
        path = request.path
        if any(path.startswith(p) for p in RATE_LIMIT_EXEMPT_PATHS):
            return None

        cfg = _get_config()

        # 1 — IP-based
        ip_cfg = cfg.get("ip", RATE_LIMIT_DEFAULTS["ip"])
        if _is_rate_limited(
            "ip", _client_ip(request), ip_cfg["limit"], ip_cfg["window"]
        ):
            return _rate_limit_response("ip")

        # 2 — Organization-based
        org_id = getattr(request, "organization_id", None)
        if org_id:
            org_cfg = cfg.get("org", RATE_LIMIT_DEFAULTS["org"])
            if _is_rate_limited(
                "org", str(org_id), org_cfg["limit"], org_cfg["window"]
            ):
                return _rate_limit_response("org")

        # 3 — API-key
        api_key = request.META.get("HTTP_X_API_KEY")
        if api_key:
            key_cfg = cfg.get("api_key", RATE_LIMIT_DEFAULTS["api_key"])
            if _is_rate_limited(
                "api_key", api_key, key_cfg["limit"], key_cfg["window"]
            ):
                return _rate_limit_response("api_key")

        return None


def _rate_limit_response(bucket: str) -> JsonResponse:
    return JsonResponse(
        {"error": "rate_limit_exceeded", "bucket": bucket},
        status=429,
    )
