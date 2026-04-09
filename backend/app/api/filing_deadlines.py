"""
Filing Deadline Tracker — Countdown timers for CTR (15 days) and STR (7 days)
with auto-escalation indicators when approaching deadline.
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, Customer, CTRReport, SARReport, Case

router = APIRouter(prefix="/filing-deadlines", tags=["Compliance"])

CTR_DEADLINE_DAYS = 15
STR_DEADLINE_DAYS = 7


def _deadline_status(days_remaining: float) -> str:
    if days_remaining < 0:
        return "overdue"
    if days_remaining <= 2:
        return "critical"
    if days_remaining <= 5:
        return "warning"
    return "on_track"


@router.get("/summary")
def filing_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dashboard summary of all filing deadlines."""
    now = datetime.utcnow()

    # CTR reports
    ctrs = db.query(CTRReport).filter(CTRReport.filing_status != "filed").all()
    ctr_items = []
    for ctr in ctrs:
        deadline = (ctr.created_at or now) + timedelta(days=CTR_DEADLINE_DAYS)
        remaining = (deadline - now).total_seconds() / 86400
        customer = db.query(Customer).filter(Customer.id == ctr.customer_id).first()
        ctr_items.append({
            "id": ctr.id,
            "report_number": ctr.report_number,
            "type": "CTR",
            "customer_name": customer.full_name if customer else "-",
            "customer_id": ctr.customer_id,
            "amount": ctr.transaction_amount or 0,
            "transaction_date": ctr.transaction_date.isoformat() if ctr.transaction_date else None,
            "created_at": ctr.created_at.isoformat() if ctr.created_at else None,
            "deadline": deadline.isoformat(),
            "days_remaining": round(remaining, 1),
            "status": ctr.filing_status,
            "urgency": _deadline_status(remaining),
            "deadline_days": CTR_DEADLINE_DAYS,
        })

    # SAR reports
    sars = db.query(SARReport).filter(SARReport.filing_status != "filed").all()
    sar_items = []
    for sar in sars:
        deadline = (sar.created_at or now) + timedelta(days=STR_DEADLINE_DAYS)
        remaining = (deadline - now).total_seconds() / 86400
        customer = db.query(Customer).filter(Customer.id == sar.customer_id).first()
        case = db.query(Case).filter(Case.id == sar.case_id).first() if sar.case_id else None
        sar_items.append({
            "id": sar.id,
            "report_number": sar.report_number,
            "type": "STR",
            "customer_name": customer.full_name if customer else "-",
            "customer_id": sar.customer_id,
            "amount": sar.total_amount or 0,
            "suspicious_activity_type": sar.suspicious_activity_type,
            "case_number": case.case_number if case else None,
            "created_at": sar.created_at.isoformat() if sar.created_at else None,
            "deadline": deadline.isoformat(),
            "days_remaining": round(remaining, 1),
            "status": sar.filing_status,
            "urgency": _deadline_status(remaining),
            "deadline_days": STR_DEADLINE_DAYS,
        })

    all_items = sorted(ctr_items + sar_items, key=lambda x: x["days_remaining"])

    # Filed reports for stats
    ctrs_filed = db.query(func.count(CTRReport.id)).filter(CTRReport.filing_status == "filed").scalar() or 0
    sars_filed = db.query(func.count(SARReport.id)).filter(SARReport.filing_status == "filed").scalar() or 0

    overdue = [i for i in all_items if i["urgency"] == "overdue"]
    critical = [i for i in all_items if i["urgency"] == "critical"]
    warning = [i for i in all_items if i["urgency"] == "warning"]

    return {
        "pending_filings": all_items,
        "summary": {
            "total_pending": len(all_items),
            "overdue": len(overdue),
            "critical": len(critical),
            "warning": len(warning),
            "on_track": len(all_items) - len(overdue) - len(critical) - len(warning),
            "ctrs_pending": len(ctr_items),
            "sars_pending": len(sar_items),
            "ctrs_filed": ctrs_filed,
            "sars_filed": sars_filed,
            "total_filed": ctrs_filed + sars_filed,
        },
    }
