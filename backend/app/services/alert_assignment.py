"""
Auto-assignment service for alerts.
Round-robin + workload-based assignment to analysts.
"""
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Alert, User, Role, user_roles


def _get_analysts(db: Session) -> list[User]:
    """Get all active users with analyst or compliance_officer role."""
    analyst_roles = db.query(Role).filter(Role.name.in_(["analyst", "compliance_officer"])).all()
    role_ids = [r.id for r in analyst_roles]

    analysts = (
        db.query(User)
        .join(user_roles, User.id == user_roles.c.user_id)
        .filter(user_roles.c.role_id.in_(role_ids), User.is_active == True)
        .all()
    )
    return analysts


def _get_workload(db: Session, user_id: str) -> int:
    """Count open alerts assigned to a user."""
    return db.query(func.count(Alert.id)).filter(
        Alert.assigned_to == user_id,
        ~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]),
    ).scalar() or 0


def auto_assign_alerts(db: Session, alert_ids: list[str]):
    """Auto-assign new alerts using workload-based round-robin."""
    if not alert_ids:
        return

    analysts = _get_analysts(db)
    if not analysts:
        return

    # Sort by current workload (fewest open alerts first)
    analyst_workloads = [(a, _get_workload(db, a.id)) for a in analysts]
    analyst_workloads.sort(key=lambda x: x[1])

    for i, alert_id in enumerate(alert_ids):
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if not alert or alert.assigned_to:
            continue

        # Pick analyst with least workload (round-robin within same workload)
        analyst, _ = analyst_workloads[i % len(analyst_workloads)]

        # Same-customer affinity: if analyst already has open alerts for this customer, prefer them
        for a, w in analyst_workloads:
            existing = db.query(Alert).filter(
                Alert.assigned_to == a.id,
                Alert.customer_id == alert.customer_id,
                ~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]),
            ).first()
            if existing:
                analyst = a
                break

        alert.assigned_to = analyst.id
        alert.assigned_at = datetime.utcnow()
        alert.status = "assigned"

    db.flush()
