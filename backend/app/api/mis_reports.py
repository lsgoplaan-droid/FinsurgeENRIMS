"""
MIS Reports — Management Information System reports for bank leadership.
Operational, regulatory, risk, and productivity analytics.
"""
import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Transaction, Customer, Alert, Case, Rule, User, CTRReport, SARReport

router = APIRouter(prefix="/mis-reports", tags=["MIS Reports"])


@router.get("/operational")
def operational_report(
    period: str = Query("monthly", regex="^(daily|weekly|monthly)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Operational MIS report — transaction volumes, alert metrics, case throughput."""
    now = datetime.utcnow()
    if period == "daily":
        since = now - timedelta(days=1)
    elif period == "weekly":
        since = now - timedelta(days=7)
    else:
        since = now - timedelta(days=30)

    txn_count = db.query(func.count(Transaction.id)).filter(Transaction.transaction_date >= since).scalar() or 0
    txn_volume = db.query(func.sum(Transaction.amount)).filter(Transaction.transaction_date >= since).scalar() or 0
    flagged = db.query(func.count(Transaction.id)).filter(Transaction.transaction_date >= since, Transaction.is_flagged == True).scalar() or 0

    alerts_generated = db.query(func.count(Alert.id)).filter(Alert.created_at >= since).scalar() or 0
    alerts_closed = db.query(func.count(Alert.id)).filter(Alert.closed_at.isnot(None), Alert.closed_at >= since).scalar() or 0

    cases_opened = db.query(func.count(Case.id)).filter(Case.created_at >= since).scalar() or 0
    cases_closed = db.query(func.count(Case.id)).filter(Case.closed_at.isnot(None), Case.closed_at >= since).scalar() or 0

    # Channel breakdown
    by_channel = dict(db.query(Transaction.channel, func.count(Transaction.id)).filter(Transaction.transaction_date >= since).group_by(Transaction.channel).all())
    by_method = dict(db.query(Transaction.transaction_method, func.count(Transaction.id)).filter(Transaction.transaction_date >= since).group_by(Transaction.transaction_method).all())

    return {
        "report_type": "Operational MIS",
        "period": period,
        "date_range": {"from": since.isoformat(), "to": now.isoformat()},
        "transaction_metrics": {
            "total_count": txn_count,
            "total_volume_inr": txn_volume / 100 if txn_volume else 0,
            "flagged_count": flagged,
            "flagged_rate": round(flagged / max(txn_count, 1) * 100, 2),
            "by_channel": by_channel,
            "by_method": by_method,
        },
        "alert_metrics": {
            "generated": alerts_generated,
            "closed": alerts_closed,
            "closure_rate": round(alerts_closed / max(alerts_generated, 1) * 100, 1),
        },
        "case_metrics": {
            "opened": cases_opened,
            "closed": cases_closed,
        },
    }


@router.get("/risk")
def risk_report(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Risk MIS report — customer risk distribution, rule effectiveness, top risks."""
    risk_dist = dict(db.query(Customer.risk_category, func.count(Customer.id)).filter(Customer.is_active == True).group_by(Customer.risk_category).all())

    pep_count = db.query(func.count(Customer.id)).filter(Customer.pep_status == True).scalar() or 0
    expired_kyc = db.query(func.count(Customer.id)).filter(Customer.kyc_status == "expired").scalar() or 0

    # Top triggered rules
    top_rules = db.query(Rule.name, Rule.category, Rule.severity, Rule.detection_count).order_by(Rule.detection_count.desc()).limit(10).all()

    # Alert distribution
    alert_by_type = dict(db.query(Alert.alert_type, func.count(Alert.id)).group_by(Alert.alert_type).all())
    alert_by_priority = dict(db.query(Alert.priority, func.count(Alert.id)).group_by(Alert.priority).all())

    overdue_alerts = db.query(func.count(Alert.id)).filter(Alert.is_overdue == True).scalar() or 0
    overdue_cases = db.query(func.count(Case.id)).filter(Case.is_overdue == True).scalar() or 0

    return {
        "report_type": "Risk MIS",
        "customer_risk": {
            "distribution": risk_dist,
            "total_customers": sum(risk_dist.values()),
            "pep_customers": pep_count,
            "expired_kyc": expired_kyc,
        },
        "rule_effectiveness": {
            "top_rules": [{"name": n, "category": c, "severity": s, "detections": d or 0} for n, c, s, d in top_rules],
        },
        "alert_distribution": {
            "by_type": alert_by_type,
            "by_priority": alert_by_priority,
            "overdue": overdue_alerts,
        },
        "case_metrics": {
            "overdue": overdue_cases,
        },
    }


@router.get("/regulatory")
def regulatory_report(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Regulatory MIS report — CTR/SAR filing status, compliance metrics."""
    ctr_total = db.query(func.count(CTRReport.id)).scalar() or 0
    ctr_filed = db.query(func.count(CTRReport.id)).filter(CTRReport.filing_status == "filed").scalar() or 0
    ctr_pending = db.query(func.count(CTRReport.id)).filter(CTRReport.filing_status.in_(["auto_generated", "pending_review"])).scalar() or 0

    sar_total = db.query(func.count(SARReport.id)).scalar() or 0
    sar_filed = db.query(func.count(SARReport.id)).filter(SARReport.filing_status == "filed").scalar() or 0
    sar_pending = db.query(func.count(SARReport.id)).filter(SARReport.filing_status.in_(["draft", "pending_review"])).scalar() or 0

    kyc_approved = db.query(func.count(Customer.id)).filter(Customer.kyc_status == "approved").scalar() or 0
    kyc_expired = db.query(func.count(Customer.id)).filter(Customer.kyc_status == "expired").scalar() or 0
    kyc_pending = db.query(func.count(Customer.id)).filter(Customer.kyc_status == "pending").scalar() or 0

    return {
        "report_type": "Regulatory MIS",
        "ctr_reports": {"total": ctr_total, "filed": ctr_filed, "pending": ctr_pending},
        "sar_reports": {"total": sar_total, "filed": sar_filed, "pending": sar_pending},
        "kyc_compliance": {"approved": kyc_approved, "expired": kyc_expired, "pending": kyc_pending, "compliance_rate": round(kyc_approved / max(kyc_approved + kyc_expired + kyc_pending, 1) * 100, 1)},
    }


@router.get("/productivity")
def productivity_report(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Analyst productivity MIS report."""
    analysts = db.query(User).filter(User.is_active == True).all()
    since_30d = datetime.utcnow() - timedelta(days=30)

    productivity = []
    for user in analysts:
        assigned = db.query(func.count(Alert.id)).filter(Alert.assigned_to == user.id).scalar() or 0
        closed = db.query(func.count(Alert.id)).filter(Alert.closed_by == user.id, Alert.closed_at >= since_30d).scalar() or 0
        open_alerts = db.query(func.count(Alert.id)).filter(
            Alert.assigned_to == user.id,
            ~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]),
        ).scalar() or 0

        cases_assigned = db.query(func.count(Case.id)).filter(Case.assigned_to == user.id).scalar() or 0

        productivity.append({
            "user_name": user.full_name,
            "department": user.department,
            "roles": [r.name for r in user.roles],
            "alerts_assigned_total": assigned,
            "alerts_closed_30d": closed,
            "alerts_open": open_alerts,
            "cases_assigned": cases_assigned,
        })

    productivity.sort(key=lambda x: x["alerts_closed_30d"], reverse=True)

    return {
        "report_type": "Analyst Productivity MIS",
        "period": "Last 30 days",
        "analysts": productivity,
    }
