"""
User Activity Analytics — Dashboard showing who did what, access patterns,
unusual behavior detection, and activity heatmap.
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, desc

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, AuditLog

router = APIRouter(prefix="/user-activity", tags=["Audit"])


@router.get("/summary")
def activity_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """User activity analytics with anomaly detection."""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    seven_days = now - timedelta(days=7)
    thirty_days = now - timedelta(days=30)

    # Active users (last 7 days)
    active_users_7d = db.query(func.count(func.distinct(AuditLog.user_id))).filter(
        AuditLog.created_at >= seven_days, AuditLog.user_id.isnot(None)
    ).scalar() or 0

    total_users = db.query(func.count(User.id)).scalar() or 1

    # Per-user stats
    users = db.query(User).all()
    user_stats = []
    for u in users:
        actions_30d = db.query(func.count(AuditLog.id)).filter(
            AuditLog.user_id == u.id, AuditLog.created_at >= thirty_days
        ).scalar() or 0
        actions_7d = db.query(func.count(AuditLog.id)).filter(
            AuditLog.user_id == u.id, AuditLog.created_at >= seven_days
        ).scalar() or 0
        actions_today = db.query(func.count(AuditLog.id)).filter(
            AuditLog.user_id == u.id, AuditLog.created_at >= today_start
        ).scalar() or 0

        last_action = db.query(AuditLog).filter(
            AuditLog.user_id == u.id
        ).order_by(desc(AuditLog.created_at)).first()

        # Most common actions
        top_actions = (
            db.query(AuditLog.action, func.count(AuditLog.id))
            .filter(AuditLog.user_id == u.id, AuditLog.created_at >= thirty_days)
            .group_by(AuditLog.action)
            .order_by(desc(func.count(AuditLog.id)))
            .limit(5)
            .all()
        )

        # Unique resources accessed
        unique_resources = db.query(func.count(func.distinct(AuditLog.resource_id))).filter(
            AuditLog.user_id == u.id, AuditLog.created_at >= thirty_days,
            AuditLog.resource_id.isnot(None)
        ).scalar() or 0

        # Detect anomalies
        anomalies = []
        daily_avg = actions_30d / 30 if actions_30d > 0 else 0
        if actions_today > daily_avg * 3 and actions_today > 20:
            anomalies.append(f"Activity {actions_today}x today vs {daily_avg:.0f} daily avg")
        if unique_resources > 50:
            anomalies.append(f"Accessed {unique_resources} unique records (high volume)")

        user_stats.append({
            "id": u.id,
            "name": u.full_name,
            "email": u.email,
            "roles": [r.name for r in u.roles] if u.roles else [],
            "is_active": u.is_active,
            "actions_30d": actions_30d,
            "actions_7d": actions_7d,
            "actions_today": actions_today,
            "unique_resources": unique_resources,
            "last_action": last_action.created_at.isoformat() if last_action and last_action.created_at else None,
            "last_action_type": last_action.action if last_action else None,
            "last_ip": last_action.ip_address if last_action else None,
            "top_actions": [{"action": a, "count": c} for a, c in top_actions],
            "anomalies": anomalies,
        })

    user_stats.sort(key=lambda x: x["actions_7d"], reverse=True)

    # Hourly activity heatmap (last 7 days)
    heatmap = []
    for day in range(7):
        day_date = (now - timedelta(days=6 - day)).date()
        day_name = day_date.strftime("%a")
        hours = []
        for hour in range(24):
            h_start = datetime.combine(day_date, datetime.min.time()) + timedelta(hours=hour)
            h_end = h_start + timedelta(hours=1)
            count = db.query(func.count(AuditLog.id)).filter(
                and_(AuditLog.created_at >= h_start, AuditLog.created_at < h_end)
            ).scalar() or 0
            hours.append(count)
        heatmap.append({"day": day_name, "date": str(day_date), "hours": hours})

    # Anomalies summary
    all_anomalies = [
        {"user": u["name"], "anomaly": a}
        for u in user_stats
        for a in u["anomalies"]
    ]

    return {
        "users": user_stats,
        "heatmap": heatmap,
        "anomalies": all_anomalies,
        "summary": {
            "total_users": total_users,
            "active_users_7d": active_users_7d,
            "total_actions_30d": sum(u["actions_30d"] for u in user_stats),
            "users_with_anomalies": len([u for u in user_stats if u["anomalies"]]),
        },
    }
