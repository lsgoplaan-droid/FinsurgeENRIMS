"""
System Monitoring — Usage analytics, ageing reports, user activity,
system health, and operational metrics.
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, text
from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    User, Customer, Account, Transaction, Alert, Case, Rule,
    AuditLog, Notification, KYCReview,
    CTRReport, SARReport, WatchlistEntry,
)
from app.models.police_fir import PoliceFIR
from app.models.notification_rule import NotificationLog

router = APIRouter(prefix="/system-monitoring", tags=["System Monitoring"])


@router.get("/usage-dashboard")
def usage_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Overall system usage dashboard — entity counts, activity trends, user engagement."""
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    last_7d = now - timedelta(days=7)
    last_30d = now - timedelta(days=30)

    # Entity counts
    entities = {
        "customers": db.query(func.count(Customer.id)).scalar() or 0,
        "accounts": db.query(func.count(Account.id)).scalar() or 0,
        "transactions": db.query(func.count(Transaction.id)).scalar() or 0,
        "alerts": db.query(func.count(Alert.id)).scalar() or 0,
        "cases": db.query(func.count(Case.id)).scalar() or 0,
        "rules": db.query(func.count(Rule.id)).scalar() or 0,
        "users": db.query(func.count(User.id)).scalar() or 0,
        "sar_reports": db.query(func.count(SARReport.id)).scalar() or 0,
        "ctr_reports": db.query(func.count(CTRReport.id)).scalar() or 0,
        "watchlist_entries": db.query(func.count(WatchlistEntry.id)).scalar() or 0,
    }

    # Activity in last 7 days
    recent_activity = {
        "transactions_7d": db.query(func.count(Transaction.id)).filter(Transaction.created_at >= last_7d).scalar() or 0,
        "alerts_7d": db.query(func.count(Alert.id)).filter(Alert.created_at >= last_7d).scalar() or 0,
        "cases_7d": db.query(func.count(Case.id)).filter(Case.created_at >= last_7d).scalar() or 0,
        "audit_actions_7d": db.query(func.count(AuditLog.id)).filter(AuditLog.created_at >= last_7d).scalar() or 0,
        "logins_7d": db.query(func.count(AuditLog.id)).filter(
            AuditLog.created_at >= last_7d,
            AuditLog.action == "login",
        ).scalar() or 0,
    }

    # User engagement — last login for each user
    users = db.query(User).filter(User.is_active == True).all()
    user_activity = []
    for u in users:
        last_action = db.query(AuditLog).filter(AuditLog.user_id == u.id).order_by(desc(AuditLog.created_at)).first()
        action_count_30d = db.query(func.count(AuditLog.id)).filter(
            AuditLog.user_id == u.id,
            AuditLog.created_at >= last_30d,
        ).scalar() or 0

        alerts_closed = db.query(func.count(Alert.id)).filter(
            Alert.closed_by == u.id,
            Alert.closed_at >= last_30d,
        ).scalar() or 0

        user_activity.append({
            "user_id": u.id,
            "full_name": u.full_name,
            "department": u.department,
            "roles": [r.name for r in u.roles] if u.roles else [],
            "last_login": u.last_login_at.isoformat() if u.last_login_at else None,
            "last_action": last_action.created_at.isoformat() if last_action else None,
            "actions_30d": action_count_30d,
            "alerts_closed_30d": alerts_closed,
            "is_active": u.is_active,
        })

    user_activity.sort(key=lambda x: x["actions_30d"], reverse=True)

    # Daily transaction volumes (last 14 days)
    daily_volumes = []
    for i in range(14):
        day = today - timedelta(days=i)
        day_end = day + timedelta(days=1)
        txn_count = db.query(func.count(Transaction.id)).filter(
            Transaction.created_at >= day,
            Transaction.created_at < day_end,
        ).scalar() or 0
        alert_count = db.query(func.count(Alert.id)).filter(
            Alert.created_at >= day,
            Alert.created_at < day_end,
        ).scalar() or 0
        daily_volumes.append({
            "date": day.strftime("%Y-%m-%d"),
            "transactions": txn_count,
            "alerts": alert_count,
        })
    daily_volumes.reverse()

    return {
        "entities": entities,
        "recent_activity": recent_activity,
        "user_activity": user_activity,
        "daily_volumes": daily_volumes,
    }


@router.get("/ageing-report")
def ageing_report(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Ageing report — alerts and cases by age bucket."""
    now = datetime.utcnow()

    # Alert ageing
    open_alerts = db.query(Alert).filter(
        ~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"])
    ).all()

    alert_buckets = {"0-4h": 0, "4-24h": 0, "1-3d": 0, "3-7d": 0, "7-14d": 0, "14-30d": 0, "30d+": 0}
    alert_by_priority = {"critical": dict(alert_buckets), "high": dict(alert_buckets), "medium": dict(alert_buckets), "low": dict(alert_buckets)}

    for a in open_alerts:
        age_hours = (now - a.created_at).total_seconds() / 3600 if a.created_at else 0
        if age_hours <= 4:
            bucket = "0-4h"
        elif age_hours <= 24:
            bucket = "4-24h"
        elif age_hours <= 72:
            bucket = "1-3d"
        elif age_hours <= 168:
            bucket = "3-7d"
        elif age_hours <= 336:
            bucket = "7-14d"
        elif age_hours <= 720:
            bucket = "14-30d"
        else:
            bucket = "30d+"
        alert_buckets[bucket] += 1
        p = a.priority or "medium"
        if p in alert_by_priority:
            alert_by_priority[p][bucket] += 1

    # Case ageing
    open_cases = db.query(Case).filter(
        ~Case.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"])
    ).all()

    case_buckets = {"0-1d": 0, "1-3d": 0, "3-7d": 0, "7-14d": 0, "14-30d": 0, "30-60d": 0, "60d+": 0}
    case_by_priority = {"critical": dict(case_buckets), "high": dict(case_buckets), "medium": dict(case_buckets), "low": dict(case_buckets)}

    for c in open_cases:
        age_days = (now - c.created_at).total_seconds() / 86400 if c.created_at else 0
        if age_days <= 1:
            bucket = "0-1d"
        elif age_days <= 3:
            bucket = "1-3d"
        elif age_days <= 7:
            bucket = "3-7d"
        elif age_days <= 14:
            bucket = "7-14d"
        elif age_days <= 30:
            bucket = "14-30d"
        elif age_days <= 60:
            bucket = "30-60d"
        else:
            bucket = "60d+"
        case_buckets[bucket] += 1
        p = c.priority or "medium"
        if p in case_by_priority:
            case_by_priority[p][bucket] += 1

    # KYC ageing
    pending_kyc = db.query(KYCReview).filter(KYCReview.status.in_(["pending", "in_progress"])).all()
    kyc_buckets = {"0-7d": 0, "7-14d": 0, "14-30d": 0, "30d+": 0}
    for k in pending_kyc:
        age_days = (now - k.created_at).total_seconds() / 86400 if k.created_at else 0
        if age_days <= 7:
            kyc_buckets["0-7d"] += 1
        elif age_days <= 14:
            kyc_buckets["7-14d"] += 1
        elif age_days <= 30:
            kyc_buckets["14-30d"] += 1
        else:
            kyc_buckets["30d+"] += 1

    # Average resolution times (last 30 days)
    last_30d = now - timedelta(days=30)
    closed_alerts = db.query(Alert).filter(
        Alert.closed_at.isnot(None),
        Alert.closed_at >= last_30d,
    ).all()

    alert_resolution_hours = []
    for a in closed_alerts:
        if a.created_at and a.closed_at:
            hours = (a.closed_at - a.created_at).total_seconds() / 3600
            alert_resolution_hours.append(hours)

    closed_cases = db.query(Case).filter(
        Case.closed_at.isnot(None),
        Case.closed_at >= last_30d,
    ).all()

    case_resolution_days = []
    for c in closed_cases:
        if c.created_at and c.closed_at:
            days = (c.closed_at - c.created_at).total_seconds() / 86400
            case_resolution_days.append(days)

    return {
        "alert_ageing": {
            "total_open": len(open_alerts),
            "overdue": sum(1 for a in open_alerts if a.is_overdue),
            "buckets": alert_buckets,
            "by_priority": alert_by_priority,
            "avg_resolution_hours": round(sum(alert_resolution_hours) / len(alert_resolution_hours), 1) if alert_resolution_hours else 0,
        },
        "case_ageing": {
            "total_open": len(open_cases),
            "overdue": sum(1 for c in open_cases if c.is_overdue),
            "buckets": case_buckets,
            "by_priority": case_by_priority,
            "avg_resolution_days": round(sum(case_resolution_days) / len(case_resolution_days), 1) if case_resolution_days else 0,
        },
        "kyc_ageing": {
            "total_pending": len(pending_kyc),
            "buckets": kyc_buckets,
        },
    }


@router.get("/analyst-performance")
def analyst_performance(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Analyst performance metrics — workload, resolution times, quality."""
    now = datetime.utcnow()
    last_30d = now - timedelta(days=30)

    analysts = db.query(User).filter(User.is_active == True).all()

    results = []
    for u in analysts:
        # Current workload
        open_alerts = db.query(func.count(Alert.id)).filter(
            Alert.assigned_to == u.id,
            ~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]),
        ).scalar() or 0

        open_cases = db.query(func.count(Case.id)).filter(
            Case.assigned_to == u.id,
            ~Case.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]),
        ).scalar() or 0

        # Resolution stats (30d)
        closed_30d = db.query(Alert).filter(
            Alert.closed_by == u.id,
            Alert.closed_at >= last_30d,
        ).all()

        tp = sum(1 for a in closed_30d if a.status == "closed_true_positive")
        fp = sum(1 for a in closed_30d if a.status == "closed_false_positive")
        inc = sum(1 for a in closed_30d if a.status == "closed_inconclusive")

        resolution_hours = []
        for a in closed_30d:
            if a.created_at and a.closed_at:
                resolution_hours.append((a.closed_at - a.created_at).total_seconds() / 3600)

        overdue_closed = sum(1 for a in closed_30d if a.is_overdue)

        # SLA compliance
        sla_compliant = len(closed_30d) - overdue_closed

        results.append({
            "user_id": u.id,
            "full_name": u.full_name,
            "department": u.department,
            "roles": [r.name for r in u.roles] if u.roles else [],
            "open_alerts": open_alerts,
            "open_cases": open_cases,
            "total_workload": open_alerts + open_cases,
            "alerts_closed_30d": len(closed_30d),
            "true_positive_30d": tp,
            "false_positive_30d": fp,
            "inconclusive_30d": inc,
            "tp_rate": round(tp / len(closed_30d) * 100, 1) if closed_30d else 0,
            "avg_resolution_hours": round(sum(resolution_hours) / len(resolution_hours), 1) if resolution_hours else 0,
            "sla_compliance": round(sla_compliant / len(closed_30d) * 100, 1) if closed_30d else 100,
            "overdue_count": overdue_closed,
        })

    results.sort(key=lambda x: x["alerts_closed_30d"], reverse=True)
    return {"analysts": results}


@router.get("/rule-effectiveness")
def rule_effectiveness(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Detection rule effectiveness — which rules generate actionable alerts."""
    rules = db.query(Rule).all()
    results = []

    for r in rules:
        alerts = db.query(Alert).filter(Alert.rule_id == r.id).all()
        total = len(alerts)
        if total == 0:
            results.append({
                "rule_id": r.id,
                "rule_name": r.name,
                "category": r.category,
                "severity": r.severity,
                "is_enabled": r.is_enabled,
                "total_alerts": 0,
                "tp": 0, "fp": 0, "inconclusive": 0, "open": 0,
                "tp_rate": 0, "fp_rate": 0, "precision": 0,
                "effectiveness": "no_data",
                "recommendation": "No alerts generated — review thresholds",
            })
            continue

        tp = sum(1 for a in alerts if a.status == "closed_true_positive")
        fp = sum(1 for a in alerts if a.status == "closed_false_positive")
        inc = sum(1 for a in alerts if a.status == "closed_inconclusive")
        open_count = total - tp - fp - inc
        reviewed = tp + fp + inc

        tp_rate = round(tp / reviewed * 100, 1) if reviewed else 0
        fp_rate = round(fp / reviewed * 100, 1) if reviewed else 0
        precision = round(tp / (tp + fp) * 100, 1) if (tp + fp) > 0 else 0

        # Effectiveness classification
        if reviewed < 3:
            eff = "insufficient_data"
            rec = "Need more closed alerts for analysis"
        elif precision >= 80:
            eff = "excellent"
            rec = "Rule performing well — consider lowering threshold to catch more"
        elif precision >= 60:
            eff = "good"
            rec = "Rule effective — monitor for threshold optimization"
        elif precision >= 40:
            eff = "moderate"
            rec = "Review rule conditions to reduce false positives"
        elif precision >= 20:
            eff = "poor"
            rec = "High false positive rate — raise threshold or add conditions"
        else:
            eff = "critical"
            rec = "Rule generating mostly noise — consider disabling or complete redesign"

        results.append({
            "rule_id": r.id,
            "rule_name": r.name,
            "category": r.category,
            "severity": r.severity,
            "is_enabled": r.is_enabled,
            "total_alerts": total,
            "tp": tp, "fp": fp, "inconclusive": inc, "open": open_count,
            "tp_rate": tp_rate, "fp_rate": fp_rate, "precision": precision,
            "effectiveness": eff,
            "recommendation": rec,
        })

    results.sort(key=lambda x: x["total_alerts"], reverse=True)
    return {"rules": results}
