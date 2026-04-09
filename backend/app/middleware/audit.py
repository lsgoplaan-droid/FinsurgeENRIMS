"""
Audit trail middleware.
Logs every API request with user, action, resource, IP, and timestamp.
"""
import uuid
import time
from datetime import datetime
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from app.database import SessionLocal
from app.models.audit import AuditLog


# Map HTTP methods to action verbs
METHOD_ACTIONS = {
    "GET": "view",
    "POST": "create",
    "PUT": "update",
    "PATCH": "update",
    "DELETE": "delete",
}

# Paths to skip auditing (health checks, static, docs)
SKIP_PATHS = {"/", "/health", "/docs", "/openapi.json", "/redoc"}


def _extract_resource(path: str) -> tuple[str, str]:
    """Extract resource type and ID from API path."""
    parts = path.replace("/api/v1/", "").strip("/").split("/")
    resource_type = parts[0] if parts else ""
    resource_id = parts[1] if len(parts) > 1 else ""
    return resource_type, resource_id


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in SKIP_PATHS or not request.url.path.startswith("/api/"):
            return await call_next(request)

        start = time.time()
        response = await call_next(request)
        duration = round((time.time() - start) * 1000, 1)

        # Extract user ID from auth header (if present)
        user_id = None
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            try:
                from app.services.auth_service import decode_token
                payload = decode_token(auth[7:])
                if payload:
                    user_id = payload.get("sub")
            except Exception:
                pass

        resource_type, resource_id = _extract_resource(request.url.path)
        action = METHOD_ACTIONS.get(request.method, "access")
        ip = request.client.host if request.client else "unknown"

        # Write audit log asynchronously (fire and forget)
        try:
            db = SessionLocal()
            log = AuditLog(
                id=str(uuid.uuid4()),
                user_id=user_id,
                action=f"{action}_{resource_type}",
                resource_type=resource_type,
                resource_id=resource_id if resource_id else None,
                details=f'{{"method":"{request.method}","path":"{request.url.path}","status":{response.status_code},"duration_ms":{duration}}}',
                ip_address=ip,
                created_at=datetime.utcnow(),
            )
            db.add(log)
            db.commit()
            db.close()
        except Exception:
            pass  # Don't let audit failures break requests

        return response
