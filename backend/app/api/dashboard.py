from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func, case as sql_case, and_
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Alert, Case, Customer, Transaction, User
from app.schemas.dashboard import ExecutiveDashboard

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# ─── In-memory risk appetite thresholds (CRO-configurable) ─────────────────
_DEFAULT_THRESHOLDS = {
    "high_risk_customer_pct": {"limit": 15.0, "warning": 12.0},
    "portfolio_avg_risk": {"limit": 45.0, "warning": 35.0},
    "pep_exposure_pct": {"limit": 5.0, "warning": 3.0},
    "sla_compliance_pct": {"limit": 85.0, "warning": 90.0},
    "flagged_txn_pct": {"limit": 2.0, "warning": 1.5},
}
_risk_thresholds: Dict[str, Dict[str, float]] = {k: dict(v) for k, v in _DEFAULT_THRESHOLDS.items()}

# Audit log of threshold changes — each entry: {metric_id, warning, limit, evidence_url, changed_by, changed_at}
_threshold_change_log: list = []


def _get_risk_thresholds():
    return _risk_thresholds


class ThresholdUpdate(BaseModel):
    metric_id: str
    warning: Optional[float] = None
    limit: Optional[float] = None
    evidence_url: Optional[str] = None
    justification: Optional[str] = None


@router.get("/risk-appetite/thresholds")
def get_thresholds(current_user: User = Depends(get_current_user)):
    """Get current CRO-defined risk appetite thresholds."""
    return _risk_thresholds


@router.get("/risk-appetite/thresholds/history")
def get_threshold_history(current_user: User = Depends(get_current_user)):
    """Get audit history of all threshold changes (with evidence URLs)."""
    return {"history": _threshold_change_log, "total": len(_threshold_change_log)}


@router.put("/risk-appetite/thresholds")
def update_threshold(body: ThresholdUpdate, current_user: User = Depends(get_current_user)):
    """Update a risk appetite threshold (CRO action). Logs evidence_url for audit."""
    if body.metric_id not in _risk_thresholds:
        from fastapi import HTTPException
        raise HTTPException(400, f"Unknown metric: {body.metric_id}")
    if body.warning is not None:
        _risk_thresholds[body.metric_id]["warning"] = body.warning
    if body.limit is not None:
        _risk_thresholds[body.metric_id]["limit"] = body.limit
    # Append to immutable change log
    _threshold_change_log.append({
        "metric_id": body.metric_id,
        "warning": _risk_thresholds[body.metric_id]["warning"],
        "limit": _risk_thresholds[body.metric_id]["limit"],
        "evidence_url": body.evidence_url,
        "justification": body.justification,
        "changed_by": current_user.full_name,
        "changed_at": datetime.utcnow().isoformat(),
    })
    return {"metric_id": body.metric_id, **_risk_thresholds[body.metric_id]}


@router.post("/risk-appetite/thresholds/reset")
def reset_thresholds(current_user: User = Depends(get_current_user)):
    """Reset all thresholds to defaults."""
    global _risk_thresholds
    _risk_thresholds = {k: dict(v) for k, v in _DEFAULT_THRESHOLDS.items()}
    return _risk_thresholds


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

    # SLA compliance — calculate overdue dynamically: sla_due_at has passed
    overdue_alerts = db.query(func.count(Alert.id)).filter(
        Alert.sla_due_at.isnot(None),
        Alert.sla_due_at < now,
        ~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"])
    ).scalar() or 0
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


@router.get("/geo-risk")
def geographic_risk(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Geographic risk distribution by state — powers the India risk heatmap."""

    # Get customer counts and avg risk by state
    state_data = (
        db.query(
            Customer.state,
            func.count(Customer.id).label("customers"),
            func.avg(Customer.risk_score).label("avg_risk"),
            func.sum(sql_case((Customer.risk_category.in_(["high", "very_high"]), 1), else_=0)).label("high_risk_count"),
        )
        .filter(Customer.is_active == True, Customer.state.isnot(None))
        .group_by(Customer.state)
        .all()
    )

    # Get alert counts by customer state
    alert_by_state = dict(
        db.query(Customer.state, func.count(Alert.id))
        .join(Alert, Alert.customer_id == Customer.id)
        .filter(Customer.state.isnot(None), ~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]))
        .group_by(Customer.state)
        .all()
    )

    # Get transaction volume by customer state
    txn_by_state = dict(
        db.query(Customer.state, func.sum(Transaction.amount))
        .join(Transaction, Transaction.customer_id == Customer.id)
        .filter(Customer.state.isnot(None))
        .group_by(Customer.state)
        .all()
    )

    # Get flagged txn amount by state
    flagged_by_state = dict(
        db.query(Customer.state, func.sum(Transaction.amount))
        .join(Transaction, Transaction.customer_id == Customer.id)
        .filter(Customer.state.isnot(None), Transaction.is_flagged == True)
        .group_by(Customer.state)
        .all()
    )

    states = []
    for row in state_data:
        state_name = row[0]
        avg_risk = float(row[2] or 0)
        states.append({
            "state": state_name,
            "customers": row[1],
            "avg_risk": round(avg_risk, 1),
            "high_risk_count": row[3] or 0,
            "open_alerts": alert_by_state.get(state_name, 0),
            "transaction_volume": txn_by_state.get(state_name, 0) or 0,
            "flagged_amount": flagged_by_state.get(state_name, 0) or 0,
        })

    # Sort by avg_risk descending
    states.sort(key=lambda x: x["avg_risk"], reverse=True)

    # Summary
    total_customers = sum(s["customers"] for s in states)
    total_high_risk = sum(s["high_risk_count"] for s in states)
    total_alerts = sum(s["open_alerts"] for s in states)
    hotspot_state = states[0]["state"] if states else None

    return {
        "states": states,
        "summary": {
            "total_states": len(states),
            "total_customers": total_customers,
            "total_high_risk": total_high_risk,
            "total_open_alerts": total_alerts,
            "hotspot": hotspot_state,
        },
    }


@router.get("/risk-appetite")
def risk_appetite(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Risk appetite dashboard — portfolio risk vs CRO-set thresholds."""
    now = datetime.utcnow()

    total_customers = db.query(func.count(Customer.id)).filter(Customer.is_active == True).scalar() or 1
    high_risk = db.query(func.count(Customer.id)).filter(
        Customer.is_active == True, Customer.risk_category.in_(["high", "very_high"])
    ).scalar() or 0
    avg_portfolio_risk = db.query(func.avg(Customer.risk_score)).filter(Customer.is_active == True).scalar() or 0

    # PEP exposure
    pep_count = db.query(func.count(Customer.id)).filter(Customer.is_active == True, Customer.pep_status == True).scalar() or 0

    # Open alerts / cases
    open_alerts = db.query(func.count(Alert.id)).filter(
        ~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"])
    ).scalar() or 0
    overdue_alerts = db.query(func.count(Alert.id)).filter(Alert.is_overdue == True).scalar() or 0
    open_cases = db.query(func.count(Case.id)).filter(
        ~Case.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"])
    ).scalar() or 0

    # Flagged transaction volume (last 30 days)
    thirty_days_ago = now - timedelta(days=30)
    flagged_txn_vol = db.query(func.sum(Transaction.amount)).filter(
        Transaction.is_flagged == True, Transaction.transaction_date >= thirty_days_ago
    ).scalar() or 0
    total_txn_vol = db.query(func.sum(Transaction.amount)).filter(
        Transaction.transaction_date >= thirty_days_ago
    ).scalar() or 1

    high_risk_pct = round(high_risk / total_customers * 100, 1)
    flagged_pct = round(flagged_txn_vol / total_txn_vol * 100, 2) if total_txn_vol else 0

    # Thresholds — in-memory store (persists until restart, production would use DB)
    thresholds = _get_risk_thresholds()

    sla_compliance = round((1 - overdue_alerts / max(open_alerts, 1)) * 100, 1) if open_alerts else 100.0
    pep_pct = round(pep_count / total_customers * 100, 2)

    metrics = [
        {
            "id": "high_risk_pct",
            "label": "High-Risk Customer Exposure",
            "value": high_risk_pct,
            "unit": "%",
            "threshold": thresholds["high_risk_customer_pct"],
            "status": "breach" if high_risk_pct > thresholds["high_risk_customer_pct"]["limit"] else "warning" if high_risk_pct > thresholds["high_risk_customer_pct"]["warning"] else "ok",
        },
        {
            "id": "avg_risk",
            "label": "Portfolio Average Risk Score",
            "value": round(float(avg_portfolio_risk), 1),
            "unit": "/ 100",
            "threshold": thresholds["portfolio_avg_risk"],
            "status": "breach" if float(avg_portfolio_risk) > thresholds["portfolio_avg_risk"]["limit"] else "warning" if float(avg_portfolio_risk) > thresholds["portfolio_avg_risk"]["warning"] else "ok",
        },
        {
            "id": "pep_exposure",
            "label": "PEP Exposure",
            "value": pep_pct,
            "unit": "%",
            "threshold": thresholds["pep_exposure_pct"],
            "status": "breach" if pep_pct > thresholds["pep_exposure_pct"]["limit"] else "warning" if pep_pct > thresholds["pep_exposure_pct"]["warning"] else "ok",
        },
        {
            "id": "sla_compliance",
            "label": "SLA Compliance Rate",
            "value": sla_compliance,
            "unit": "%",
            "threshold": thresholds["sla_compliance_pct"],
            "status": "breach" if sla_compliance < thresholds["sla_compliance_pct"]["limit"] else "warning" if sla_compliance < thresholds["sla_compliance_pct"]["warning"] else "ok",
        },
        {
            "id": "flagged_txn",
            "label": "Flagged Transaction Volume",
            "value": flagged_pct,
            "unit": "%",
            "threshold": thresholds["flagged_txn_pct"],
            "status": "breach" if flagged_pct > thresholds["flagged_txn_pct"]["limit"] else "warning" if flagged_pct > thresholds["flagged_txn_pct"]["warning"] else "ok",
        },
    ]

    breach_count = sum(1 for m in metrics if m["status"] == "breach")
    warning_count = sum(1 for m in metrics if m["status"] == "warning")

    return {
        "metrics": metrics,
        "summary": {
            "overall_status": "breach" if breach_count > 0 else "warning" if warning_count > 0 else "ok",
            "breaches": breach_count,
            "warnings": warning_count,
            "total_customers": total_customers,
            "high_risk_customers": high_risk,
            "pep_count": pep_count,
            "open_alerts": open_alerts,
            "overdue_alerts": overdue_alerts,
            "open_cases": open_cases,
        },
    }
