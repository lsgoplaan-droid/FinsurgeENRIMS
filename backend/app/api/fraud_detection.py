"""
Fraud Detection — Dedicated enterprise fraud detection dashboard.
Shows all fraud rules (R-001 to R-014 + existing), real-time fraud alerts,
channel-wise fraud stats, and fraud ring detection.
"""
import json
import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Rule, Alert, Transaction, Customer, Case, User

router = APIRouter(prefix="/fraud-detection", tags=["Fraud Detection"])


@router.get("/dashboard")
def fraud_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fraud detection command center — real-time fraud metrics."""
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    # Fraud alerts today
    fraud_alerts_today = db.query(func.count(Alert.id)).filter(
        Alert.alert_type == "fraud", Alert.created_at >= today
    ).scalar() or 0

    # Total fraud alerts (open)
    open_fraud_alerts = db.query(func.count(Alert.id)).filter(
        Alert.alert_type == "fraud",
        ~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]),
    ).scalar() or 0

    # Fraud cases
    fraud_cases = db.query(func.count(Case.id)).filter(
        Case.case_type == "fraud_investigation",
        Case.status.in_(["assigned", "under_investigation", "escalated", "open", "pending_regulatory", "new"]),
    ).scalar() or 0

    # Blocked/flagged transactions today
    flagged_today = db.query(func.count(Transaction.id)).filter(
        Transaction.is_flagged == True, Transaction.transaction_date >= today
    ).scalar() or 0

    # Amount at risk
    amount_at_risk = db.query(func.sum(Transaction.amount)).filter(
        Transaction.is_flagged == True, Transaction.transaction_date >= week_ago
    ).scalar() or 0

    # Fraud by channel
    fraud_by_channel = dict(
        db.query(Transaction.channel, func.count(Transaction.id))
        .filter(Transaction.is_flagged == True, Transaction.transaction_date >= week_ago)
        .group_by(Transaction.channel).all()
    )

    # Fraud by method
    fraud_by_method = dict(
        db.query(Transaction.transaction_method, func.count(Transaction.id))
        .filter(Transaction.is_flagged == True, Transaction.transaction_date >= week_ago)
        .group_by(Transaction.transaction_method).all()
    )

    # Top triggered fraud rules
    fraud_categories = ["fraud", "cyber_fraud", "ai_fraud", "internal_fraud"]
    fraud_rules = db.query(Rule).filter(Rule.category.in_(fraud_categories)).order_by(Rule.detection_count.desc()).limit(10).all()
    top_rules = [
        {"name": r.name, "description": r.description, "subcategory": r.subcategory,
         "severity": r.severity, "detections": r.detection_count or 0,
         "last_triggered": r.last_triggered_at.isoformat() if r.last_triggered_at else None}
        for r in fraud_rules
    ]

    # Recent fraud alerts
    recent = db.query(Alert).filter(Alert.alert_type == "fraud").order_by(Alert.created_at.desc()).limit(10).all()
    recent_alerts = []
    for a in recent:
        c = db.query(Customer).filter(Customer.id == a.customer_id).first()
        recent_alerts.append({
            "id": a.id, "alert_number": a.alert_number, "title": a.title,
            "priority": a.priority, "status": a.status,
            "customer_name": c.full_name if c else "",
            "risk_score": a.risk_score or 0,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    return {
        "fraud_alerts_today": fraud_alerts_today,
        "open_fraud_alerts": open_fraud_alerts,
        "active_fraud_cases": fraud_cases,
        "flagged_transactions_today": flagged_today,
        "amount_at_risk": amount_at_risk,
        "fraud_by_channel": fraud_by_channel,
        "fraud_by_method": fraud_by_method,
        "top_fraud_rules": top_rules,
        "recent_fraud_alerts": recent_alerts,
    }


@router.get("/rules")
def get_fraud_rules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get all fraud detection rules with their configuration."""
    fraud_categories = ["fraud", "cyber_fraud", "ai_fraud", "internal_fraud"]
    rules = db.query(Rule).filter(Rule.category.in_(fraud_categories)).order_by(Rule.priority, Rule.name).all()

    result = []
    for r in rules:
        actions = json.loads(r.actions) if r.actions else []
        # Extract flag_reason as description from actions
        flag_reason = ""
        for a in actions:
            if a.get("action") == "flag_transaction":
                flag_reason = a.get("params", {}).get("reason", "")
                break
        result.append({
            "id": r.id,
            "rule_id": r.name,
            "name": r.description,
            "description": flag_reason or r.description,
            "category": r.category,
            "subcategory": r.subcategory,
            "severity": r.severity,
            "is_enabled": r.is_enabled,
            "action_summary": _summarize_actions(actions),
            "time_window": r.time_window,
            "threshold_amount": r.threshold_amount,
            "detection_count": r.detection_count or 0,
            "last_triggered": r.last_triggered_at.isoformat() if r.last_triggered_at else None,
        })
    return result


def _summarize_actions(actions: list) -> str:
    parts = []
    for a in actions:
        action = a.get("action", "")
        if action == "create_alert":
            parts.append("Alert")
        elif action == "flag_transaction":
            parts.append("Flag")
        elif action == "adjust_risk_score":
            parts.append("Risk+")
        elif action == "generate_ctr":
            parts.append("CTR")
        elif action == "trigger_edd":
            parts.append("EDD")
    return " & ".join(parts) if parts else "Alert"


@router.get("/live-feed")
def fraud_live_feed(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Live feed of flagged/suspicious transactions."""
    query = db.query(Transaction).filter(Transaction.is_flagged == True)
    total = query.count()
    txns = query.order_by(Transaction.transaction_date.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for t in txns:
        c = db.query(Customer).filter(Customer.id == t.customer_id).first()
        items.append({
            "id": t.id,
            "transaction_ref": t.transaction_ref,
            "customer_name": c.full_name if c else "",
            "customer_id": t.customer_id,
            "amount": t.amount,
            "channel": t.channel,
            "method": t.transaction_method,
            "risk_score": t.risk_score or 0,
            "flag_reason": t.flag_reason or "",
            "location_city": t.location_city,
            "transaction_date": t.transaction_date.isoformat() if t.transaction_date else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}
