from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Customer, Account, Transaction, Alert, Case, User
from app.schemas.customer import CustomerResponse, Customer360Response

router = APIRouter(prefix="/customers", tags=["Customers"])


def _customer_to_response(c: Customer, db: Session) -> CustomerResponse:
    return CustomerResponse(
        id=c.id,
        customer_number=c.customer_number,
        customer_type=c.customer_type,
        first_name=c.first_name,
        last_name=c.last_name,
        company_name=c.company_name,
        display_name=c.full_name,
        full_name=c.full_name,
        date_of_birth=c.date_of_birth,
        gender=c.gender,
        nationality=c.nationality,
        pan_number=c.pan_number,
        email=c.email,
        phone=c.phone,
        city=c.city,
        state=c.state,
        country=c.country,
        occupation=c.occupation,
        employer=c.employer,
        annual_income=c.annual_income,
        source_of_funds=c.source_of_funds,
        risk_category=c.risk_category,
        risk_score=c.risk_score or 0,
        pep_status=c.pep_status or False,
        kyc_status=c.kyc_status or "pending",
        kyc_expiry_date=c.kyc_expiry_date,
        onboarding_date=c.onboarding_date,
        is_active=c.is_active,
        account_count=db.query(func.count(Account.id)).filter(Account.customer_id == c.id).scalar() or 0,
        alert_count=db.query(func.count(Alert.id)).filter(Alert.customer_id == c.id).scalar() or 0,
        case_count=db.query(func.count(Case.id)).filter(Case.customer_id == c.id).scalar() or 0,
        created_at=c.created_at,
    )


@router.get("")
def list_customers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str = Query(None),
    risk_category: str = Query(None),
    kyc_status: str = Query(None),
    customer_type: str = Query(None),
    state: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Customer).filter(Customer.is_active == True)

    if search:
        query = query.filter(
            or_(
                Customer.first_name.ilike(f"%{search}%"),
                Customer.last_name.ilike(f"%{search}%"),
                Customer.company_name.ilike(f"%{search}%"),
                Customer.customer_number.ilike(f"%{search}%"),
                Customer.pan_number.ilike(f"%{search}%"),
                Customer.phone.ilike(f"%{search}%"),
            )
        )
    if risk_category:
        # Support comma-separated values for risk_category
        # Also map "high" to include both "high" and "very_high"
        if "," in risk_category:
            categories = [c.strip() for c in risk_category.split(",") if c.strip()]
            query = query.filter(Customer.risk_category.in_(categories))
        elif risk_category == "high":
            # Dashboard uses "high" to mean both high and very_high
            query = query.filter(Customer.risk_category.in_(["high", "very_high"]))
        else:
            query = query.filter(Customer.risk_category == risk_category)
    if kyc_status:
        query = query.filter(Customer.kyc_status == kyc_status)
    if customer_type:
        query = query.filter(Customer.customer_type == customer_type)
    if state:
        query = query.filter(Customer.state == state)

    total = query.count()
    customers = query.order_by(Customer.risk_score.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [_customer_to_response(c, db) for c in customers],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/{customer_id}")
def get_customer(customer_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return _customer_to_response(c, db)


@router.get("/{customer_id}/360")
def get_customer_360(customer_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Customer).filter(Customer.id == customer_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")

    accounts = db.query(Account).filter(Account.customer_id == customer_id).all()
    transactions = (
        db.query(Transaction)
        .filter(Transaction.customer_id == customer_id)
        .order_by(Transaction.transaction_date.desc())
        .limit(50)
        .all()
    )
    alerts = (
        db.query(Alert)
        .filter(Alert.customer_id == customer_id)
        .order_by(Alert.created_at.desc())
        .limit(20)
        .all()
    )
    cases = db.query(Case).filter(Case.customer_id == customer_id).order_by(Case.created_at.desc()).all()

    # Channel usage
    channel_counts = (
        db.query(Transaction.channel, func.count(Transaction.id))
        .filter(Transaction.customer_id == customer_id)
        .group_by(Transaction.channel)
        .all()
    )

    return Customer360Response(
        customer=_customer_to_response(c, db),
        accounts=[
            {
                "id": a.id,
                "account_number": a.account_number,
                "account_type": a.account_type,
                "balance": a.balance,
                "status": a.status,
                "currency": a.currency,
                "branch_code": a.branch_code,
                "opened_date": str(a.opened_date) if a.opened_date else None,
            }
            for a in accounts
        ],
        recent_transactions=[
            {
                "id": t.id,
                "transaction_ref": t.transaction_ref,
                "transaction_type": t.transaction_type,
                "transaction_method": t.transaction_method,
                "channel": t.channel,
                "amount": t.amount,
                "risk_score": t.risk_score,
                "is_flagged": t.is_flagged,
                "transaction_date": t.transaction_date.isoformat() if t.transaction_date else None,
                "description": t.description,
                "counterparty_name": t.counterparty_name,
            }
            for t in transactions
        ],
        alerts=[
            {
                "id": a.id,
                "alert_number": a.alert_number,
                "title": a.title,
                "alert_type": a.alert_type,
                "priority": a.priority,
                "status": a.status,
                "risk_score": a.risk_score,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in alerts
        ],
        cases=[
            {
                "id": cs.id,
                "case_number": cs.case_number,
                "title": cs.title,
                "case_type": cs.case_type,
                "priority": cs.priority,
                "status": cs.status,
                "created_at": cs.created_at.isoformat() if cs.created_at else None,
            }
            for cs in cases
        ],
        channel_usage={ch: cnt for ch, cnt in channel_counts},
    )


@router.get("/{customer_id}/transactions")
def get_customer_transactions(
    customer_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Transaction).filter(Transaction.customer_id == customer_id)
    total = query.count()
    txns = query.order_by(Transaction.transaction_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
            {
                "id": t.id,
                "transaction_ref": t.transaction_ref,
                "transaction_type": t.transaction_type,
                "transaction_method": t.transaction_method,
                "channel": t.channel,
                "amount": t.amount,
                "risk_score": t.risk_score,
                "is_flagged": t.is_flagged,
                "transaction_date": t.transaction_date.isoformat() if t.transaction_date else None,
                "counterparty_name": t.counterparty_name,
                "description": t.description,
                "location_city": t.location_city,
            }
            for t in txns
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
