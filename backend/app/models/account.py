import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Date, Integer, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    account_number = Column(String, unique=True, nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False, index=True)
    account_type = Column(String, nullable=False)  # savings, current, loan, credit_card, fixed_deposit, nre, nro
    currency = Column(String, default="INR")
    balance = Column(Integer, default=0)  # in paise
    status = Column(String, default="active", index=True)  # active, frozen, dormant, closed
    branch_code = Column(String)
    ifsc_code = Column(String)
    opened_date = Column(Date)
    closed_date = Column(Date)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    customer = relationship("Customer", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account")


class AccountHolder(Base):
    __tablename__ = "account_holders"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    account_id = Column(String, ForeignKey("accounts.id"), nullable=False)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    relationship_type = Column(String)  # primary, joint, nominee, power_of_attorney
