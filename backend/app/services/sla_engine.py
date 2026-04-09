"""
SLA escalation engine.
Checks for overdue alerts and cases, auto-escalates them.
Called periodically (via API endpoint or background scheduler).
"""
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models import Alert, Case, Notification


def check_and_escalate(db: Session) -> dict:
    """
    Check all open alerts and cases for SLA breaches.
    - Marks overdue items
    - Auto-escalates critical overdue alerts
    - Creates notifications for assignees and managers
    """
    now = datetime.utcnow()
    results = {"alerts_overdue": 0, "alerts_escalated": 0, "cases_overdue": 0, "notifications_created": 0}

    # ── Alerts SLA check ────────────────────────────────────────────────
    open_alerts = db.query(Alert).filter(
        ~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]),
        Alert.sla_due_at.isnot(None),
    ).all()

    for alert in open_alerts:
        if now > alert.sla_due_at and not alert.is_overdue:
            alert.is_overdue = True
            results["alerts_overdue"] += 1

            # Auto-escalate critical overdue alerts
            if alert.priority == "critical" and alert.status != "escalated":
                alert.status = "escalated"
                results["alerts_escalated"] += 1

            # Create notification for assignee
            if alert.assigned_to:
                notif = Notification(
                    user_id=alert.assigned_to,
                    title=f"SLA Breach: {alert.alert_number}",
                    message=f"Alert {alert.alert_number} has exceeded its SLA. Priority: {alert.priority}",
                    notification_type="sla_warning",
                    link_to=f"/alerts/{alert.id}",
                )
                db.add(notif)
                results["notifications_created"] += 1

    # ── Cases SLA check ─────────────────────────────────────────────────
    open_cases = db.query(Case).filter(
        ~Case.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]),
        Case.sla_due_at.isnot(None),
    ).all()

    for case in open_cases:
        if now > case.sla_due_at and not case.is_overdue:
            case.is_overdue = True
            results["cases_overdue"] += 1

            if case.assigned_to:
                notif = Notification(
                    user_id=case.assigned_to,
                    title=f"SLA Breach: {case.case_number}",
                    message=f"Case {case.case_number} has exceeded its SLA. Priority: {case.priority}",
                    notification_type="sla_warning",
                    link_to=f"/cases/{case.id}",
                )
                db.add(notif)
                results["notifications_created"] += 1

    db.flush()
    return results
