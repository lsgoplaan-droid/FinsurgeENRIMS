import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean
from app.database import Base


class SMSApproval(Base):
    __tablename__ = "sms_approvals"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=True, index=True)
    transaction_ref = Column(String, nullable=False, index=True)
    account_id = Column(String, ForeignKey("accounts.id"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False, index=True)
    phone_number = Column(String, nullable=False)
    amount = Column(Integer, nullable=False)           # in paise
    otp_hash = Column(String, nullable=False)          # SHA256 of OTP, never store plaintext
    otp_expires_at = Column(DateTime, nullable=False)
    status = Column(String, default="pending", index=True)  # pending / approved / rejected / expired
    attempts = Column(Integer, default=0)
    sms_content = Column(String, nullable=True)        # full SMS text (for demo visibility)
    sms_sent_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String, nullable=True)        # username of user who acted
    rejection_reason = Column(String, nullable=True)
    otp_demo = Column(String, nullable=True)           # OTP in plaintext for demo/DEBUG mode only
    created_at = Column(DateTime, default=datetime.utcnow)

    # Second-level FRIMS User approval (only for very high value transactions)
    frims_approval_required = Column(Boolean, default=False, nullable=False)
    frims_approval_status = Column(String, nullable=True)  # None / pending / approved / rejected
    frims_approved_by = Column(String, nullable=True)       # username of FRIMS officer
    frims_approved_at = Column(DateTime, nullable=True)
    frims_rejection_reason = Column(String, nullable=True)
