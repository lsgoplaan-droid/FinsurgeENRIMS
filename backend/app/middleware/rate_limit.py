"""
Rate limiter — Redis-backed in production, in-memory fallback for dev.
"""
import os
import time
import logging
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("finsurge.rate_limit")

# ── Redis client (lazy init) ────────────────────────────────────────────────

_redis_client = None
_redis_attempted = False


def _get_redis():
    global _redis_client, _redis_attempted
    if _redis_attempted:
        return _redis_client
    _redis_attempted = True

    redis_url = os.getenv("REDIS_URL", "")
    if not redis_url:
        return None
    try:
        import redis
        _redis_client = redis.from_url(redis_url, decode_responses=True, socket_timeout=1)
        _redis_client.ping()
        logger.info("Rate limiter using Redis")
        return _redis_client
    except Exception as e:
        logger.warning(f"Redis unavailable, falling back to in-memory: {e}")
        _redis_client = None
        return None


# ── Middleware ────────────────────────────────────────────────────────────────

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, login_limit: int = 5, api_limit: int = 100, window: int = 60):
        super().__init__(app)
        self.login_limit = login_limit
        self.api_limit = api_limit
        self.window = window
        # In-memory fallback
        self._requests: dict[str, list[float]] = defaultdict(list)

    # ── In-memory rate check ─────────────────────────────────────────────────

    def _clean_old(self, key: str):
        now = time.time()
        self._requests[key] = [t for t in self._requests[key] if now - t < self.window]

    def _is_limited_memory(self, key: str, limit: int) -> bool:
        self._clean_old(key)
        if len(self._requests[key]) >= limit:
            return True
        self._requests[key].append(time.time())
        return False

    # ── Redis rate check (sliding window counter) ────────────────────────────

    def _is_limited_redis(self, r, key: str, limit: int) -> bool:
        pipe = r.pipeline()
        now = time.time()
        window_key = f"rl:{key}"

        pipe.zremrangebyscore(window_key, 0, now - self.window)
        pipe.zadd(window_key, {str(now): now})
        pipe.zcard(window_key)
        pipe.expire(window_key, self.window + 1)
        results = pipe.execute()

        count = results[2]
        return count > limit

    # ── Dispatch ─────────────────────────────────────────────────────────────

    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        # Skip rate limiting in test mode
        if os.getenv("TESTING", "").lower() == "true":
            return await call_next(request)

        ip = request.client.host if request.client else "unknown"
        r = _get_redis()

        # Stricter limit for login endpoint
        if request.url.path == "/api/v1/auth/login" and request.method == "POST":
            key = f"login:{ip}"
            limited = self._is_limited_redis(r, key, self.login_limit) if r else self._is_limited_memory(key, self.login_limit)
            if limited:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many login attempts. Try again in 1 minute."},
                )
        else:
            key = f"api:{ip}"
            limited = self._is_limited_redis(r, key, self.api_limit) if r else self._is_limited_memory(key, self.api_limit)
            if limited:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Try again shortly."},
                )

        return await call_next(request)
