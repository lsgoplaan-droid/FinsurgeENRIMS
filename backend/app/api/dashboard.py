from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case as sql_case, and_
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Alert, Case, Customer, Transaction, User
from app.schemas.dashboard import ExecutiveDashboard

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/executive")
def executive_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # KPIs
    alerts_today = db.query(func.count(Alert.id)).filter(Alert.created_at >= today_start).scalar() or 0
    open_cases = db.query(func.count(Case.id)).filter(
        ~Case.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"])
    ).scalar() or 0
    high_risk = db.query(func.count(Customer.id)).filter(Customer.risk_category.in_(["high", "very_high"])).scalar() or 0
    suspicious_txn = db.query(func.count(Transaction.id)).filter(Transaction.is_flagged == True).scalar() or 0

    # Alerts by priority
    alerts_by_priority = dict(
        db.query(Alert.priority, func.count(Alert.id))
        .filter(~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]))
        .group_by(Alert.priority).all()
    )

    # Alerts by type
    alerts_by_type = dict(
        db.query(Alert.alert_type, func.count(Alert.id)).group_by(Alert.alert_type).all()
    )

    # 30-day alert trend
    alerts_trend = []
    for i in range(29, -1, -1):
        day = (now - timedelta(days=i)).date()
        day_start = datetime.combine(day, datetime.min.time())
        day_end = day_start + timedelta(days=1)
        count = db.query(func.count(Alert.id)).filter(
            and_(Alert.created_at >= day_start, Alert.created_at < day_end)
        ).scalar() or 0
        alerts_trend.append({"date": str(day), "count": count})

    # Cases by status
    cases_by_status = dict(
        db.query(Case.status, func.count(Case.id)).group_by(Case.status).all()
    )

    # Risk distribution
    risk_dist = dict(
        db.query(Customer.risk_category, func.count(Customer.id))
        .filter(Customer.is_active == True)
        .group_by(Customer.risk_category).all()
    )

    # Channel analytics
    channel_analytics = dict(
        db.query(Transaction.channel, func.count(Transaction.id))
        .group_by(Transaction.channel).all()
    )

    # Recent alerts
    recent = db.query(Alert).order_by(Alert.created_at.desc()).limit(10).all()
    recent_alerts = []
    for a in recent:
        c = db.query(Customer).filter(Customer.id == a.customer_id).first()
        recent_alerts.append({
            "id": a.id, "alert_number": a.alert_number, "title": a.title,
            "priority": a.priority, "status": a.status, "alert_type": a.alert_type,
            "customer_name": c.full_name if c else "",
            "risk_score": a.risk_score or 0,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    # Top risk customers
    top_risk = db.query(Customer).filter(Customer.is_active == True).order_by(Customer.risk_score.desc()).limit(10).all()
    top_risk_customers = [
        {"id": c.id, "name": c.full_name, "customer_number": c.customer_number, "risk_score": c.risk_score or 0, "risk_category": c.risk_category, "pep_status": c.pep_status}
        for c in top_risk
    ]

    # Analyst workload
    workload = (
        db.query(User.full_name, func.count(Alert.id))
        .join(Alert, Alert.assigned_to == User.id)
        .filter(~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]))
        .group_by(User.full_name)
        .all()
    )
    analyst_workload = [{"name": name, "open_alerts": cnt} for name, cnt in workload]

    # SLA compliance
    overdue_alerts = db.query(func.count(Alert.id)).filter(Alert.is_overdue == True).scalar() or 0
    total_active = db.query(func.count(Alert.id)).filter(
        ~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"])
    ).scalar() or 1
    sla_compliance = {
        "compliant": total_active - overdue_alerts,
        "overdue": overdue_alerts,
        "rate": round((total_active - overdue_alerts) / total_active * 100, 1) if total_active > 0 else 100,
    }

    # Monthly stats (last 6 months)
    monthly_stats = []
    for i in range(5, -1, -1):
        month_start = (now - timedelta(days=i * 30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        if i > 0:
            month_end = (now - timedelta(days=(i - 1) * 30)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            month_end = now
        m_alerts = db.query(func.count(Alert.id)).filter(and_(Alert.created_at >= month_start, Alert.created_at < month_end)).scalar() or 0
        m_cases = db.query(func.count(Case.id)).filter(and_(Case.created_at >= month_start, Case.created_at < month_end)).scalar() or 0
        m_txns = db.query(func.count(Transaction.id)).filter(and_(Transaction.transaction_date >= month_start, Transaction.transaction_date < month_end)).scalar() or 0
        monthly_stats.append({"month": month_start.strftime("%Y-%m"), "alerts": m_alerts, "cases": m_cases, "transactions": m_txns})

    return ExecutiveDashboard(
        total_alerts_today=alerts_today,
        open_cases=open_cases,
        high_risk_customers=high_risk,
        suspicious_transactions=suspicious_txn,
        alerts_by_priority=alerts_by_priority,
        alerts_by_type=alerts_by_type,
        alerts_trend=alerts_trend,
        cases_by_status=cases_by_status,
        risk_distribution=risk_dist,
        channel_analytics=channel_analytics,
        recent_alerts=recent_alerts,
        top_risk_customers=top_risk_customers,
        analyst_workload=analyst_workload,
        sla_compliance=sla_compliance,
        monthly_stats=monthly_stats,
    )


@router.get("/risk-heatmap")
def risk_heatmap(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    channels = ["branch", "atm", "internet_banking", "mobile_banking", "pos", "swift"]
    risk_levels = ["low", "medium", "high", "critical"]

    data = []
    for channel in channels:
        row = []
        for risk in risk_levels:
            if risk == "low":
                count = db.query(func.count(Transaction.id)).filter(Transaction.channel == channel, Transaction.risk_score < 25).scalar() or 0
            elif risk == "medium":
                count = db.query(func.count(Transaction.id)).filter(Transaction.channel == channel, Transaction.risk_score.between(25, 50)).scalar() or 0
            elif risk == "high":
                count = db.query(func.count(Transaction.id)).filter(Transaction.channel == channel, Transaction.risk_score.between(50, 75)).scalar() or 0
            else:
                count = db.query(func.count(Transaction.id)).filter(Transaction.channel == channel, Transaction.risk_score > 75).scalar() or 0
            row.append(count)
        data.append(row)

    return {"channels": channels, "risk_levels": risk_levels, "data": data}
