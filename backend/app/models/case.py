import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, ForeignKey, Table
from sqlalchemy.orm import relationship
from app.database import Base

case_alerts = Table(
    "case_alerts",
    Base.metadata,
    Column("case_id", String, ForeignKey("cases.id"), primary_key=True),
    Column("alert_id", String, ForeignKey("alerts.id"), primary_key=True),
)


class Case(Base):
    __tablename__ = "cases"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    case_number = Column(String, unique=True, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    case_type = Column(String, nullable=False)  # aml_investigation, fraud_investigation, kyc_review, compliance_review
    priority = Column(String, nullable=False)  # critical, high, medium, low
    status = Column(String, default="open", index=True)
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False, index=True)
    assigned_to = Column(String, ForeignKey("users.id"), index=True)
    assigned_at = Column(DateTime)
    escalated_to = Column(String, ForeignKey("users.id"))
    escalated_at = Column(DateTime)
    escalation_reason = Column(String)
    sla_due_at = Column(DateTime)
    is_overdue = Column(Boolean, default=False)
    disposition = Column(String)  # true_positive, false_positive, inconclusive
    disposition_notes = Column(Text)
    total_suspicious_amount = Column(Integer, default=0)
    regulatory_filed = Column(Boolean, default=False)
    sar_id = Column(String)  # Reference to SAR report (no FK to avoid circular)
    closed_by = Column(String, ForeignKey("users.id"))
    closed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    customer = relationship("Customer", back_populates="cases")
    assignee = relationship("User", foreign_keys=[assigned_to], back_populates="assigned_cases")
    alerts = relationship("Alert", secondary=case_alerts)
    evidence = relationship("CaseEvidence", back_populates="case", order_by="CaseEvidence.created_at.desc()")
    activities = relationship("CaseActivity", back_populates="case", order_by="CaseActivity.created_at.desc()")


class CaseEvidence(Base):
    __tablename__ = "case_evidence"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    evidence_type = Column(String, nullable=False)  # document, screenshot, note, transaction_record, communication
    title = Column(String, nullable=False)
    description = Column(Text)
    file_path = Column(String)
    file_name = Column(String)
    uploaded_by = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="evidence")
    uploader = relationship("User")


class CaseActivity(Base):
    __tablename__ = "case_activities"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id = Column(String, ForeignKey("cases.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"))
    activity_type = Column(String, nullable=False)  # created, assigned, note_added, evidence_added, status_changed, escalated, disposition_set, report_filed, closed
    description = Column(Text)
    old_value = Column(String)
    new_value = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="activities")
    user = relationship("User")
