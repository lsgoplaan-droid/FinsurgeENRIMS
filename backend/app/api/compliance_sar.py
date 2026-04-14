"""
Compliance & SAR — Dedicated compliance module with filing workflows,
regulatory calendar, and compliance dashboard.
"""
import uuid
from datetime import date, datetime, timedelta
from calendar import monthrange
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models import CTRReport, SARReport, LVTRReport, Customer, Case, Transaction, User
from app.utils.pdf_gen import generate_ctr_pdf, generate_sar_pdf, generate_lvtr_pdf


# ── Pydantic request bodies ──────────────────────────────────────────────────

class CTRCreate(BaseModel):
    customer_id: str
    transaction_id: Optional[str] = None
    transaction_amount: int          # paise
    transaction_date: datetime


class CTRUpdate(BaseModel):
    filing_status: Optional[str] = None   # pending_review | filed | amended


class SARCreate(BaseModel):
    customer_id: str
    case_id: Optional[str] = None
    suspicious_activity_type: str
    narrative: Optional[str] = None
    total_amount: int                 # paise
    date_range_start: date
    date_range_end: date
    regulatory_reference: Optional[str] = None


class SARUpdate(BaseModel):
    filing_status: Optional[str] = None
    narrative: Optional[str] = None
    suspicious_activity_type: Optional[str] = None
    regulatory_reference: Optional[str] = None


class LVTRCreate(BaseModel):
    customer_id: str
    transaction_id: Optional[str] = None
    transaction_amount: int           # paise
    transaction_date: datetime
    transaction_type: str             # cash_deposit | cash_withdrawal | transfer


class LVTRUpdate(BaseModel):
    filing_status: Optional[str] = None
    transaction_type: Optional[str] = None

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


@router.post("/filings/ctr/{filing_id}/upload")
def upload_ctr_document(
    filing_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Attach a supporting document to a CTR filing."""
    report = db.query(CTRReport).filter(CTRReport.id == filing_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="CTR filing not found")
    return {
        "status": "uploaded",
        "filing_id": filing_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "uploaded_by": current_user.full_name,
    }


@router.post("/filings/sar/{filing_id}/upload")
def upload_sar_document(
    filing_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Attach a supporting document to a SAR filing."""
    report = db.query(SARReport).filter(SARReport.id == filing_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="SAR filing not found")
    return {
        "status": "uploaded",
        "filing_id": filing_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "uploaded_by": current_user.full_name,
    }


@router.post("/filings/lvtr/{filing_id}/upload")
def upload_lvtr_document(
    filing_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Attach a supporting document to an LVTR filing."""
    report = db.query(LVTRReport).filter(LVTRReport.id == filing_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="LVTR filing not found")
    return {
        "status": "uploaded",
        "filing_id": filing_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "uploaded_by": current_user.full_name,
    }


# ═══════════════════════════════════════════════════════════════
# CTR CRUD
# ═══════════════════════════════════════════════════════════════

@router.post("/filings/ctr", status_code=201)
def create_ctr(body: CTRCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Manually create a new CTR filing."""
    customer = db.query(Customer).filter(Customer.id == body.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    today = datetime.utcnow()
    seq = db.query(func.count(CTRReport.id)).scalar() + 1
    report_number = f"CTR-{today.strftime('%Y%m%d')}-{seq:04d}"

    report = CTRReport(
        id=str(uuid.uuid4()),
        report_number=report_number,
        customer_id=body.customer_id,
        transaction_id=body.transaction_id,
        transaction_amount=body.transaction_amount,
        transaction_date=body.transaction_date,
        filing_status="pending_review",
        filed_by=current_user.id,
        created_at=today,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {
        "id": report.id,
        "report_number": report.report_number,
        "filing_status": report.filing_status,
        "customer_name": customer.full_name,
        "transaction_amount": report.transaction_amount,
        "created_at": report.created_at,
    }


@router.put("/filings/ctr/{filing_id}")
def update_ctr(filing_id: str, body: CTRUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update CTR status (pending_review → filed / amended)."""
    report = db.query(CTRReport).filter(CTRReport.id == filing_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="CTR not found")
    if body.filing_status:
        report.filing_status = body.filing_status
        if body.filing_status == "filed":
            report.filed_at = datetime.utcnow()
            report.filed_by = current_user.id
    db.commit()
    return {"id": report.id, "report_number": report.report_number, "filing_status": report.filing_status, "filed_at": report.filed_at}


@router.post("/filings/ctr/{filing_id}/submit")
def submit_ctr(filing_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Mark a CTR as officially filed with FIU-IND."""
    report = db.query(CTRReport).filter(CTRReport.id == filing_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="CTR not found")
    if report.filing_status == "filed":
        raise HTTPException(status_code=400, detail="CTR is already filed")
    report.filing_status = "filed"
    report.filed_at = datetime.utcnow()
    report.filed_by = current_user.id
    db.commit()
    return {"status": "filed", "report_number": report.report_number, "filed_at": report.filed_at, "filed_by": current_user.full_name}


@router.delete("/filings/ctr/{filing_id}", status_code=200)
def delete_ctr(filing_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete a CTR filing (only allowed if not yet filed; requires compliance or admin role)."""
    user_roles = {r.name for r in current_user.roles} if current_user.roles else set()
    if not user_roles.intersection({"compliance_officer", "admin", "cro"}):
        raise HTTPException(status_code=403, detail="Only compliance officers and admins can delete filings")
    report = db.query(CTRReport).filter(CTRReport.id == filing_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="CTR not found")
    if report.filing_status == "filed":
        raise HTTPException(status_code=400, detail="Cannot delete a filed CTR. Use 'amended' status instead.")
    db.delete(report)
    db.commit()
    return {"deleted": True, "report_number": report.report_number}


# ═══════════════════════════════════════════════════════════════
# SAR CRUD
# ═══════════════════════════════════════════════════════════════

@router.post("/filings/sar", status_code=201)
def create_sar(body: SARCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Manually create a new SAR filing."""
    customer = db.query(Customer).filter(Customer.id == body.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if body.case_id:
        case = db.query(Case).filter(Case.id == body.case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Case not found")

    today = datetime.utcnow()
    seq = db.query(func.count(SARReport.id)).scalar() + 1
    report_number = f"SAR-{today.strftime('%Y%m%d')}-{seq:04d}"

    report = SARReport(
        id=str(uuid.uuid4()),
        report_number=report_number,
        customer_id=body.customer_id,
        case_id=body.case_id,
        suspicious_activity_type=body.suspicious_activity_type,
        narrative=body.narrative,
        total_amount=body.total_amount,
        date_range_start=body.date_range_start,
        date_range_end=body.date_range_end,
        filing_status="draft",
        regulatory_reference=body.regulatory_reference or "PMLA Section 12 / RBI Master Direction",
        filed_by=current_user.id,
        created_at=today,
        updated_at=today,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {
        "id": report.id,
        "report_number": report.report_number,
        "filing_status": report.filing_status,
        "customer_name": customer.full_name,
        "total_amount": report.total_amount,
        "created_at": report.created_at,
    }


@router.put("/filings/sar/{filing_id}")
def update_sar(filing_id: str, body: SARUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update SAR details or status."""
    report = db.query(SARReport).filter(SARReport.id == filing_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="SAR not found")
    if body.filing_status:
        report.filing_status = body.filing_status
        if body.filing_status == "filed":
            report.filed_at = datetime.utcnow()
            report.filed_by = current_user.id
    if body.narrative is not None:
        report.narrative = body.narrative
    if body.suspicious_activity_type is not None:
        report.suspicious_activity_type = body.suspicious_activity_type
    if body.regulatory_reference is not None:
        report.regulatory_reference = body.regulatory_reference
    report.updated_at = datetime.utcnow()
    db.commit()
    return {"id": report.id, "report_number": report.report_number, "filing_status": report.filing_status, "updated_at": report.updated_at}


@router.post("/filings/sar/{filing_id}/submit")
def submit_sar(filing_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Mark a SAR as officially filed with FIU-IND."""
    report = db.query(SARReport).filter(SARReport.id == filing_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="SAR not found")
    if report.filing_status == "filed":
        raise HTTPException(status_code=400, detail="SAR is already filed")
    report.filing_status = "filed"
    report.filed_at = datetime.utcnow()
    report.filed_by = current_user.id
    report.updated_at = datetime.utcnow()
    db.commit()
    return {"status": "filed", "report_number": report.report_number, "filed_at": report.filed_at, "filed_by": current_user.full_name}


@router.delete("/filings/sar/{filing_id}", status_code=200)
def delete_sar(filing_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete a SAR filing (only allowed if not yet filed; requires compliance or admin role)."""
    user_roles = {r.name for r in current_user.roles} if current_user.roles else set()
    if not user_roles.intersection({"compliance_officer", "admin", "cro"}):
        raise HTTPException(status_code=403, detail="Only compliance officers and admins can delete filings")
    report = db.query(SARReport).filter(SARReport.id == filing_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="SAR not found")
    if report.filing_status == "filed":
        raise HTTPException(status_code=400, detail="Cannot delete a filed SAR. Use 'amended' status instead.")
    db.delete(report)
    db.commit()
    return {"deleted": True, "report_number": report.report_number}


# ═══════════════════════════════════════════════════════════════
# LVTR CRUD
# ═══════════════════════════════════════════════════════════════

@router.post("/lvtr", status_code=201)
def create_lvtr(body: LVTRCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Manually create a new LVTR filing."""
    customer = db.query(Customer).filter(Customer.id == body.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    today = datetime.utcnow()
    seq = db.query(func.count(LVTRReport.id)).scalar() + 1
    report_number = f"LVTR-{today.strftime('%Y%m%d')}-{seq:04d}"

    report = LVTRReport(
        id=str(uuid.uuid4()),
        report_number=report_number,
        customer_id=body.customer_id,
        transaction_id=body.transaction_id,
        transaction_amount=body.transaction_amount,
        transaction_date=body.transaction_date,
        transaction_type=body.transaction_type,
        reporting_threshold=10000000,
        filing_status="pending_review",
        filed_by=current_user.id,
        created_at=today,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {
        "id": report.id,
        "report_number": report.report_number,
        "filing_status": report.filing_status,
        "customer_name": customer.full_name,
        "transaction_amount": report.transaction_amount,
        "created_at": report.created_at,
    }


@router.put("/lvtr/{filing_id}")
def update_lvtr(filing_id: str, body: LVTRUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update LVTR status or transaction type."""
    report = db.query(LVTRReport).filter(LVTRReport.id == filing_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="LVTR not found")
    if body.filing_status:
        report.filing_status = body.filing_status
        if body.filing_status == "filed":
            report.filed_at = datetime.utcnow()
            report.filed_by = current_user.id
    if body.transaction_type is not None:
        report.transaction_type = body.transaction_type
    db.commit()
    return {"id": report.id, "report_number": report.report_number, "filing_status": report.filing_status}


@router.post("/filings/lvtr/{filing_id}/submit")
def submit_lvtr(filing_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Mark an LVTR as officially filed with FIU-Bhutan."""
    report = db.query(LVTRReport).filter(LVTRReport.id == filing_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="LVTR not found")
    if report.filing_status == "filed":
        raise HTTPException(status_code=400, detail="LVTR is already filed")
    report.filing_status = "filed"
    report.filed_at = datetime.utcnow()
    report.filed_by = current_user.id
    db.commit()
    return {"status": "filed", "report_number": report.report_number, "filed_at": report.filed_at, "filed_by": current_user.full_name}


@router.delete("/lvtr/{filing_id}", status_code=200)
def delete_lvtr(filing_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete an LVTR filing (only allowed if not yet filed; requires compliance or admin role)."""
    user_roles = {r.name for r in current_user.roles} if current_user.roles else set()
    if not user_roles.intersection({"compliance_officer", "admin", "cro"}):
        raise HTTPException(status_code=403, detail="Only compliance officers and admins can delete filings")
    report = db.query(LVTRReport).filter(LVTRReport.id == filing_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="LVTR not found")
    if report.filing_status == "filed":
        raise HTTPException(status_code=400, detail="Cannot delete a filed LVTR. Use 'amended' status instead.")
    db.delete(report)
    db.commit()
    return {"deleted": True, "report_number": report.report_number}


# ═══════════════════════════════════════════════════════════════
# GoAML XML GENERATION
# ═══════════════════════════════════════════════════════════════

def _xml_escape(value: str) -> str:
    """Escape special XML characters in text content."""
    if not value:
        return ""
    return (
        str(value)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


@router.get("/goaml-sample")
def goaml_sample(current_user: User = Depends(get_current_user)):
    """Return hardcoded sample GoAML XML for both SAR/STR and CTR — used by the integrations page."""
    today_str = date.today().isoformat()

    sar_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Report xmlns="urn:goAML:reporting:3.5" ReportType="STR" ReportDate="{today_str}" ReportingSequence="1">
  <Header>
    <ReportingEntityCode>FINSURGE001</ReportingEntityCode>
    <InstitutionName>FinsurgeFRIMS Demo Bank</InstitutionName>
    <ReportingPeriodStart>2026-03-01</ReportingPeriodStart>
    <ReportingPeriodEnd>2026-03-31</ReportingPeriodEnd>
    <BranchCode>MUM-001</BranchCode>
    <PrincipalOfficer>Sunita Krishnan</PrincipalOfficer>
    <FilingDate>{today_str}</FilingDate>
  </Header>
  <STReport>
    <ReportNumber>SAR-20260401-0042</ReportNumber>
    <STRType>ML</STRType>
    <SuspicionDeterminedDate>2026-03-15</SuspicionDeterminedDate>
    <Subject>
      <SubjectType>I</SubjectType>
      <Name>Rajesh Mehta</Name>
      <CustomerID>CIF-1001</CustomerID>
      <PAN>ABCPM1234R</PAN>
      <Nationality>IN</Nationality>
      <Address>Mumbai, Maharashtra, India</Address>
    </Subject>
    <SuspiciousActivity>
      <ActivityType>structuring</ActivityType>
      <AmountINR>4850000.00</AmountINR>
      <Currency>INR</Currency>
      <Narrative>Multiple cash deposits structured just below the CTR threshold of INR 10 lakh detected over 14 days. Pattern consistent with smurfing/structuring under PMLA 2002.</Narrative>
      <PMPLASection>Section 12</PMPLASection>
    </SuspiciousActivity>
    <FilingStatus>filed</FilingStatus>
    <RegulatoryReference>PMLA 2002, Section 12; RBI Master Direction on KYC</RegulatoryReference>
  </STReport>
</Report>"""

    ctr_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Report xmlns="urn:goAML:reporting:3.5" ReportType="CTR" ReportDate="{today_str}">
  <Header>
    <ReportingEntityCode>FINSURGE001</ReportingEntityCode>
    <InstitutionName>FinsurgeFRIMS Demo Bank</InstitutionName>
    <BranchCode>MUM-001</BranchCode>
    <PrincipalOfficer>Sunita Krishnan</PrincipalOfficer>
    <FilingDate>{today_str}</FilingDate>
  </Header>
  <CTReport>
    <ReportNumber>CTR-20260401-0118</ReportNumber>
    <TransactionDate>2026-03-28</TransactionDate>
    <Subject>
      <Name>Hassan Trading Co.</Name>
      <CustomerID>CIF-1003</CustomerID>
      <PAN>AABCH5432P</PAN>
    </Subject>
    <Transaction>
      <Amount>1250000.00</Amount>
      <Currency>INR</Currency>
      <ThresholdAmount>1000000.00</ThresholdAmount>
      <TransactionType>CASH</TransactionType>
    </Transaction>
    <PMPLASection>Section 12; RBI Master Direction on KYC</PMPLASection>
    <FilingStatus>filed</FilingStatus>
  </CTReport>
</Report>"""

    return {"sar_xml": sar_xml, "ctr_xml": ctr_xml}


@router.get("/filings/sar/{report_id}/goaml-xml")
def get_sar_goaml_xml(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return GoAML-compliant XML for a SAR/STR filing."""
    rec = db.query(SARReport).filter(SARReport.id == report_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="SAR not found")

    customer = db.query(Customer).filter(Customer.id == rec.customer_id).first() if rec.customer_id else None
    today_str = date.today().isoformat()
    filed_at_str = rec.filed_at.strftime("%Y-%m-%d") if rec.filed_at else today_str
    created_at_str = rec.created_at.strftime("%Y-%m-%d") if rec.created_at else today_str
    date_range_start = str(rec.date_range_start) if rec.date_range_start else today_str
    date_range_end = str(rec.date_range_end) if rec.date_range_end else today_str
    amount_inr = f"{(rec.total_amount or 0) / 100:.2f}"
    narrative = _xml_escape(rec.narrative or "Suspicious activity detected by AML system")
    activity_type = _xml_escape(rec.suspicious_activity_type or "unknown")
    regulatory_ref = _xml_escape(rec.regulatory_reference or "PMLA 2002, Section 12; RBI Master Direction on KYC")
    filing_status = _xml_escape(rec.filing_status or "draft")
    report_number = _xml_escape(rec.report_number or "")

    customer_name = _xml_escape(customer.full_name if customer else "Unknown")
    customer_number = _xml_escape(customer.customer_number if customer else "")
    pan = _xml_escape(customer.pan_number if customer and customer.pan_number else "")
    nationality = _xml_escape(customer.nationality if customer and customer.nationality else "IN")
    address = _xml_escape(
        f"{customer.city or ''}, {customer.state or ''}, India".strip(", ")
        if customer else "India"
    )
    subject_type = "E" if (customer and getattr(customer, "customer_type", "individual") == "corporate") else "I"

    xml_str = f"""<?xml version="1.0" encoding="UTF-8"?>
<Report xmlns="urn:goAML:reporting:3.5" ReportType="STR" ReportDate="{today_str}" ReportingSequence="1">
  <Header>
    <ReportingEntityCode>FINSURGE001</ReportingEntityCode>
    <InstitutionName>FinsurgeFRIMS Demo Bank</InstitutionName>
    <ReportingPeriodStart>{date_range_start}</ReportingPeriodStart>
    <ReportingPeriodEnd>{date_range_end}</ReportingPeriodEnd>
    <BranchCode>MUM-001</BranchCode>
    <PrincipalOfficer>Sunita Krishnan</PrincipalOfficer>
    <FilingDate>{filed_at_str}</FilingDate>
  </Header>
  <STReport>
    <ReportNumber>{report_number}</ReportNumber>
    <STRType>ML</STRType>
    <SuspicionDeterminedDate>{created_at_str}</SuspicionDeterminedDate>
    <Subject>
      <SubjectType>{subject_type}</SubjectType>
      <Name>{customer_name}</Name>
      <CustomerID>{customer_number}</CustomerID>
      <PAN>{pan}</PAN>
      <Nationality>{nationality}</Nationality>
      <Address>{address}</Address>
    </Subject>
    <SuspiciousActivity>
      <ActivityType>{activity_type}</ActivityType>
      <AmountINR>{amount_inr}</AmountINR>
      <Currency>INR</Currency>
      <Narrative>{narrative}</Narrative>
      <PMPLASection>Section 12</PMPLASection>
    </SuspiciousActivity>
    <FilingStatus>{filing_status}</FilingStatus>
    <RegulatoryReference>{regulatory_ref}</RegulatoryReference>
  </STReport>
</Report>"""

    filename = f"{rec.report_number}-goaml.xml"
    return Response(
        content=xml_str,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/filings/ctr/{report_id}/goaml-xml")
def get_ctr_goaml_xml(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return GoAML-compliant XML for a CTR filing."""
    rec = db.query(CTRReport).filter(CTRReport.id == report_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="CTR not found")

    customer = db.query(Customer).filter(Customer.id == rec.customer_id).first() if rec.customer_id else None
    today_str = date.today().isoformat()
    filed_at_str = rec.filed_at.strftime("%Y-%m-%d") if rec.filed_at else today_str
    transaction_date_str = rec.transaction_date.strftime("%Y-%m-%d") if rec.transaction_date else today_str
    amount_inr = f"{(rec.transaction_amount or 0) / 100:.2f}"
    filing_status = _xml_escape(rec.filing_status or "pending_review")
    report_number = _xml_escape(rec.report_number or "")

    customer_name = _xml_escape(customer.full_name if customer else "Unknown")
    customer_number = _xml_escape(customer.customer_number if customer else "")
    pan = _xml_escape(customer.pan_number if customer and customer.pan_number else "")

    xml_str = f"""<?xml version="1.0" encoding="UTF-8"?>
<Report xmlns="urn:goAML:reporting:3.5" ReportType="CTR" ReportDate="{today_str}">
  <Header>
    <ReportingEntityCode>FINSURGE001</ReportingEntityCode>
    <InstitutionName>FinsurgeFRIMS Demo Bank</InstitutionName>
    <BranchCode>MUM-001</BranchCode>
    <PrincipalOfficer>Sunita Krishnan</PrincipalOfficer>
    <FilingDate>{filed_at_str}</FilingDate>
  </Header>
  <CTReport>
    <ReportNumber>{report_number}</ReportNumber>
    <TransactionDate>{transaction_date_str}</TransactionDate>
    <Subject>
      <Name>{customer_name}</Name>
      <CustomerID>{customer_number}</CustomerID>
      <PAN>{pan}</PAN>
    </Subject>
    <Transaction>
      <Amount>{amount_inr}</Amount>
      <Currency>INR</Currency>
      <ThresholdAmount>1000000.00</ThresholdAmount>
      <TransactionType>CASH</TransactionType>
    </Transaction>
    <PMPLASection>Section 12; RBI Master Direction on KYC</PMPLASection>
    <FilingStatus>{filing_status}</FilingStatus>
  </CTReport>
</Report>"""

    filename = f"{rec.report_number}-goaml.xml"
    return Response(
        content=xml_str,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
