import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Date, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class CTRReport(Base):
    __tablename__ = "ctr_reports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    report_number = Column(String, unique=True, nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    transaction_id = Column(String, ForeignKey("transactions.id"))
    transaction_amount = Column(Integer)
    transaction_date = Column(DateTime)
    filing_status = Column(String, default="auto_generated")  # auto_generated, pending_review, filed, amended
    filed_by = Column(String, ForeignKey("users.id"))
    filed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer")


class SARReport(Base):
    __tablename__ = "sar_reports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    report_number = Column(String, unique=True, nullable=False, index=True)
    case_id = Column(String, ForeignKey("cases.id"))
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    suspicious_activity_type = Column(String)
    narrative = Column(Text)
    total_amount = Column(Integer)
    date_range_start = Column(Date)
    date_range_end = Column(Date)
    filing_status = Column(String, default="draft")  # draft, pending_review, filed, amended
    filed_by = Column(String, ForeignKey("users.id"))
    filed_at = Column(DateTime)
    regulatory_reference = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    customer = relationship("Customer")
    case = relationship("Case", foreign_keys=[case_id])
