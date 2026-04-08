import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Date, Integer, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_ref = Column(String, unique=True, nullable=False, index=True)
    account_id = Column(String, ForeignKey("accounts.id"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False, index=True)
    transaction_type = Column(String, nullable=False)  # credit, debit
    transaction_method = Column(String, nullable=False)  # cash_deposit, neft, rtgs, imps, upi, swift, cheque, card_payment, atm, pos, internal_transfer
    channel = Column(String, nullable=False, index=True)  # branch, atm, internet_banking, mobile_banking, pos, swift, api
    amount = Column(Integer, nullable=False)  # in paise, always positive
    currency = Column(String, default="INR")
    balance_after = Column(Integer)
    counterparty_account = Column(String)
    counterparty_name = Column(String)
    counterparty_bank = Column(String)
    counterparty_ifsc = Column(String)
    description = Column(String)
    location_city = Column(String)
    location_country = Column(String, default="IN")
    ip_address = Column(String)
    device_id = Column(String)
    risk_score = Column(Float, default=0.0)
    is_flagged = Column(Boolean, default=False, index=True)
    flag_reason = Column(String)
    transaction_date = Column(DateTime, nullable=False, index=True)
    value_date = Column(Date)
    processing_status = Column(String, default="completed")  # completed, pending, failed, reversed
    created_at = Column(DateTime, default=datetime.utcnow)

    account = relationship("Account", back_populates="transactions")
    customer = relationship("Customer", back_populates="transactions")
