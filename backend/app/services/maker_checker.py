"""
Maker-Checker workflow service.
Sensitive actions require a maker (initiator) and a checker (approver).
Actions are held in pending state until approved by a different user.
"""
import uuid
import json
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import Column, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.models import User


class PendingAction(Base):
    __tablename__ = "pending_actions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    action_type = Column(String, nullable=False)  # rule_change, case_closure, report_filing, user_role_change, alert_bulk_close
    resource_type = Column(String, nullable=False)  # rule, case, report, user, alert
    resource_id = Column(String)
    description = Column(Text, nullable=False)
    payload = Column(Text)  # JSON — the actual change data
    maker_id = Column(String, ForeignKey("users.id"), nullable=False)
    maker_name = Column(String)
    checker_id = Column(String, ForeignKey("users.id"))
    checker_name = Column(String)
    status = Column(String, default="pending")  # pending, approved, rejected
    rejection_reason = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    decided_at = Column(DateTime)

    maker = relationship("User", foreign_keys=[maker_id])
    checker = relationship("User", foreign_keys=[checker_id])


# Actions that require maker-checker approval
CONTROLLED_ACTIONS = {
    "rule_change": "Rule enable/disable or modification",
    "case_closure": "Case disposition and closure",
    "report_filing": "CTR/SAR regulatory report filing",
    "user_role_change": "User role assignment change",
    "alert_bulk_close": "Bulk alert closure",
    "watchlist_modification": "Watchlist entry addition/removal",
    "config_change": "System configuration change",
}


def create_pending_action(
    db: Session,
    action_type: str,
    resource_type: str,
    resource_id: str,
    description: str,
    payload: dict,
    maker: User,
) -> PendingAction:
    """Create a pending action that requires checker approval."""
    action = PendingAction(
        id=str(uuid.uuid4()),
        action_type=action_type,
        resource_type=resource_type,
        resource_id=resource_id,
        description=description,
        payload=json.dumps(payload),
        maker_id=maker.id,
        maker_name=maker.full_name,
        status="pending",
    )
    db.add(action)
    db.flush()
    return action


def approve_action(db: Session, action_id: str, checker: User) -> dict:
    """Approve a pending action. Checker must be different from maker."""
    action = db.query(PendingAction).filter(PendingAction.id == action_id).first()
    if not action:
        return {"error": "Action not found"}

    if action.status != "pending":
        return {"error": f"Action already {action.status}"}

    if action.maker_id == checker.id:
        return {"error": "Checker must be different from maker"}

    action.status = "approved"
    action.checker_id = checker.id
    action.checker_name = checker.full_name
    action.decided_at = datetime.utcnow()

    db.flush()
    return {"status": "approved", "action_id": action.id}


def reject_action(db: Session, action_id: str, checker: User, reason: str) -> dict:
    """Reject a pending action."""
    action = db.query(PendingAction).filter(PendingAction.id == action_id).first()
    if not action:
        return {"error": "Action not found"}

    if action.status != "pending":
        return {"error": f"Action already {action.status}"}

    if action.maker_id == checker.id:
        return {"error": "Checker must be different from maker"}

    action.status = "rejected"
    action.checker_id = checker.id
    action.checker_name = checker.full_name
    action.rejection_reason = reason
    action.decided_at = datetime.utcnow()

    db.flush()
    return {"status": "rejected", "action_id": action.id, "reason": reason}


def get_pending_actions(db: Session, user_id: str = None) -> list[dict]:
    """Get pending actions, optionally filtered to exclude user's own."""
    query = db.query(PendingAction).filter(PendingAction.status == "pending")
    if user_id:
        query = query.filter(PendingAction.maker_id != user_id)

    actions = query.order_by(PendingAction.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "action_type": a.action_type,
            "action_label": CONTROLLED_ACTIONS.get(a.action_type, a.action_type),
            "resource_type": a.resource_type,
            "resource_id": a.resource_id,
            "description": a.description,
            "payload": json.loads(a.payload) if a.payload else {},
            "maker_name": a.maker_name,
            "status": a.status,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in actions
    ]
