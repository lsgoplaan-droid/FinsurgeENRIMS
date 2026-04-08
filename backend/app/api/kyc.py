from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models import KYCReview, KYCDocument, ScreeningResult, Customer, User

router = APIRouter(prefix="/kyc", tags=["KYC / CDD"])


@router.get("/reviews")
def list_reviews(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    review_type: str = Query(None),
    risk_assessment: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(KYCReview)
    if status:
        query = query.filter(KYCReview.status == status)
    if review_type:
        query = query.filter(KYCReview.review_type == review_type)
    if risk_assessment:
        query = query.filter(KYCReview.risk_assessment == risk_assessment)

    total = query.count()
    reviews = query.order_by(KYCReview.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for r in reviews:
        customer = db.query(Customer).filter(Customer.id == r.customer_id).first()
        reviewer = db.query(User).filter(User.id == r.reviewer_id).first() if r.reviewer_id else None
        items.append({
            "id": r.id,
            "customer_id": r.customer_id,
            "customer_name": customer.full_name if customer else "",
            "customer_number": customer.customer_number if customer else "",
            "review_type": r.review_type,
            "risk_assessment": r.risk_assessment,
            "previous_risk": r.previous_risk,
            "status": r.status,
            "reviewer_name": reviewer.full_name if reviewer else None,
            "due_date": str(r.due_date) if r.due_date else None,
            "completed_date": str(r.completed_date) if r.completed_date else None,
            "findings": r.findings,
            "edd_required": r.edd_required,
            "next_review_date": str(r.next_review_date) if r.next_review_date else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/reviews/{review_id}")
def get_review(review_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    r = db.query(KYCReview).filter(KYCReview.id == review_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Review not found")
    customer = db.query(Customer).filter(Customer.id == r.customer_id).first()
    docs = db.query(KYCDocument).filter(KYCDocument.customer_id == r.customer_id).all()
    screenings = db.query(ScreeningResult).filter(ScreeningResult.customer_id == r.customer_id).all()

    return {
        "review": {
            "id": r.id, "customer_id": r.customer_id, "review_type": r.review_type,
            "risk_assessment": r.risk_assessment, "status": r.status, "findings": r.findings,
            "edd_required": r.edd_required, "edd_reason": r.edd_reason,
            "due_date": str(r.due_date) if r.due_date else None,
        },
        "customer": {"id": customer.id, "name": customer.full_name, "customer_number": customer.customer_number, "risk_category": customer.risk_category, "pep_status": customer.pep_status} if customer else None,
        "documents": [
            {"id": d.id, "document_type": d.document_type, "document_number": d.document_number, "verified": d.verified, "expiry_date": str(d.expiry_date) if d.expiry_date else None}
            for d in docs
        ],
        "screenings": [
            {"id": s.id, "screening_type": s.screening_type, "source": s.source, "match_found": s.match_found, "match_score": s.match_score, "matched_name": s.matched_name, "status": s.status}
            for s in screenings
        ],
    }


@router.post("/reviews/{review_id}/approve")
def approve_review(review_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    r = db.query(KYCReview).filter(KYCReview.id == review_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Review not found")
    r.status = "approved"
    r.reviewer_id = current_user.id
    r.completed_date = datetime.utcnow().date()

    customer = db.query(Customer).filter(Customer.id == r.customer_id).first()
    if customer:
        customer.kyc_status = "approved"

    db.commit()
    return {"status": "approved"}


@router.post("/reviews/{review_id}/reject")
def reject_review(review_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    r = db.query(KYCReview).filter(KYCReview.id == review_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Review not found")
    r.status = "rejected"
    r.reviewer_id = current_user.id
    r.completed_date = datetime.utcnow().date()

    customer = db.query(Customer).filter(Customer.id == r.customer_id).first()
    if customer:
        customer.kyc_status = "rejected"

    db.commit()
    return {"status": "rejected"}


@router.get("/screening/{customer_id}")
def get_screenings(customer_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    results = db.query(ScreeningResult).filter(ScreeningResult.customer_id == customer_id).order_by(ScreeningResult.created_at.desc()).all()
    return [
        {
            "id": s.id, "screening_type": s.screening_type, "source": s.source,
            "match_found": s.match_found, "match_score": s.match_score,
            "matched_name": s.matched_name, "status": s.status,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
        for s in results
    ]
