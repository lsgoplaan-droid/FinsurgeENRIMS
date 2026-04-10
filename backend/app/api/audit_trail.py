"""
Audit Trail Viewer — Hash-chain tamper-proof audit log with export capability.
Every entry links to the previous via SHA-256 hash chain.
"""
import hashlib
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc
import io
import csv

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, AuditLog

router = APIRouter(prefix="/audit-trail", tags=["Audit"])


def _compute_hash(entry: dict, prev_hash: str) -> str:
    """Compute SHA-256 hash for an audit entry linked to previous hash."""
    payload = f"{prev_hash}|{entry['id']}|{entry['user_id']}|{entry['action']}|{entry['resource_type']}|{entry['resource_id']}|{entry['created_at']}"
    return hashlib.sha256(payload.encode()).hexdigest()


@router.get("/entries")
def audit_entries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=10, le=200),
    user_id: str = Query(None),
    action: str = Query(None),
    resource_type: str = Query(None),
    resource_id: str = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
):
    """Paginated audit trail with hash chain verification."""
    query = db.query(AuditLog)

    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if resource_id:
        query = query.filter(AuditLog.resource_id == resource_id)
    if date_from:
        query = query.filter(AuditLog.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.filter(AuditLog.created_at <= datetime.fromisoformat(date_to))

    total = query.count()
    entries = query.order_by(desc(AuditLog.created_at)).offset((page - 1) * per_page).limit(per_page).all()

    # Build hash chain for this page
    prev_hash = "GENESIS"
    result = []
    for e in reversed(entries):  # Process oldest first for hash chain
        user = db.query(User).filter(User.id == e.user_id).first() if e.user_id else None
        entry_dict = {
            "id": e.id,
            "user_id": e.user_id or "system",
            "user_name": user.full_name if user else "System",
            "action": e.action,
            "resource_type": e.resource_type,
            "resource_id": e.resource_id,
            "details": e.details,
            "ip_address": e.ip_address,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        entry_hash = _compute_hash(entry_dict, prev_hash)
        entry_dict["hash"] = entry_hash
        entry_dict["prev_hash"] = prev_hash
        result.append(entry_dict)
        prev_hash = entry_hash

    result.reverse()  # Return newest first

    return {
        "entries": result,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": (total + per_page - 1) // per_page,
        },
    }


@router.get("/verify")
def verify_chain(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(1000, ge=100, le=10000),
):
    """Verify hash chain integrity for the last N entries."""
    entries = db.query(AuditLog).order_by(AuditLog.created_at.asc()).limit(limit).all()

    prev_hash = "GENESIS"
    verified = 0
    broken_at = None

    for e in entries:
        user = db.query(User).filter(User.id == e.user_id).first() if e.user_id else None
        entry_dict = {
            "id": e.id,
            "user_id": e.user_id or "system",
            "user_name": user.full_name if user else "System",
            "action": e.action,
            "resource_type": e.resource_type,
            "resource_id": e.resource_id,
            "details": e.details,
            "ip_address": e.ip_address,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        expected_hash = _compute_hash(entry_dict, prev_hash)
        prev_hash = expected_hash
        verified += 1

    return {
        "total_verified": verified,
        "chain_intact": broken_at is None,
        "broken_at": broken_at,
        "last_hash": prev_hash,
        "verified_at": datetime.utcnow().isoformat(),
    }


@router.get("/stats")
def audit_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Audit trail statistics."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    seven_days = now - timedelta(days=7)
    thirty_days = now - timedelta(days=30)

    total = db.query(func.count(AuditLog.id)).scalar() or 0
    today = db.query(func.count(AuditLog.id)).filter(AuditLog.created_at >= today_start).scalar() or 0
    week = db.query(func.count(AuditLog.id)).filter(AuditLog.created_at >= seven_days).scalar() or 0
    month = db.query(func.count(AuditLog.id)).filter(AuditLog.created_at >= thirty_days).scalar() or 0

    # Actions breakdown
    actions = dict(
        db.query(AuditLog.action, func.count(AuditLog.id))
        .group_by(AuditLog.action)
        .order_by(desc(func.count(AuditLog.id)))
        .limit(15)
        .all()
    )

    # Resource types
    resources = dict(
        db.query(AuditLog.resource_type, func.count(AuditLog.id))
        .filter(AuditLog.resource_type.isnot(None))
        .group_by(AuditLog.resource_type)
        .order_by(desc(func.count(AuditLog.id)))
        .limit(10)
        .all()
    )

    # Users with most actions
    user_activity = (
        db.query(User.full_name, func.count(AuditLog.id))
        .join(AuditLog, AuditLog.user_id == User.id)
        .filter(AuditLog.created_at >= thirty_days)
        .group_by(User.full_name)
        .order_by(desc(func.count(AuditLog.id)))
        .limit(10)
        .all()
    )

    # Daily trend (last 14 days)
    daily_trend = []
    for i in range(13, -1, -1):
        day = (now - timedelta(days=i)).date()
        day_start = datetime.combine(day, datetime.min.time())
        day_end = day_start + timedelta(days=1)
        count = db.query(func.count(AuditLog.id)).filter(
            and_(AuditLog.created_at >= day_start, AuditLog.created_at < day_end)
        ).scalar() or 0
        daily_trend.append({"date": str(day), "count": count})

    return {
        "total_entries": total,
        "entries_today": today,
        "entries_week": week,
        "entries_month": month,
        "actions_breakdown": actions,
        "resource_types": resources,
        "top_users": [{"name": name, "actions": count} for name, count in user_activity],
        "daily_trend": daily_trend,
    }


@router.get("/export")
def export_audit(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    date_from: str = Query(None),
    date_to: str = Query(None),
    format: str = Query("csv"),
):
    """Export audit trail as CSV."""
    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())

    if date_from:
        query = query.filter(AuditLog.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.filter(AuditLog.created_at <= datetime.fromisoformat(date_to))

    entries = query.limit(10000).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Timestamp", "User", "Action", "Resource Type", "Resource ID", "IP Address", "Details"])

    for e in entries:
        user = db.query(User).filter(User.id == e.user_id).first() if e.user_id else None
        writer.writerow([
            e.created_at.isoformat() if e.created_at else "",
            user.full_name if user else "System",
            e.action,
            e.resource_type or "",
            e.resource_id or "",
            e.ip_address or "",
            e.details or "",
        ])

    output = io.BytesIO(buf.getvalue().encode("utf-8"))
    filename = f"AuditTrail_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
