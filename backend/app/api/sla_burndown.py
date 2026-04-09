"""
SLA Burndown — Alerts/Cases approaching SLA breach, time remaining,
EOD prediction for compliance teams.
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Alert, Case, User

router = APIRouter(prefix="/sla-burndown", tags=["SLA Burndown"])


def _hours_remaining(sla_due: datetime) -> float:
    if not sla_due:
        return 999
    delta = sla_due - datetime.utcnow()
    return round(delta.total_seconds() / 3600, 1)


@router.get("/alerts")
def sla_burndown_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Alerts with SLA tracking — approaching breach, breached, on track."""
    now = datetime.utcnow()
    eod = now.replace(hour=18, minute=0, second=0, microsecond=0)
    if now > eod:
        eod = eod + timedelta(days=1)

    # All open alerts (not closed)
    open_alerts = (
        db.query(Alert)
        .filter(~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]))
        .all()
    )

    breached = []
    at_risk = []  # Due before EOD
    approaching = []  # Due within 24h
    on_track = []

    for a in open_alerts:
        assignee_name = None
        if a.assigned_to:
            user = db.query(User).filter(User.id == a.assigned_to).first()
            assignee_name = user.full_name if user else None

        item = {
            "id": a.id,
            "alert_number": a.alert_number,
            "title": a.title,
            "priority": a.priority,
            "status": a.status,
            "assignee_name": assignee_name,
            "sla_due_at": a.sla_due_at.isoformat() if a.sla_due_at else None,
            "hours_remaining": _hours_remaining(a.sla_due_at) if a.sla_due_at else None,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }

        if not a.sla_due_at:
            on_track.append(item)
        elif a.sla_due_at < now:
            item["hours_remaining"] = _hours_remaining(a.sla_due_at)
            breached.append(item)
        elif a.sla_due_at <= eod:
            at_risk.append(item)
        elif a.sla_due_at <= now + timedelta(hours=24):
            approaching.append(item)
        else:
            on_track.append(item)

    # Sort by urgency
    breached.sort(key=lambda x: x["hours_remaining"] or 0)
    at_risk.sort(key=lambda x: x["hours_remaining"] or 0)
    approaching.sort(key=lambda x: x["hours_remaining"] or 0)

    return {
        "breached": breached,
        "at_risk_eod": at_risk,
        "approaching": approaching,
        "on_track": on_track,
        "summary": {
            "total_open": len(open_alerts),
            "breached": len(breached),
            "at_risk_eod": len(at_risk),
            "approaching_24h": len(approaching),
            "on_track": len(on_track),
        },
    }


@router.get("/cases")
def sla_burndown_cases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cases with SLA tracking."""
    now = datetime.utcnow()
    eod = now.replace(hour=18, minute=0, second=0, microsecond=0)
    if now > eod:
        eod = eod + timedelta(days=1)

    open_cases = (
        db.query(Case)
        .filter(~Case.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]))
        .all()
    )

    breached = []
    at_risk = []
    approaching = []
    on_track = []

    for c in open_cases:
        assignee_name = None
        if c.assigned_to:
            user = db.query(User).filter(User.id == c.assigned_to).first()
            assignee_name = user.full_name if user else None

        item = {
            "id": c.id,
            "case_number": c.case_number,
            "title": c.title,
            "priority": c.priority,
            "status": c.status,
            "assignee_name": assignee_name,
            "sla_due_at": c.sla_due_at.isoformat() if c.sla_due_at else None,
            "hours_remaining": _hours_remaining(c.sla_due_at) if c.sla_due_at else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }

        if not c.sla_due_at:
            on_track.append(item)
        elif c.sla_due_at < now:
            breached.append(item)
        elif c.sla_due_at <= eod:
            at_risk.append(item)
        elif c.sla_due_at <= now + timedelta(hours=24):
            approaching.append(item)
        else:
            on_track.append(item)

    breached.sort(key=lambda x: x["hours_remaining"] or 0)
    at_risk.sort(key=lambda x: x["hours_remaining"] or 0)

    return {
        "breached": breached,
        "at_risk_eod": at_risk,
        "approaching": approaching,
        "on_track": on_track,
        "summary": {
            "total_open": len(open_cases),
            "breached": len(breached),
            "at_risk_eod": len(at_risk),
            "approaching_24h": len(approaching),
            "on_track": len(on_track),
        },
    }


@router.get("/stats")
def sla_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """High-level SLA compliance stats."""
    now = datetime.utcnow()

    # Alerts
    total_alerts = db.query(func.count(Alert.id)).filter(
        ~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"])
    ).scalar() or 0
    breached_alerts = db.query(func.count(Alert.id)).filter(
        Alert.is_overdue == True,
        ~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]),
    ).scalar() or 0
    sla_alerts_with_due = db.query(func.count(Alert.id)).filter(
        Alert.sla_due_at.isnot(None),
        ~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]),
    ).scalar() or 0

    # Cases
    total_cases = db.query(func.count(Case.id)).filter(
        ~Case.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"])
    ).scalar() or 0
    breached_cases = db.query(func.count(Case.id)).filter(
        Case.is_overdue == True,
        ~Case.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]),
    ).scalar() or 0

    alert_compliance = round((1 - breached_alerts / sla_alerts_with_due) * 100, 1) if sla_alerts_with_due > 0 else 100.0
    case_compliance = round((1 - breached_cases / total_cases) * 100, 1) if total_cases > 0 else 100.0

    return {
        "alert_sla": {
            "total_open": total_alerts,
            "breached": breached_alerts,
            "compliant": total_alerts - breached_alerts,
            "compliance_rate": alert_compliance,
        },
        "case_sla": {
            "total_open": total_cases,
            "breached": breached_cases,
            "compliant": total_cases - breached_cases,
            "compliance_rate": case_compliance,
        },
        "overall_compliance": round((alert_compliance + case_compliance) / 2, 1),
    }
