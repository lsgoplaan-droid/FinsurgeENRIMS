"""
SMS Transaction Approval API

Design intent:
  - SMS OTP is sent to the CUSTOMER's phone.  The customer approves on their device.
  - FRIMS is a MONITORING screen — operators watch status, resend OTPs if needed.
  - For very high value transactions (>= INR 10 lakh) a FRIMS User must also give a
    second-level approval AFTER the customer's OTP is verified.

Endpoints:
  GET  /sms-approvals                  — list (filterable by status)
  GET  /sms-approvals/stats            — counts by status + total held
  GET  /sms-approvals/{id}             — single record detail
  POST /sms-approvals/{id}/verify      — (customer-side) verify OTP → approve
  POST /sms-approvals/{id}/reject      — (customer-side) reject transaction
  POST /sms-approvals/{id}/frims-approve — FRIMS second-level approval (very high value)
  POST /sms-approvals/{id}/frims-reject  — FRIMS second-level rejection
  POST /sms-approvals/resend/{id}      — resend OTP (FRIMS triggered, new OTP)
  POST /sms-approvals/expire-check     — mark expired records (on-demand / scheduled)
"""
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Transaction, Account, Customer, User
from app.models.sms_approval import SMSApproval
from app.services.sms_service import (
    MAX_ATTEMPTS,
    OTP_EXPIRY_MINUTES,
    build_sms_message,
    generate_otp,
    hash_otp,
    mask_phone,
    send_sms,
    verify_otp,
)

router = APIRouter(prefix="/sms-approvals", tags=["SMS Approvals"])

DEBUG = os.getenv("DEBUG", "false").lower() == "true"

# Transactions at or above this amount (in paise) require a FRIMS second-level approval
# INR 10,00,000 = ₹10 lakh
FRIMS_APPROVAL_THRESHOLD_PAISE = 1_000_000_00


# ---------------------------------------------------------------------------
# Pydantic request bodies
# ---------------------------------------------------------------------------

class VerifyOTPBody(BaseModel):
    otp: str


class RejectBody(BaseModel):
    reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _approval_dict(approval: SMSApproval, include_demo_otp: bool = False) -> dict:
    data = {
        "id": approval.id,
        "transaction_id": approval.transaction_id,
        "transaction_ref": approval.transaction_ref,
        "account_id": approval.account_id,
        "customer_id": approval.customer_id,
        "phone_number": mask_phone(approval.phone_number),
        "amount": approval.amount,
        "status": approval.status,
        "attempts": approval.attempts,
        "sms_content": approval.sms_content,
        "sms_sent_at": approval.sms_sent_at.isoformat() if approval.sms_sent_at else None,
        "otp_expires_at": approval.otp_expires_at.isoformat() if approval.otp_expires_at else None,
        "resolved_at": approval.resolved_at.isoformat() if approval.resolved_at else None,
        "resolved_by": approval.resolved_by,
        "rejection_reason": approval.rejection_reason,
        "created_at": approval.created_at.isoformat() if approval.created_at else None,
        # FRIMS approval fields — for TXN >= INR 10L, FRIMS approves directly on web
        "frims_approval_required": bool(approval.frims_approval_required),
        "frims_approval_status": approval.frims_approval_status,
        "frims_approved_by": approval.frims_approved_by,
        "frims_approved_at": approval.frims_approved_at.isoformat() if approval.frims_approved_at else None,
        "frims_rejection_reason": approval.frims_rejection_reason,
        # True when FRIMS can act: high-value, customer OTP pending OR approved, no FRIMS decision yet
        "awaiting_frims_approval": (
            bool(approval.frims_approval_required)
            and approval.status in ("pending", "approved")
            and approval.frims_approval_status in (None, "pending")
        ),
    }
    if include_demo_otp and approval.otp_demo:
        data["otp_demo"] = approval.otp_demo
    return data


def _mark_expired(db: Session) -> int:
    """Mark all pending approvals whose OTP has expired. Returns count updated."""
    now = datetime.utcnow()
    expired = (
        db.query(SMSApproval)
        .filter(SMSApproval.status == "pending", SMSApproval.otp_expires_at < now)
        .all()
    )
    for rec in expired:
        rec.status = "expired"
        rec.resolved_at = now
    if expired:
        db.commit()
    return len(expired)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return counts by status and total amount held in pending approvals."""
    _mark_expired(db)  # refresh expired records on stats fetch

    rows = (
        db.query(SMSApproval.status, func.count(SMSApproval.id), func.sum(SMSApproval.amount))
        .group_by(SMSApproval.status)
        .all()
    )

    counts = {"pending": 0, "approved": 0, "rejected": 0, "expired": 0}
    amounts = {"pending": 0, "approved": 0, "rejected": 0, "expired": 0}

    for status, cnt, total in rows:
        if status in counts:
            counts[status] = cnt
            amounts[status] = total or 0

    # Count how many are awaiting FRIMS second-level approval
    frims_pending = (
        db.query(func.count(SMSApproval.id))
        .filter(
            SMSApproval.frims_approval_required == True,
            SMSApproval.status == "approved",
            SMSApproval.frims_approval_status.in_([None, "pending"]),
        )
        .scalar()
        or 0
    )

    return {
        "counts": counts,
        "amounts": amounts,
        "total_held_paise": amounts.get("pending", 0),
        "total_held_inr": round(amounts.get("pending", 0) / 100, 2),
        "frims_pending_approval": frims_pending,
        "frims_threshold_inr": FRIMS_APPROVAL_THRESHOLD_PAISE / 100,
    }


@router.get("")
def list_approvals(
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List SMS approvals, optionally filtered by status."""
    _mark_expired(db)

    query = db.query(SMSApproval)
    if status:
        query = query.filter(SMSApproval.status == status)

    total = query.count()
    records = (
        query.order_by(SMSApproval.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Enrich with customer name
    items = []
    for rec in records:
        d = _approval_dict(rec, include_demo_otp=DEBUG)
        customer = db.query(Customer).filter(Customer.id == rec.customer_id).first()
        d["customer_name"] = customer.full_name if customer else ""
        items.append(d)

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/{approval_id}")
def get_approval(
    approval_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch a single SMS approval record."""
    rec = db.query(SMSApproval).filter(SMSApproval.id == approval_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="SMS approval not found")

    # Auto-expire if needed
    if rec.status == "pending" and rec.otp_expires_at < datetime.utcnow():
        rec.status = "expired"
        rec.resolved_at = datetime.utcnow()
        db.commit()
        db.refresh(rec)

    d = _approval_dict(rec, include_demo_otp=DEBUG)
    customer = db.query(Customer).filter(Customer.id == rec.customer_id).first()
    d["customer_name"] = customer.full_name if customer else ""
    return d


@router.post("/{approval_id}/verify")
def verify_approval(
    approval_id: str,
    body: VerifyOTPBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Verify OTP for an SMS approval.

    On success:
      - approval.status = 'approved'
      - transaction.processing_status = 'completed'
      - Account balance is updated (debit or credit applied)
    """
    rec = db.query(SMSApproval).filter(SMSApproval.id == approval_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="SMS approval not found")

    if rec.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Approval is already '{rec.status}'. Only pending approvals can be verified.",
        )

    now = datetime.utcnow()

    # Auto-expire check
    if rec.otp_expires_at < now:
        rec.status = "expired"
        rec.resolved_at = now
        db.commit()
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new OTP.")

    # Increment attempt counter first
    rec.attempts += 1

    if not verify_otp(body.otp.strip(), rec.otp_hash):
        db.commit()  # save the incremented attempt
        remaining = max(0, MAX_ATTEMPTS - rec.attempts)
        if rec.attempts >= MAX_ATTEMPTS:
            rec.status = "expired"
            rec.resolved_at = now
            db.commit()
            raise HTTPException(
                status_code=400,
                detail="Maximum OTP attempts exceeded. Approval has been invalidated.",
            )
        raise HTTPException(
            status_code=400,
            detail=f"Invalid OTP. {remaining} attempt(s) remaining.",
        )

    # OTP is correct — approve
    rec.status = "approved"
    rec.resolved_at = now
    rec.resolved_by = current_user.username

    # Update transaction status and apply balance change
    if rec.transaction_id:
        txn = db.query(Transaction).filter(Transaction.id == rec.transaction_id).first()
        if txn:
            txn.processing_status = "completed"
            account = db.query(Account).filter(Account.id == txn.account_id).first()
            if account:
                if txn.transaction_type == "credit":
                    account.balance += txn.amount
                else:
                    account.balance -= txn.amount
                txn.balance_after = account.balance

    db.commit()

    return {
        "success": True,
        "message": "OTP verified. Transaction approved and processed.",
        "approval_id": rec.id,
        "status": rec.status,
    }


@router.post("/{approval_id}/reject")
def reject_approval(
    approval_id: str,
    body: RejectBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Reject a pending SMS approval.

    On rejection:
      - approval.status = 'rejected'
      - transaction.processing_status = 'reversed'
    """
    rec = db.query(SMSApproval).filter(SMSApproval.id == approval_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="SMS approval not found")

    if rec.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Approval is already '{rec.status}'. Only pending approvals can be rejected.",
        )

    now = datetime.utcnow()
    rec.status = "rejected"
    rec.resolved_at = now
    rec.resolved_by = current_user.username
    rec.rejection_reason = body.reason or "Rejected by user"

    if rec.transaction_id:
        txn = db.query(Transaction).filter(Transaction.id == rec.transaction_id).first()
        if txn:
            txn.processing_status = "reversed"

    db.commit()

    return {
        "success": True,
        "message": "Transaction rejected.",
        "approval_id": rec.id,
        "status": rec.status,
    }


class FRIMSRejectBody(BaseModel):
    reason: str


@router.post("/{approval_id}/frims-approve")
def frims_approve(
    approval_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    FRIMS second-level approval for very high value transactions (>= INR 10 lakh).
    Only available after the customer's OTP has been verified (status == 'approved').
    """
    rec = db.query(SMSApproval).filter(SMSApproval.id == approval_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="SMS approval not found")
    if not rec.frims_approval_required:
        raise HTTPException(status_code=400, detail="This transaction does not require FRIMS approval.")
    if rec.status not in ("pending", "approved"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve — transaction is '{rec.status}'."
        )
    if rec.frims_approval_status == "approved":
        raise HTTPException(status_code=400, detail="FRIMS approval has already been granted.")
    if rec.frims_approval_status == "rejected":
        raise HTTPException(status_code=400, detail="FRIMS approval was already rejected.")

    rec.frims_approval_status = "approved"
    rec.frims_approved_by = current_user.username
    rec.frims_approved_at = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "message": f"FRIMS second-level approval granted by {current_user.full_name}.",
        "approval_id": rec.id,
        "frims_approval_status": rec.frims_approval_status,
        "frims_approved_by": rec.frims_approved_by,
        "frims_approved_at": rec.frims_approved_at,
    }


@router.post("/{approval_id}/frims-reject")
def frims_reject(
    approval_id: str,
    body: FRIMSRejectBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    FRIMS second-level rejection. Overrides the customer's OTP approval and reverses the transaction.
    Requires a reason.
    """
    rec = db.query(SMSApproval).filter(SMSApproval.id == approval_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="SMS approval not found")
    if not rec.frims_approval_required:
        raise HTTPException(status_code=400, detail="This transaction does not require FRIMS approval.")
    if rec.status not in ("pending", "approved"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject — transaction is '{rec.status}'."
        )
    if rec.frims_approval_status in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail=f"FRIMS approval is already '{rec.frims_approval_status}'.")

    now = datetime.utcnow()
    rec.frims_approval_status = "rejected"
    rec.frims_approved_by = current_user.username
    rec.frims_approved_at = now
    rec.frims_rejection_reason = body.reason
    # Mark the approval itself as rejected and close it out
    rec.status = "rejected"
    rec.resolved_at = now
    rec.resolved_by = current_user.username
    rec.rejection_reason = body.reason

    # Reverse/cancel the transaction if linked
    if rec.transaction_id:
        txn = db.query(Transaction).filter(Transaction.id == rec.transaction_id).first()
        if txn:
            txn.processing_status = "reversed"

    db.commit()

    return {
        "success": True,
        "message": f"FRIMS rejection recorded by {current_user.full_name}. Transaction reversed.",
        "approval_id": rec.id,
        "frims_approval_status": rec.frims_approval_status,
        "frims_rejection_reason": rec.frims_rejection_reason,
    }


@router.post("/resend/{approval_id}")
def resend_otp(
    approval_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Resend OTP for a pending approval.

    Generates a fresh OTP, resets expiry, resets attempt counter, and re-sends SMS.
    """
    rec = db.query(SMSApproval).filter(SMSApproval.id == approval_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="SMS approval not found")

    if rec.status not in ("pending", "expired"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot resend OTP for a '{rec.status}' approval.",
        )

    from datetime import timedelta

    customer = db.query(Customer).filter(Customer.id == rec.customer_id).first()
    txn = db.query(Transaction).filter(Transaction.id == rec.transaction_id).first() if rec.transaction_id else None
    beneficiary = (txn.counterparty_name if txn else None) or "Beneficiary"
    amount_inr = rec.amount / 100.0

    otp = generate_otp()
    otp_hash = hash_otp(otp)
    now = datetime.utcnow()
    msg = build_sms_message(otp, amount_inr, beneficiary)
    send_result = send_sms(rec.phone_number, msg)

    rec.otp_hash = otp_hash
    rec.otp_expires_at = now + timedelta(minutes=OTP_EXPIRY_MINUTES)
    rec.attempts = 0
    rec.status = "pending"
    rec.sms_content = msg
    rec.sms_sent_at = now
    if DEBUG:
        rec.otp_demo = otp

    db.commit()

    return {
        "success": True,
        "message": f"New OTP sent to {mask_phone(rec.phone_number)}.",
        "approval_id": rec.id,
        "sms_status": send_result.get("status"),
        **({"otp_for_demo": otp} if DEBUG else {}),
    }


@router.post("/expire-check")
def expire_check(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    On-demand sweep: mark all pending approvals whose OTP has expired.
    Can be called by a scheduler or monitoring job.
    """
    count = _mark_expired(db)
    return {"expired_count": count, "timestamp": datetime.utcnow().isoformat()}
