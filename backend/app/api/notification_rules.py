"""
Notification Rules Management — Configure SMS/Email/In-App notifications
triggered by system events (alerts, SLA breaches, escalations, etc.).
"""
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.models.notification_rule import NotificationRule, NotificationLog

router = APIRouter(prefix="/notification-rules", tags=["Notification Rules"])

TRIGGER_EVENTS = [
    {"code": "alert_created", "label": "Alert Created", "category": "alert"},
    {"code": "alert_assigned", "label": "Alert Assigned", "category": "alert"},
    {"code": "alert_escalated", "label": "Alert Escalated", "category": "alert"},
    {"code": "alert_sla_breach", "label": "Alert SLA Breached", "category": "alert"},
    {"code": "alert_closed", "label": "Alert Closed", "category": "alert"},
    {"code": "case_created", "label": "Case Created", "category": "case"},
    {"code": "case_assigned", "label": "Case Assigned", "category": "case"},
    {"code": "case_escalated", "label": "Case Escalated", "category": "case"},
    {"code": "case_sla_breach", "label": "Case SLA Breached", "category": "case"},
    {"code": "case_closed", "label": "Case Closed", "category": "case"},
    {"code": "high_risk_transaction", "label": "High Risk Transaction Detected", "category": "transaction"},
    {"code": "rule_triggered", "label": "Detection Rule Triggered", "category": "detection"},
    {"code": "sar_filed", "label": "STR Report Filed", "category": "compliance"},
    {"code": "ctr_filed", "label": "CTR Report Filed", "category": "compliance"},
    {"code": "fir_filed", "label": "FIR Filed with Police", "category": "law_enforcement"},
    {"code": "fir_hearing", "label": "FIR Court Hearing Approaching", "category": "law_enforcement"},
    {"code": "kyc_expired", "label": "Customer KYC Expired", "category": "kyc"},
    {"code": "pep_transaction", "label": "PEP Customer Transaction", "category": "kyc"},
    {"code": "watchlist_match", "label": "Watchlist Match Found", "category": "compliance"},
    {"code": "system_error", "label": "System Error", "category": "system"},
]

RECIPIENT_TYPES = [
    {"code": "role", "label": "By Role"},
    {"code": "user", "label": "Specific User(s)"},
    {"code": "rm", "label": "Relationship Manager"},
    {"code": "risk_manager", "label": "Risk Manager"},
    {"code": "compliance_officer", "label": "Compliance Officer"},
    {"code": "branch_head", "label": "Branch Head"},
    {"code": "cro", "label": "Chief Risk Officer"},
    {"code": "ceo", "label": "CEO / MD"},
    {"code": "principal_officer", "label": "PMLA Principal Officer"},
]


class NotificationRuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    trigger_event: str
    condition_priority: Optional[str] = None
    condition_alert_type: Optional[str] = None
    condition_amount_min: Optional[int] = None
    condition_risk_score_min: Optional[int] = None
    recipient_type: str
    recipient_roles: Optional[str] = None
    recipient_user_ids: Optional[str] = None
    channel_sms: bool = False
    channel_email: bool = False
    channel_in_app: bool = True
    channel_whatsapp: bool = False
    message_template: Optional[str] = None
    cooldown_minutes: int = 0
    escalation_delay_minutes: int = 0
    max_per_day: int = 100
    severity: str = "medium"
    is_active: bool = True


class NotificationRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_event: Optional[str] = None
    condition_priority: Optional[str] = None
    condition_alert_type: Optional[str] = None
    condition_amount_min: Optional[int] = None
    condition_risk_score_min: Optional[int] = None
    recipient_type: Optional[str] = None
    recipient_roles: Optional[str] = None
    recipient_user_ids: Optional[str] = None
    channel_sms: Optional[bool] = None
    channel_email: Optional[bool] = None
    channel_in_app: Optional[bool] = None
    channel_whatsapp: Optional[bool] = None
    message_template: Optional[str] = None
    cooldown_minutes: Optional[int] = None
    escalation_delay_minutes: Optional[int] = None
    max_per_day: Optional[int] = None
    severity: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/reference-data")
def reference_data(current_user: User = Depends(get_current_user)):
    """Reference data for notification rule forms."""
    return {
        "trigger_events": TRIGGER_EVENTS,
        "recipient_types": RECIPIENT_TYPES,
        "channels": ["sms", "email", "in_app", "whatsapp"],
        "severities": ["critical", "high", "medium", "low"],
        "priorities": ["critical", "high", "medium", "low"],
        "alert_types": ["aml", "fraud", "kyc", "compliance"],
    }


@router.get("/list")
def list_rules(
    trigger_event: str = None,
    is_active: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all notification rules."""
    q = db.query(NotificationRule)
    if trigger_event:
        q = q.filter(NotificationRule.trigger_event == trigger_event)
    if is_active is not None:
        q = q.filter(NotificationRule.is_active == (is_active == "true"))

    rules = q.order_by(NotificationRule.created_at.desc()).all()

    items = []
    for r in rules:
        # Count recent notifications triggered by this rule
        last_24h = datetime.utcnow() - timedelta(hours=24)
        sent_24h = db.query(func.count(NotificationLog.id)).filter(
            NotificationLog.notification_rule_id == r.id,
            NotificationLog.created_at >= last_24h,
        ).scalar() or 0

        total_sent = db.query(func.count(NotificationLog.id)).filter(
            NotificationLog.notification_rule_id == r.id,
        ).scalar() or 0

        channels = []
        if r.channel_sms:
            channels.append("sms")
        if r.channel_email:
            channels.append("email")
        if r.channel_in_app:
            channels.append("in_app")
        if r.channel_whatsapp:
            channels.append("whatsapp")

        items.append({
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "trigger_event": r.trigger_event,
            "condition_priority": r.condition_priority,
            "condition_alert_type": r.condition_alert_type,
            "condition_amount_min": r.condition_amount_min,
            "condition_risk_score_min": r.condition_risk_score_min,
            "recipient_type": r.recipient_type,
            "recipient_roles": r.recipient_roles,
            "channels": channels,
            "message_template": r.message_template,
            "is_active": r.is_active,
            "cooldown_minutes": r.cooldown_minutes,
            "max_per_day": r.max_per_day,
            "severity": r.severity,
            "sent_24h": sent_24h,
            "total_sent": total_sent,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    # Summary
    active_count = sum(1 for r in rules if r.is_active)
    by_event = {}
    for r in rules:
        by_event[r.trigger_event] = by_event.get(r.trigger_event, 0) + 1

    return {
        "rules": items,
        "total": len(items),
        "active": active_count,
        "inactive": len(items) - active_count,
        "by_event": by_event,
    }


@router.post("/create")
def create_rule(body: NotificationRuleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create a new notification rule."""
    rule = NotificationRule(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        trigger_event=body.trigger_event,
        condition_priority=body.condition_priority,
        condition_alert_type=body.condition_alert_type,
        condition_amount_min=body.condition_amount_min,
        condition_risk_score_min=body.condition_risk_score_min,
        recipient_type=body.recipient_type,
        recipient_roles=body.recipient_roles,
        recipient_user_ids=body.recipient_user_ids,
        channel_sms=body.channel_sms,
        channel_email=body.channel_email,
        channel_in_app=body.channel_in_app,
        channel_whatsapp=body.channel_whatsapp,
        message_template=body.message_template,
        cooldown_minutes=body.cooldown_minutes,
        escalation_delay_minutes=body.escalation_delay_minutes,
        max_per_day=body.max_per_day,
        severity=body.severity,
        is_active=body.is_active,
        created_by=current_user.id,
    )
    db.add(rule)
    db.commit()
    return {"id": rule.id, "name": rule.name}


@router.put("/{rule_id}")
def update_rule(rule_id: str, body: NotificationRuleUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update a notification rule."""
    rule = db.query(NotificationRule).filter(NotificationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Notification rule not found")

    for field, val in body.dict(exclude_unset=True).items():
        setattr(rule, field, val)
    rule.updated_at = datetime.utcnow()
    db.commit()
    return {"id": rule.id, "name": rule.name}


@router.post("/{rule_id}/toggle")
def toggle_rule(rule_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Toggle notification rule active/inactive."""
    rule = db.query(NotificationRule).filter(NotificationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Notification rule not found")
    rule.is_active = not rule.is_active
    rule.updated_at = datetime.utcnow()
    db.commit()
    return {"id": rule.id, "is_active": rule.is_active}


@router.delete("/{rule_id}")
def delete_rule(rule_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete a notification rule."""
    rule = db.query(NotificationRule).filter(NotificationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Notification rule not found")
    db.delete(rule)
    db.commit()
    return {"deleted": True}


@router.get("/logs")
def notification_logs(
    channel: str = None,
    status: str = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """View notification delivery logs."""
    q = db.query(NotificationLog)
    if channel:
        q = q.filter(NotificationLog.channel == channel)
    if status:
        q = q.filter(NotificationLog.status == status)

    logs = q.order_by(desc(NotificationLog.created_at)).limit(limit).all()

    items = []
    for l in logs:
        rule = db.query(NotificationRule).filter(NotificationRule.id == l.notification_rule_id).first()
        user = db.query(User).filter(User.id == l.recipient_user_id).first() if l.recipient_user_id else None
        items.append({
            "id": l.id,
            "rule_name": rule.name if rule else "Manual",
            "trigger_event": l.trigger_event,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "channel": l.channel,
            "recipient_name": user.full_name if user else l.recipient_contact,
            "status": l.status,
            "subject": l.subject,
            "message": l.message,
            "sent_at": l.sent_at.isoformat() if l.sent_at else None,
            "delivered_at": l.delivered_at.isoformat() if l.delivered_at else None,
            "failure_reason": l.failure_reason,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        })

    # Delivery stats
    total = db.query(func.count(NotificationLog.id)).scalar() or 0
    sent = db.query(func.count(NotificationLog.id)).filter(NotificationLog.status.in_(["sent", "delivered", "read"])).scalar() or 0
    failed = db.query(func.count(NotificationLog.id)).filter(NotificationLog.status == "failed").scalar() or 0

    by_channel = {}
    for ch in ["sms", "email", "in_app", "whatsapp"]:
        by_channel[ch] = db.query(func.count(NotificationLog.id)).filter(NotificationLog.channel == ch).scalar() or 0

    return {
        "logs": items,
        "stats": {
            "total": total,
            "sent": sent,
            "failed": failed,
            "delivery_rate": round(sent / total * 100, 1) if total > 0 else 0,
            "by_channel": by_channel,
        },
    }
