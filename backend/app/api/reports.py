from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models import CTRReport, SARReport, Customer, User

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/ctr")
def list_ctr_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    filing_status: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(CTRReport)
    if filing_status:
        query = query.filter(CTRReport.filing_status == filing_status)

    total = query.count()
    reports = query.order_by(CTRReport.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for r in reports:
        customer = db.query(Customer).filter(Customer.id == r.customer_id).first()
        items.append({
            "id": r.id,
            "report_number": r.report_number,
            "customer_id": r.customer_id,
            "customer_name": customer.full_name if customer else "",
            "transaction_amount": r.transaction_amount,
            "transaction_date": r.transaction_date.isoformat() if r.transaction_date else None,
            "filing_status": r.filing_status,
            "filed_at": r.filed_at.isoformat() if r.filed_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/sar")
def list_sar_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    filing_status: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(SARReport)
    if filing_status:
        query = query.filter(SARReport.filing_status == filing_status)

    total = query.count()
    reports = query.order_by(SARReport.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for r in reports:
        customer = db.query(Customer).filter(Customer.id == r.customer_id).first()
        items.append({
            "id": r.id,
            "report_number": r.report_number,
            "case_id": r.case_id,
            "customer_id": r.customer_id,
            "customer_name": customer.full_name if customer else "",
            "suspicious_activity_type": r.suspicious_activity_type,
            "narrative": r.narrative,
            "total_amount": r.total_amount,
            "date_range_start": str(r.date_range_start) if r.date_range_start else None,
            "date_range_end": str(r.date_range_end) if r.date_range_end else None,
            "filing_status": r.filing_status,
            "regulatory_reference": r.regulatory_reference,
            "filed_at": r.filed_at.isoformat() if r.filed_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}
