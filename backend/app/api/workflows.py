"""
Workflow endpoints: SLA escalation, maker-checker approvals, notifications.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, Notification
from app.services.sla_engine import check_and_escalate
from app.services.maker_checker import (
    get_pending_actions, approve_action, reject_action, PendingAction,
    CONTROLLED_ACTIONS,
)
from pydantic import BaseModel

router = APIRouter(prefix="/workflows", tags=["Workflows"])


# ── SLA Escalation ──────────────────────────────────────────────────────────

@router.post("/sla/check")
def run_sla_check(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Run SLA check and auto-escalate overdue items. Call periodically or on-demand."""
    results = check_and_escalate(db)
    db.commit()
    return results


# ── Maker-Checker ───────────────────────────────────────────────────────────

@router.get("/pending-actions")
def list_pending_actions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get all pending actions awaiting checker approval (excludes user's own)."""
    actions = get_pending_actions(db, user_id=current_user.id)
    my_actions = get_pending_actions(db)
    my_pending = [a for a in my_actions if a.get("maker_name") == current_user.full_name]
    return {
        "awaiting_my_approval": actions,
        "my_pending_requests": my_pending,
        "controlled_actions": CONTROLLED_ACTIONS,
    }


class ApproveRequest(BaseModel):
    pass


class RejectRequest(BaseModel):
    reason: str


@router.post("/pending-actions/{action_id}/approve")
def approve(action_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Approve a pending action. Checker must be different from maker."""
    result = approve_action(db, action_id, current_user)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    db.commit()
    return result


@router.post("/pending-actions/{action_id}/reject")
def reject(action_id: str, body: RejectRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Reject a pending action with a reason."""
    result = reject_action(db, action_id, current_user, body.reason)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    db.commit()
    return result


@router.get("/pending-actions/history")
def action_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get history of all maker-checker actions."""
    query = db.query(PendingAction).order_by(PendingAction.created_at.desc())
    total = query.count()
    actions = query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [
            {
                "id": a.id,
                "action_type": a.action_type,
                "action_label": CONTROLLED_ACTIONS.get(a.action_type, a.action_type),
                "resource_type": a.resource_type,
                "resource_id": a.resource_id,
                "description": a.description,
                "maker_name": a.maker_name,
                "checker_name": a.checker_name,
                "status": a.status,
                "rejection_reason": a.rejection_reason,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "decided_at": a.decided_at.isoformat() if a.decided_at else None,
            }
            for a in actions
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ── Notifications ───────────────────────────────────────────────────────────

@router.get("/notifications")
def get_my_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get current user's notifications."""
    notifs = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).limit(50).all()

    unread = sum(1 for n in notifs if n.is_read != "true")

    return {
        "unread_count": unread,
        "notifications": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "type": n.notification_type,
                "is_read": n.is_read == "true",
                "link_to": n.link_to,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifs
        ],
    }


@router.post("/notifications/{notif_id}/read")
def mark_read(notif_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    n = db.query(Notification).filter(Notification.id == notif_id, Notification.user_id == current_user.id).first()
    if n:
        n.is_read = "true"
        db.commit()
    return {"status": "ok"}
