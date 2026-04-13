"""
Compliance & SAR — Dedicated compliance module with filing workflows,
regulatory calendar, and compliance dashboard.
"""
from datetime import date, datetime, timedelta
from calendar import monthrange
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models import CTRReport, SARReport, LVTRReport, Customer, Case, User
from app.utils.pdf_gen import generate_ctr_pdf, generate_sar_pdf, generate_lvtr_pdf

router = APIRouter(prefix="/compliance", tags=["Compliance & SAR"])


def _next_occurrence(today: date, day_of_month: int, frequency: str) -> date:
    """Calculate the next occurrence of a recurring deadline."""
    if frequency == "daily":
        return today + timedelta(days=1)
    if frequency == "weekly":
        days_ahead = 7 - today.weekday()  # Next Monday
        return today + timedelta(days=days_ahead if days_ahead > 0 else 7)
    if frequency == "monthly":
        year, month = today.year, today.month
        target_day = min(day_of_month, monthrange(year, month)[1])
        target = date(year, month, target_day)
        if target <= today:
            month += 1
            if month > 12:
                month, year = 1, year + 1
            target_day = min(day_of_month, monthrange(year, month)[1])
            target = date(year, month, target_day)
        return target
    if frequency == "quarterly":
        quarter_months = [3, 6, 9, 12]
        for qm in quarter_months:
            year = today.year
            target_day = min(day_of_month, monthrange(year, qm)[1])
            target = date(year, qm, target_day)
            if target > today:
                return target
        return date(today.year + 1, 3, min(day_of_month, monthrange(today.year + 1, 3)[1]))
    if frequency == "semi_annual":
        for m in [6, 12]:
            year = today.year
            target_day = min(day_of_month, monthrange(year, m)[1])
            target = date(year, m, target_day)
            if target > today:
                return target
        return date(today.year + 1, 6, min(day_of_month, monthrange(today.year + 1, 6)[1]))
    if frequency == "annual":
        target = date(today.year, 3, 31)  # RBI fiscal year end
        if target <= today:
            target = date(today.year + 1, 3, 31)
        return target
    return today + timedelta(days=30)


# RBI / PMLA regulatory deadlines with fixed recurrence rules
REGULATORY_DEADLINES = [
    {"name": "CTR Monthly Filing to FIU-IND", "owner": "Compliance", "frequency": "monthly", "day": 15, "priority": "high",
     "description": "Cash Transaction Reports for transactions >10 lakh INR — RBI Master Direction on KYC"},
    {"name": "PMLA Principal Officer Report", "owner": "Principal Officer", "frequency": "monthly", "day": 20, "priority": "critical",
     "description": "Principal Officer monthly report to FIU-IND under PMLA Section 12"},
    {"name": "STR Filing to FIU-IND", "owner": "Compliance", "frequency": "monthly", "day": 7, "priority": "critical",
     "description": "Suspicious Transaction Reports within 7 days of detection — PMLA Rules 2005"},
    {"name": "OFAC SDN List Update", "owner": "Compliance", "frequency": "daily", "day": 1, "priority": "high",
     "description": "Screen against updated OFAC Specially Designated Nationals list"},
    {"name": "UN Sanctions List Update", "owner": "Compliance", "frequency": "weekly", "day": 1, "priority": "high",
     "description": "Update UN Security Council consolidated sanctions list"},
    {"name": "KYC Periodic Review — High Risk", "owner": "KYC Team", "frequency": "quarterly", "day": 30, "priority": "high",
     "description": "Re-verify KYC for high-risk customers per RBI Master Direction"},
    {"name": "KYC Periodic Review — Medium Risk", "owner": "KYC Team", "frequency": "semi_annual", "day": 30, "priority": "medium",
     "description": "Re-verify KYC for medium-risk customers"},
    {"name": "Board AML/CFT Report", "owner": "Compliance Head", "frequency": "quarterly", "day": 15, "priority": "medium",
     "description": "Quarterly AML/CFT compliance report to Board of Directors"},
    {"name": "Internal Audit — AML Controls", "owner": "Internal Audit", "frequency": "quarterly", "day": 25, "priority": "medium",
     "description": "Quarterly internal audit of AML/CFT controls effectiveness"},
    {"name": "PEP List Review", "owner": "Compliance", "frequency": "quarterly", "day": 10, "priority": "high",
     "description": "Review and update Politically Exposed Persons database"},
    {"name": "RBI Annual Fraud Return", "owner": "Compliance", "frequency": "annual", "day": 31, "priority": "high",
     "description": "Annual fraud return submission to RBI — due by March 31"},
    {"name": "Risk Assessment Update", "owner": "Risk Team", "frequency": "annual", "day": 31, "priority": "medium",
     "description": "Annual institution-wide AML/CFT risk assessment update"},
]


@router.get("/dashboard")
def compliance_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Compliance dashboard — filing status, deadlines, regulatory metrics."""
    today = date.today()

    ctr_pending = db.query(func.count(CTRReport.id)).filter(CTRReport.filing_status.in_(["auto_generated", "pending_review"])).scalar() or 0
    ctr_filed = db.query(func.count(CTRReport.id)).filter(CTRReport.filing_status == "filed").scalar() or 0
    sar_pending = db.query(func.count(SARReport.id)).filter(SARReport.filing_status.in_(["draft", "pending_review"])).scalar() or 0
    sar_filed = db.query(func.count(SARReport.id)).filter(SARReport.filing_status == "filed").scalar() or 0
    lvtr_pending = db.query(func.count(LVTRReport.id)).filter(LVTRReport.filing_status.in_(["auto_generated", "pending_review"])).scalar() or 0
    lvtr_filed = db.query(func.count(LVTRReport.id)).filter(LVTRReport.filing_status == "filed").scalar() or 0

    expired_kyc = db.query(func.count(Customer.id)).filter(Customer.kyc_status == "expired").scalar() or 0
    pep_customers = db.query(func.count(Customer.id)).filter(Customer.pep_status == True).scalar() or 0

    open_investigations = db.query(func.count(Case.id)).filter(
        ~Case.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"])
    ).scalar() or 0

    # Build deadlines from deterministic schedule
    deadlines = []
    for item in REGULATORY_DEADLINES:
        next_due = _next_occurrence(today, item["day"], item["frequency"])
        days_until = (next_due - today).days
        if days_until < 0:
            status = "overdue"
        elif days_until <= 3:
            status = "due_soon"
        elif days_until <= 14:
            status = "upcoming"
        else:
            status = "scheduled"

        deadlines.append({
            "name": item["name"],
            "owner": item["owner"],
            "frequency": item["frequency"],
            "due_date": next_due.isoformat(),
            "next_due": next_due.isoformat(),
            "days_until_due": days_until,
            "priority": item["priority"],
            "status": status,
            "description": item["description"],
        })

    deadlines.sort(key=lambda x: x["days_until_due"])

    # Recent filings from actual DB data
    recent_ctrs = (
        db.query(CTRReport)
        .order_by(CTRReport.created_at.desc())
        .limit(5)
        .all()
    )
    recent_sars = (
        db.query(SARReport)
        .order_by(SARReport.created_at.desc())
        .limit(3)
        .all()
    )

    recent_filings = []
    for r in recent_ctrs:
        customer = db.query(Customer).filter(Customer.id == r.customer_id).first() if r.customer_id else None
        recent_filings.append({
            "id": r.id,
            "type": "CTR",
            "report_number": r.report_number,
            "customer": customer.full_name if customer else "-",
            "amount": r.transaction_amount or 0,
            "filed_date": r.filed_at.strftime("%Y-%m-%d") if r.filed_at else (r.created_at.strftime("%Y-%m-%d") if r.created_at else "-"),
            "status": r.filing_status or "pending",
        })
    for r in recent_sars:
        customer = db.query(Customer).filter(Customer.id == r.customer_id).first() if r.customer_id else None
        recent_filings.append({
            "id": r.id,
            "type": "SAR",
            "report_number": r.report_number,
            "customer": customer.full_name if customer else "-",
            "amount": r.total_amount or 0,
            "filed_date": r.filed_at.strftime("%Y-%m-%d") if r.filed_at else (r.created_at.strftime("%Y-%m-%d") if r.created_at else "-"),
            "status": r.filing_status or "pending",
        })

    recent_filings.sort(key=lambda x: x["filed_date"], reverse=True)

    return {
        "filing_status": {
            "ctr_pending": ctr_pending,
            "ctr_filed": ctr_filed,
            "sar_pending": sar_pending,
            "sar_filed": sar_filed,
            "lvtr_pending": lvtr_pending,
            "lvtr_filed": lvtr_filed,
        },
        "compliance_metrics": {
            "expired_kyc_customers": expired_kyc,
            "pep_customers": pep_customers,
            "open_investigations": open_investigations,
        },
        "regulatory_deadlines": deadlines,
        "recent_filings": recent_filings,
    }


@router.get("/filings/{filing_type}/{filing_id}/download")
def download_filing(
    filing_type: str,
    filing_id: str,
    format: str = Query("rbi", pattern="^(rbi|rma)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download a CTR, SAR, or LVTR filing as a PDF.

    `filing_type` must be 'ctr', 'sar', or 'lvtr'.
    `format` must be 'rbi' (India/FIU-IND) or 'rma' (Bhutan/FIU-Bhutan).
    Returns a PDF in the specified regulatory format.
    """
    filing_type = filing_type.lower()
    if filing_type not in ("ctr", "sar", "lvtr"):
        raise HTTPException(status_code=400, detail="filing_type must be 'ctr', 'sar', or 'lvtr'")

    if filing_type == "ctr":
        rec = db.query(CTRReport).filter(CTRReport.id == filing_id).first()
    elif filing_type == "sar":
        rec = db.query(SARReport).filter(SARReport.id == filing_id).first()
    else:
        rec = db.query(LVTRReport).filter(LVTRReport.id == filing_id).first()

    if not rec:
        raise HTTPException(status_code=404, detail=f"{filing_type.upper()} not found")

    customer = db.query(Customer).filter(Customer.id == rec.customer_id).first() if rec.customer_id else None
    nu_per_inr = 62.5
    now_str = datetime.utcnow().strftime("%d-%b-%Y %H:%M UTC")

    if filing_type == "ctr":
        amount_inr = (rec.transaction_amount or 0) / 100
        pdf_data = generate_ctr_pdf({
            "report_number": rec.report_number,
            "filing_status": rec.filing_status or "pending",
            "filed_at": rec.filed_at.strftime("%d-%b-%Y") if rec.filed_at else None,
            "created_at": rec.created_at.strftime("%d-%b-%Y %H:%M UTC") if rec.created_at else "-",
            "generated": now_str,
            "customer_name": customer.full_name if customer else "-",
            "customer_number": customer.customer_number if customer else "-",
            "customer_type": customer.customer_type if customer else "Individual",
            "pan": customer.pan_number if customer and customer.pan_number else "Not on file",
            "address_india": f"{customer.city if customer else '-'}, {customer.state if customer else '-'}, India",
            "address_bhutan": f"{customer.city if customer else '-'}, Bhutan",
            "amount_inr": amount_inr,
            "amount_nu": amount_inr * nu_per_inr,
            "transaction_date": rec.transaction_date.strftime("%d-%b-%Y") if rec.transaction_date else "-",
            "downloaded_by": current_user.full_name,
            "download_time": now_str,
        }, format)

    elif filing_type == "sar":
        amount_inr = (rec.total_amount or 0) / 100
        pdf_data = generate_sar_pdf({
            "report_number": rec.report_number,
            "filing_status": rec.filing_status or "pending",
            "filed_at": rec.filed_at.strftime("%d-%b-%Y") if rec.filed_at else None,
            "generated": now_str,
            "customer_name": customer.full_name if customer else "-",
            "customer_number": customer.customer_number if customer else "-",
            "customer_type": customer.customer_type if customer else "-",
            "pep": bool(customer and customer.pep_status),
            "risk_score": customer.risk_score if customer else "-",
            "pan": customer.pan_number if customer and customer.pan_number else "Not on file",
            "address_bhutan": f"{customer.city if customer else '-'}, Bhutan",
            "amount_inr": amount_inr,
            "amount_nu": amount_inr * nu_per_inr,
            "activity_type": getattr(rec, "suspicious_activity_type", "-") or "-",
            "date_from": str(getattr(rec, "date_range_start", "-")),
            "date_to": str(getattr(rec, "date_range_end", "-")),
            "narrative": getattr(rec, "narrative", None) or getattr(rec, "description", None) or "See linked case file.",
            "downloaded_by": current_user.full_name,
            "download_time": now_str,
        }, format)

    else:  # lvtr — RMA only
        amount_inr = (rec.transaction_amount or 0) / 100
        pdf_data = generate_lvtr_pdf({
            "report_number": rec.report_number,
            "filing_status": rec.filing_status or "pending",
            "filed_at": rec.filed_at.strftime("%d-%b-%Y") if rec.filed_at else None,
            "generated": now_str,
            "customer_name": customer.full_name if customer else "-",
            "customer_number": customer.customer_number if customer else "-",
            "customer_type": customer.customer_type if customer else "Individual",
            "pep": bool(customer and customer.pep_status),
            "transaction_type": (rec.transaction_type or "Transfer").replace("_", " ").title(),
            "amount_inr": amount_inr,
            "amount_nu": amount_inr * nu_per_inr,
            "transaction_date": rec.transaction_date.strftime("%d-%b-%Y") if rec.transaction_date else "-",
            "downloaded_by": current_user.full_name,
            "download_time": now_str,
        })

    fmt_suffix = format.upper()
    filename = f"{rec.report_number}-{fmt_suffix}.pdf"
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/lvtr")
def list_lvtr_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    filing_status: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List LVTR (Large Value Transaction Reports) for Bhutan/RMA."""
    query = db.query(LVTRReport)
    if filing_status:
        query = query.filter(LVTRReport.filing_status == filing_status)

    total = query.count()
    reports = query.order_by(LVTRReport.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for r in reports:
        customer = db.query(Customer).filter(Customer.id == r.customer_id).first() if r.customer_id else None
        amount_nu = (r.transaction_amount or 0) / 100 * 62.5  # Convert paise to Nu.
        items.append({
            "id": r.id,
            "report_number": r.report_number,
            "customer_id": r.customer_id,
            "customer_name": customer.full_name if customer else "",
            "transaction_amount": r.transaction_amount,
            "transaction_amount_nu": amount_nu,
            "transaction_date": r.transaction_date.isoformat() if r.transaction_date else None,
            "transaction_type": r.transaction_type,
            "filing_status": r.filing_status,
            "filed_at": r.filed_at.isoformat() if r.filed_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}
@router.get("/filings/ctr")
def list_ctr_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    filing_status: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List CTR (Currency Transaction Reports)."""
    query = db.query(CTRReport)
    if filing_status:
        query = query.filter(CTRReport.filing_status == filing_status)

    total = query.count()
    reports = query.order_by(CTRReport.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for r in reports:
        customer = db.query(Customer).filter(Customer.id == r.customer_id).first() if r.customer_id else None
        amount_inr = (r.transaction_amount or 0) / 100
        items.append({
            "id": r.id,
            "report_number": r.report_number,
            "customer_id": r.customer_id,
            "customer_name": customer.full_name if customer else "",
            "transaction_amount": r.transaction_amount,
            "amount_inr": amount_inr,
            "transaction_date": r.transaction_date.isoformat() if r.transaction_date else None,
            "filing_status": r.filing_status,
            "filed_at": r.filed_at.isoformat() if r.filed_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/filings/sar")
def list_sar_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    filing_status: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List SAR (Suspicious Activity Reports)."""
    query = db.query(SARReport)
    if filing_status:
        query = query.filter(SARReport.filing_status == filing_status)

    total = query.count()
    reports = query.order_by(SARReport.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for r in reports:
        customer = db.query(Customer).filter(Customer.id == r.customer_id).first() if r.customer_id else None
        case = db.query(Case).filter(Case.id == r.case_id).first() if r.case_id else None
        amount_inr = (r.total_amount or 0) / 100
        items.append({
            "id": r.id,
            "report_number": r.report_number,
            "customer_id": r.customer_id,
            "customer_name": customer.full_name if customer else "",
            "case_id": r.case_id,
            "case_number": case.case_number if case else "",
            "amount": r.total_amount,
            "amount_inr": amount_inr,
            "suspicious_activity_type": r.suspicious_activity_type,
            "filing_status": r.filing_status,
            "filed_at": r.filed_at.isoformat() if r.filed_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/filings/ctr/{filing_id}")
def get_ctr_detail(
    filing_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get CTR filing details."""
    rec = db.query(CTRReport).filter(CTRReport.id == filing_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="CTR not found")

    customer = db.query(Customer).filter(Customer.id == rec.customer_id).first() if rec.customer_id else None
    amount_inr = (rec.transaction_amount or 0) / 100

    return {
        "id": rec.id,
        "report_number": rec.report_number,
        "customer_id": rec.customer_id,
        "customer_name": customer.full_name if customer else "",
        "customer_number": customer.customer_number if customer else "",
        "pan": customer.pan_number if customer and customer.pan_number else "Not on file",
        "amount": rec.transaction_amount,
        "amount_inr": amount_inr,
        "transaction_date": rec.transaction_date.isoformat() if rec.transaction_date else None,
        "filing_status": rec.filing_status,
        "filed_at": rec.filed_at.isoformat() if rec.filed_at else None,
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
    }


@router.get("/filings/sar/{filing_id}")
def get_sar_detail(
    filing_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get SAR filing details."""
    rec = db.query(SARReport).filter(SARReport.id == filing_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="SAR not found")

    customer = db.query(Customer).filter(Customer.id == rec.customer_id).first() if rec.customer_id else None
    case = db.query(Case).filter(Case.id == rec.case_id).first() if rec.case_id else None
    amount_inr = (rec.total_amount or 0) / 100

    return {
        "id": rec.id,
        "report_number": rec.report_number,
        "customer_id": rec.customer_id,
        "customer_name": customer.full_name if customer else "",
        "customer_number": customer.customer_number if customer else "",
        "case_id": rec.case_id,
        "case_number": case.case_number if case else "",
        "amount": rec.total_amount,
        "amount_inr": amount_inr,
        "suspicious_activity_type": rec.suspicious_activity_type,
        "description": rec.description,
        "filing_status": rec.filing_status,
        "filed_at": rec.filed_at.isoformat() if rec.filed_at else None,
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
    }


@router.get("/filings/lvtr/{filing_id}")
def get_lvtr_detail(
    filing_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get LVTR filing details."""
    rec = db.query(LVTRReport).filter(LVTRReport.id == filing_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="LVTR not found")

    customer = db.query(Customer).filter(Customer.id == rec.customer_id).first() if rec.customer_id else None
    amount_nu = (rec.transaction_amount or 0) / 100 * 62.5
    amount_inr = (rec.transaction_amount or 0) / 100

    return {
        "id": rec.id,
        "report_number": rec.report_number,
        "customer_id": rec.customer_id,
        "customer_name": customer.full_name if customer else "",
        "customer_number": customer.customer_number if customer else "",
        "amount": rec.transaction_amount,
        "amount_nu": amount_nu,
        "amount_inr": amount_inr,
        "transaction_date": rec.transaction_date.isoformat() if rec.transaction_date else None,
        "transaction_type": rec.transaction_type,
        "filing_status": rec.filing_status,
        "filed_at": rec.filed_at.isoformat() if rec.filed_at else None,
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
    }


@router.get("/regulatory-calendar")
def regulatory_calendar(current_user: User = Depends(get_current_user)):
    """Upcoming regulatory deadlines and compliance calendar."""
    today = date.today()

    calendar = []
    for item in REGULATORY_DEADLINES:
        next_due = _next_occurrence(today, item["day"], item["frequency"])
        days_until = (next_due - today).days

        calendar.append({
            "name": item["name"],
            "owner": item["owner"],
            "frequency": item["frequency"],
            "priority": item["priority"],
            "next_due": next_due.isoformat(),
            "days_until_due": days_until,
            "status": "overdue" if days_until < 0 else "due_soon" if days_until <= 3 else "upcoming",
            "description": item["description"],
        })

    calendar.sort(key=lambda x: x["days_until_due"])

    return {"calendar": calendar, "total": len(calendar)}
