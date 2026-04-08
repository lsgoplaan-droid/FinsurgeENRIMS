import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_number = Column(String, unique=True, nullable=False, index=True)
    rule_id = Column(String, ForeignKey("rules.id"))
    scenario_id = Column(String, ForeignKey("scenarios.id"))
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False, index=True)
    account_id = Column(String, ForeignKey("accounts.id"))
    transaction_id = Column(String, ForeignKey("transactions.id"))
    alert_type = Column(String, nullable=False, index=True)  # aml, fraud, kyc, compliance
    priority = Column(String, nullable=False)  # critical, high, medium, low
    risk_score = Column(Float, default=0.0)
    status = Column(String, default="new", index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    details = Column(Text)  # JSON with trigger details
    assigned_to = Column(String, ForeignKey("users.id"), index=True)
    assigned_at = Column(DateTime)
    sla_due_at = Column(DateTime)
    is_overdue = Column(Boolean, default=False)
    case_id = Column(String, ForeignKey("cases.id"))
    closed_by = Column(String, ForeignKey("users.id"))
    closed_at = Column(DateTime)
    closure_reason = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    customer = relationship("Customer", back_populates="alerts")
    assignee = relationship("User", foreign_keys=[assigned_to], back_populates="assigned_alerts")
    notes = relationship("AlertNote", back_populates="alert", order_by="AlertNote.created_at.desc()")
    rule = relationship("Rule")


class AlertNote(Base):
    __tablename__ = "alert_notes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    alert_id = Column(String, ForeignKey("alerts.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    note = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    alert = relationship("Alert", back_populates="notes")
    user = relationship("User")
