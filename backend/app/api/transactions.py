import os
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Transaction, Customer, Account, User
from app.schemas.transaction import TransactionResponse, TransactionCreate, TransactionStats

DEBUG = os.getenv("DEBUG", "false").lower() == "true"

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


@router.post("")
def create_transaction(body: TransactionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create a new transaction and run it through the rules engine."""
    from app.services.sms_service import (
        get_threshold_for_customer, generate_otp, hash_otp,
        build_sms_message, send_sms, mask_phone, OTP_EXPIRY_MINUTES,
    )
    from app.models.sms_approval import SMSApproval

    account = db.query(Account).filter(Account.id == body.account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    customer = db.query(Customer).filter(Customer.id == body.customer_id).first()

    now = datetime.utcnow()
    txn = Transaction(
        id=str(uuid.uuid4()),
        transaction_ref=f"TXN{now.strftime('%Y%m%d')}{str(uuid.uuid4())[:8].upper()}",
        account_id=body.account_id,
        customer_id=body.customer_id,
        transaction_type=body.transaction_type,
        transaction_method=body.transaction_method,
        channel=body.channel,
        amount=body.amount,
        balance_after=account.balance + (body.amount if body.transaction_type == "credit" else -body.amount),
        counterparty_account=body.counterparty_account,
        counterparty_name=body.counterparty_name,
        counterparty_bank=body.counterparty_bank,
        counterparty_ifsc=body.counterparty_ifsc,
        description=body.description,
        location_city=body.location_city,
        location_country=body.location_country,
        ip_address=body.ip_address,
        device_id=body.device_id,
        transaction_date=now,
        value_date=now.date(),
        processing_status="completed",
    )
    db.add(txn)
    db.flush()

    # --- SMS Approval gate ---------------------------------------------------
    # Check threshold BEFORE updating account balance.
    # For high_risk customers, threshold is 0 (trigger on every transaction).
    threshold = get_threshold_for_customer(customer) if customer else 5_000_000
    needs_sms = threshold == 0 or body.amount >= threshold

    if needs_sms:
        # Hold the transaction — do NOT update account balance yet
        txn.processing_status = "pending_sms_approval"
        # balance_after was computed optimistically above; reset to current balance
        txn.balance_after = account.balance

        otp = generate_otp()
        otp_hash = hash_otp(otp)
        phone = (customer.phone if customer else None) or "+91-XXXXXXXXXX"
        amount_inr = body.amount / 100.0
        beneficiary = body.counterparty_name or "Beneficiary"
        msg = build_sms_message(otp, amount_inr, beneficiary)
        send_result = send_sms(phone, msg)

        approval = SMSApproval(
            id=str(uuid.uuid4()),
            transaction_id=txn.id,
            transaction_ref=txn.transaction_ref,
            account_id=txn.account_id,
            customer_id=txn.customer_id,
            phone_number=phone,
            amount=txn.amount,
            otp_hash=otp_hash,
            otp_expires_at=now + timedelta(minutes=OTP_EXPIRY_MINUTES),
            status="pending",
            sms_content=msg,
            sms_sent_at=now,
            otp_demo=otp if DEBUG else None,
        )
        db.add(approval)
        db.commit()

        response = {
            "sms_approval_required": True,
            "approval_id": approval.id,
            "message": (
                f"Transaction held pending SMS OTP approval. "
                f"OTP sent to {mask_phone(phone)}. Approve within {OTP_EXPIRY_MINUTES} minutes."
            ),
            "transaction": TransactionResponse(
                id=txn.id, transaction_ref=txn.transaction_ref, account_id=txn.account_id,
                customer_id=txn.customer_id, customer_name=customer.full_name if customer else "",
                account_number=account.account_number, transaction_type=txn.transaction_type,
                transaction_method=txn.transaction_method, channel=txn.channel, amount=txn.amount,
                risk_score=txn.risk_score or 0, is_flagged=txn.is_flagged or False,
                flag_reason=txn.flag_reason, transaction_date=txn.transaction_date,
                processing_status=txn.processing_status, created_at=txn.created_at,
            ),
            "sms_status": send_result.get("status"),
        }
        if DEBUG:
            response["otp_for_demo"] = otp
        return response
    # -------------------------------------------------------------------------

    # Normal path — update account balance immediately
    if body.transaction_type == "credit":
        account.balance += body.amount
    else:
        account.balance -= body.amount

    # Run rules engine
    from app.engine.evaluator import evaluate_transaction
    eval_result = evaluate_transaction(db, txn)

    # Auto-assign any new alerts created
    from app.services.alert_assignment import auto_assign_alerts
    auto_assign_alerts(db, eval_result.get("alert_ids", []))

    db.commit()

    return {
        "transaction": TransactionResponse(
            id=txn.id, transaction_ref=txn.transaction_ref, account_id=txn.account_id,
            customer_id=txn.customer_id, customer_name=customer.full_name if customer else "",
            account_number=account.account_number, transaction_type=txn.transaction_type,
            transaction_method=txn.transaction_method, channel=txn.channel, amount=txn.amount,
            risk_score=txn.risk_score or 0, is_flagged=txn.is_flagged or False,
            flag_reason=txn.flag_reason, transaction_date=txn.transaction_date,
            processing_status=txn.processing_status, created_at=txn.created_at,
        ),
        "rules_engine": eval_result,
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
