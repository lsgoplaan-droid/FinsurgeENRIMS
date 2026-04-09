"""
Simple in-memory rate limiter.
In production, use Redis-backed rate limiting.
"""
import time
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, login_limit: int = 5, api_limit: int = 100, window: int = 60):
        super().__init__(app)
        self.login_limit = login_limit
        self.api_limit = api_limit
        self.window = window
        self._requests: dict[str, list[float]] = defaultdict(list)

    def _clean_old(self, key: str):
        now = time.time()
        self._requests[key] = [t for t in self._requests[key] if now - t < self.window]

    def _is_limited(self, key: str, limit: int) -> bool:
        self._clean_old(key)
        if len(self._requests[key]) >= limit:
            return True
        self._requests[key].append(time.time())
        return False

    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        # Skip rate limiting in test mode
        import os
        if os.getenv("TESTING", "").lower() == "true":
            return await call_next(request)

        ip = request.client.host if request.client else "unknown"

        # Stricter limit for login endpoint
        if request.url.path == "/api/v1/auth/login" and request.method == "POST":
            if self._is_limited(f"login:{ip}", self.login_limit):
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Too many login attempts. Try again in 1 minute."},
                )
        else:
            if self._is_limited(f"api:{ip}", self.api_limit):
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Try again shortly."},
                )

        return await call_next(request)
