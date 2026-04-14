from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Customer, User
from app.models.ubo import UBORecord

router = APIRouter(prefix="/ubo", tags=["UBO / Beneficial Owners"])


class UBOCreateRequest(BaseModel):
    ubo_name: str
    ownership_percentage: float
    nationality: str = "IN"
    date_of_birth: Optional[str] = None   # ISO date string YYYY-MM-DD
    id_type: str = "pan"
    id_number: Optional[str] = None
    relationship_type: str = "shareholder"


class UBOUpdateRequest(BaseModel):
    ubo_name: Optional[str] = None
    ownership_percentage: Optional[float] = None
    nationality: Optional[str] = None
    date_of_birth: Optional[str] = None
    id_type: Optional[str] = None
    id_number: Optional[str] = None
    relationship_type: Optional[str] = None


def _serialize(r: UBORecord) -> dict:
    return {
        "id": r.id,
        "customer_id": r.customer_id,
        "ubo_name": r.ubo_name,
        "ownership_percentage": r.ownership_percentage,
        "nationality": r.nationality,
        "date_of_birth": str(r.date_of_birth) if r.date_of_birth else None,
        "id_type": r.id_type,
        "id_number": r.id_number,
        "relationship_type": r.relationship_type,
        "verified": r.verified,
        "verified_at": r.verified_at.isoformat() if r.verified_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def _get_customer_or_404(customer_id: str, db: Session) -> Customer:
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


def _get_ubo_or_404(customer_id: str, ubo_id: str, db: Session) -> UBORecord:
    record = db.query(UBORecord).filter(
        UBORecord.id == ubo_id,
        UBORecord.customer_id == customer_id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="UBO record not found")
    return record


@router.get("/{customer_id}")
def list_ubo_records(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_customer_or_404(customer_id, db)
    records = (
        db.query(UBORecord)
        .filter(UBORecord.customer_id == customer_id)
        .order_by(UBORecord.ownership_percentage.desc())
        .all()
    )
    return [_serialize(r) for r in records]


@router.post("/{customer_id}", status_code=201)
def create_ubo_record(
    customer_id: str,
    body: UBOCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_customer_or_404(customer_id, db)

    dob = None
    if body.date_of_birth:
        from datetime import date
        dob = date.fromisoformat(body.date_of_birth)

    record = UBORecord(
        customer_id=customer_id,
        ubo_name=body.ubo_name,
        ownership_percentage=body.ownership_percentage,
        nationality=body.nationality,
        date_of_birth=dob,
        id_type=body.id_type,
        id_number=body.id_number,
        relationship_type=body.relationship_type,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _serialize(record)


@router.put("/{customer_id}/{ubo_id}")
def update_ubo_record(
    customer_id: str,
    ubo_id: str,
    body: UBOUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = _get_ubo_or_404(customer_id, ubo_id, db)

    if body.ubo_name is not None:
        record.ubo_name = body.ubo_name
    if body.ownership_percentage is not None:
        record.ownership_percentage = body.ownership_percentage
    if body.nationality is not None:
        record.nationality = body.nationality
    if body.date_of_birth is not None:
        from datetime import date
        record.date_of_birth = date.fromisoformat(body.date_of_birth)
    if body.id_type is not None:
        record.id_type = body.id_type
    if body.id_number is not None:
        record.id_number = body.id_number
    if body.relationship_type is not None:
        record.relationship_type = body.relationship_type

    db.commit()
    db.refresh(record)
    return _serialize(record)


@router.delete("/{customer_id}/{ubo_id}", status_code=204)
def delete_ubo_record(
    customer_id: str,
    ubo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = _get_ubo_or_404(customer_id, ubo_id, db)
    db.delete(record)
    db.commit()


@router.post("/{customer_id}/{ubo_id}/verify")
def verify_ubo_record(
    customer_id: str,
    ubo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    record = _get_ubo_or_404(customer_id, ubo_id, db)
    record.verified = True
    record.verified_at = datetime.utcnow()
    db.commit()
    db.refresh(record)
    return _serialize(record)
