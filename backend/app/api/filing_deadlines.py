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
from app.models import User, Customer, CTRReport, SARReport, LVTRReport, Case

router = APIRouter(prefix="/filing-deadlines", tags=["Compliance"])

CTR_DEADLINE_DAYS = 15
STR_DEADLINE_DAYS = 7
LVTR_DEADLINE_DAYS = 7  # RMA Rule 14 — 7 days for LVTR (Bhutan)


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

    # LVTR reports (Bhutan/RMA)
    lvtrs = db.query(LVTRReport).filter(LVTRReport.filing_status != "filed").all()
    lvtr_items = []
    for lvtr in lvtrs:
        deadline = (lvtr.created_at or now) + timedelta(days=LVTR_DEADLINE_DAYS)
        remaining = (deadline - now).total_seconds() / 86400
        customer = db.query(Customer).filter(Customer.id == lvtr.customer_id).first()
        amount_nu = (lvtr.transaction_amount or 0) / 100 * 62.5  # Convert paise to Nu.
        lvtr_items.append({
            "id": lvtr.id,
            "report_number": lvtr.report_number,
            "type": "LVTR",
            "customer_name": customer.full_name if customer else "-",
            "customer_id": lvtr.customer_id,
            "amount": lvtr.transaction_amount or 0,
            "amount_nu": amount_nu,
            "transaction_type": lvtr.transaction_type,
            "created_at": lvtr.created_at.isoformat() if lvtr.created_at else None,
            "deadline": deadline.isoformat(),
            "days_remaining": round(remaining, 1),
            "status": lvtr.filing_status,
            "urgency": _deadline_status(remaining),
            "deadline_days": LVTR_DEADLINE_DAYS,
        })

    all_items = sorted(ctr_items + sar_items + lvtr_items, key=lambda x: x["days_remaining"])

    # Filed reports for stats
    ctrs_filed = db.query(func.count(CTRReport.id)).filter(CTRReport.filing_status == "filed").scalar() or 0
    sars_filed = db.query(func.count(SARReport.id)).filter(SARReport.filing_status == "filed").scalar() or 0
    lvtrs_filed = db.query(func.count(LVTRReport.id)).filter(LVTRReport.filing_status == "filed").scalar() or 0

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
            "lvtrs_pending": len(lvtr_items),
            "ctrs_filed": ctrs_filed,
            "sars_filed": sars_filed,
            "lvtrs_filed": lvtrs_filed,
            "total_filed": ctrs_filed + sars_filed + lvtrs_filed,
        },
    }


# ---------------------------------------------------------------------------
# Helpers shared by breach endpoints
# ---------------------------------------------------------------------------

_REGULATORY_CONSEQUENCE = {
    "CTR": "RBI Master Direction — Penalty up to INR 1 crore per non-filing to FIU-IND",
    "STR": "PMLA Section 13 — Penalty up to INR 1 lakh + imprisonment. Principal Officer liable.",
    "SAR": "PMLA Section 13 — Penalty up to INR 1 lakh + imprisonment. Principal Officer liable.",
    "LVTR": "RMA AML/CFT Rules 2009 — Regulatory censure by FIU-Bhutan",
}

_RECOMMENDED_ACTION = (
    "Immediate submission to FIU-IND. Notify CMLCO within 24 hours."
)


def _breach_severity(days_overdue: float) -> str:
    if days_overdue > 14:
        return "CRITICAL"
    if days_overdue > 7:
        return "HIGH"
    return "MEDIUM"


def _build_breach(item: dict) -> dict:
    days_overdue = round(-item["days_remaining"], 1)
    rtype = item["type"]
    return {
        "id": item["id"],
        "report_number": item["report_number"],
        "type": rtype,
        "customer_name": item["customer_name"],
        "amount": item["amount"],
        "deadline": item["deadline"],
        "days_overdue": days_overdue,
        "urgency": "overdue",
        "escalation_status": "pending",
        "breach_severity": _breach_severity(days_overdue),
        "regulatory_consequence": _REGULATORY_CONSEQUENCE.get(rtype, _REGULATORY_CONSEQUENCE["CTR"]),
        "recommended_action": _RECOMMENDED_ACTION,
    }


def _all_pending_items(db: Session, now: datetime) -> list:
    """Return all pending (unfiled) filings as dicts — same logic as /summary."""
    items: list = []

    for ctr in db.query(CTRReport).filter(CTRReport.filing_status != "filed").all():
        deadline = (ctr.created_at or now) + timedelta(days=CTR_DEADLINE_DAYS)
        remaining = (deadline - now).total_seconds() / 86400
        customer = db.query(Customer).filter(Customer.id == ctr.customer_id).first()
        items.append({
            "id": ctr.id,
            "report_number": ctr.report_number,
            "type": "CTR",
            "customer_name": customer.full_name if customer else "-",
            "amount": ctr.transaction_amount or 0,
            "deadline": deadline.isoformat(),
            "days_remaining": round(remaining, 1),
        })

    for sar in db.query(SARReport).filter(SARReport.filing_status != "filed").all():
        deadline = (sar.created_at or now) + timedelta(days=STR_DEADLINE_DAYS)
        remaining = (deadline - now).total_seconds() / 86400
        customer = db.query(Customer).filter(Customer.id == sar.customer_id).first()
        items.append({
            "id": sar.id,
            "report_number": sar.report_number,
            "type": "STR",
            "customer_name": customer.full_name if customer else "-",
            "amount": sar.total_amount or 0,
            "deadline": deadline.isoformat(),
            "days_remaining": round(remaining, 1),
        })

    for lvtr in db.query(LVTRReport).filter(LVTRReport.filing_status != "filed").all():
        deadline = (lvtr.created_at or now) + timedelta(days=LVTR_DEADLINE_DAYS)
        remaining = (deadline - now).total_seconds() / 86400
        customer = db.query(Customer).filter(Customer.id == lvtr.customer_id).first()
        items.append({
            "id": lvtr.id,
            "report_number": lvtr.report_number,
            "type": "LVTR",
            "customer_name": customer.full_name if customer else "-",
            "amount": lvtr.transaction_amount or 0,
            "deadline": deadline.isoformat(),
            "days_remaining": round(remaining, 1),
        })

    return items


# ---------------------------------------------------------------------------
# Breach endpoints
# ---------------------------------------------------------------------------

@router.get("/breaches")
def get_breaches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all pending filings that have passed their deadline (days_remaining < 0)."""
    now = datetime.utcnow()
    all_items = _all_pending_items(db, now)
    overdue = [_build_breach(item) for item in all_items if item["days_remaining"] < 0]
    overdue.sort(key=lambda x: x["days_overdue"], reverse=True)
    return overdue


@router.get("/breach-summary")
def get_breach_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregate breach statistics for board-level reporting."""
    now = datetime.utcnow()
    all_items = _all_pending_items(db, now)
    breaches = [_build_breach(item) for item in all_items if item["days_remaining"] < 0]

    total = len(breaches)
    critical = sum(1 for b in breaches if b["breach_severity"] == "CRITICAL")
    high = sum(1 for b in breaches if b["breach_severity"] == "HIGH")
    medium = sum(1 for b in breaches if b["breach_severity"] == "MEDIUM")
    total_amount = sum(b["amount"] for b in breaches)
    oldest = max((b["days_overdue"] for b in breaches), default=0)

    if critical > 0:
        regulatory_risk = "CRITICAL"
    elif high > 0:
        regulatory_risk = "HIGH"
    elif medium > 0:
        regulatory_risk = "MEDIUM"
    else:
        regulatory_risk = "NONE"

    return {
        "total_breaches": total,
        "critical_breaches": critical,
        "high_breaches": high,
        "medium_breaches": medium,
        "total_overdue_amount": total_amount,
        "oldest_breach_days": round(oldest, 1),
        "regulatory_risk": regulatory_risk,
    }


@router.post("/breaches/{report_type}/{report_id}/escalate")
def escalate_breach(
    report_type: str,
    report_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
):
    """Simulate escalation of a specific overdue filing to CMLCO or Board."""
    escalated_to = body.get("escalated_to", "CMLCO")
    notes = body.get("notes", "")
    return {
        "status": "escalated",
        "escalated_to": escalated_to,
        "escalated_at": datetime.utcnow().isoformat(),
        "report_type": report_type.upper(),
        "report_id": report_id,
        "notes": notes,
        "message": f"Escalation logged. {escalated_to} notified via system.",
    }
