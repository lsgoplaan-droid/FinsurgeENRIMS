import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Transaction, Customer, Account, User
from app.schemas.transaction import TransactionResponse, TransactionCreate, TransactionStats

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get("")
def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    channel: str = Query(None),
    transaction_method: str = Query(None),
    min_amount: int = Query(None),
    max_amount: int = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
    customer_id: str = Query(None),
    account_id: str = Query(None),
    is_flagged: bool = Query(None),
    risk_score_min: float = Query(None),
    search: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Transaction)

    if channel:
        query = query.filter(Transaction.channel == channel)
    if transaction_method:
        query = query.filter(Transaction.transaction_method == transaction_method)
    if min_amount is not None:
        query = query.filter(Transaction.amount >= min_amount)
    if max_amount is not None:
        query = query.filter(Transaction.amount <= max_amount)
    if date_from:
        query = query.filter(Transaction.transaction_date >= date_from)
    if date_to:
        query = query.filter(Transaction.transaction_date <= date_to)
    if customer_id:
        query = query.filter(Transaction.customer_id == customer_id)
    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    if is_flagged is not None:
        query = query.filter(Transaction.is_flagged == is_flagged)
    if risk_score_min is not None:
        query = query.filter(Transaction.risk_score >= risk_score_min)
    if search:
        query = query.filter(
            or_(
                Transaction.transaction_ref.ilike(f"%{search}%"),
                Transaction.description.ilike(f"%{search}%"),
                Transaction.counterparty_name.ilike(f"%{search}%"),
            )
        )

    total = query.count()
    transactions = query.order_by(Transaction.transaction_date.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for t in transactions:
        customer = db.query(Customer).filter(Customer.id == t.customer_id).first()
        account = db.query(Account).filter(Account.id == t.account_id).first()
        items.append(
            TransactionResponse(
                id=t.id,
                transaction_ref=t.transaction_ref,
                account_id=t.account_id,
                customer_id=t.customer_id,
                customer_name=customer.full_name if customer else "",
                account_number=account.account_number if account else "",
                transaction_type=t.transaction_type,
                transaction_method=t.transaction_method,
                channel=t.channel,
                amount=t.amount,
                currency=t.currency,
                balance_after=t.balance_after,
                counterparty_name=t.counterparty_name,
                counterparty_account=t.counterparty_account,
                counterparty_bank=t.counterparty_bank,
                description=t.description,
                location_city=t.location_city,
                location_country=t.location_country,
                risk_score=t.risk_score or 0,
                is_flagged=t.is_flagged or False,
                flag_reason=t.flag_reason,
                transaction_date=t.transaction_date,
                processing_status=t.processing_status or "completed",
                created_at=t.created_at,
            )
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/stats")
def get_transaction_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    total_count = db.query(func.count(Transaction.id)).scalar() or 0
    total_amount = db.query(func.sum(Transaction.amount)).scalar() or 0
    flagged_count = db.query(func.count(Transaction.id)).filter(Transaction.is_flagged == True).scalar() or 0

    by_channel = dict(
        db.query(Transaction.channel, func.count(Transaction.id))
        .group_by(Transaction.channel)
        .all()
    )
    by_method = dict(
        db.query(Transaction.transaction_method, func.count(Transaction.id))
        .group_by(Transaction.transaction_method)
        .all()
    )

    return TransactionStats(
        total_count=total_count,
        total_amount=total_amount,
        flagged_count=flagged_count,
        by_channel=by_channel,
        by_method=by_method,
    )


@router.get("/{transaction_id}")
def get_transaction(transaction_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    t = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")

    customer = db.query(Customer).filter(Customer.id == t.customer_id).first()
    account = db.query(Account).filter(Account.id == t.account_id).first()

    return TransactionResponse(
        id=t.id,
        transaction_ref=t.transaction_ref,
        account_id=t.account_id,
        customer_id=t.customer_id,
        customer_name=customer.full_name if customer else "",
        account_number=account.account_number if account else "",
        transaction_type=t.transaction_type,
        transaction_method=t.transaction_method,
        channel=t.channel,
        amount=t.amount,
        currency=t.currency,
        balance_after=t.balance_after,
        counterparty_name=t.counterparty_name,
        counterparty_account=t.counterparty_account,
        counterparty_bank=t.counterparty_bank,
        description=t.description,
        location_city=t.location_city,
        location_country=t.location_country,
        risk_score=t.risk_score or 0,
        is_flagged=t.is_flagged or False,
        flag_reason=t.flag_reason,
        transaction_date=t.transaction_date,
        processing_status=t.processing_status or "completed",
        created_at=t.created_at,
    )
