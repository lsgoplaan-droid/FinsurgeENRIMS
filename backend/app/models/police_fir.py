import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class PoliceFIR(Base):
    """First Information Report — tracks fraud cases reported to law enforcement."""
    __tablename__ = "police_firs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    fir_number = Column(String, unique=True, nullable=False, index=True)
    case_id = Column(String, ForeignKey("cases.id"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id"), index=True)

    # Police station details
    police_station = Column(String, nullable=False)
    police_district = Column(String)
    police_state = Column(String)
    investigating_officer = Column(String)
    officer_contact = Column(String)
    officer_designation = Column(String)

    # Offense details
    offense_type = Column(String, nullable=False)  # cheating, forgery, cyber_fraud, money_laundering, identity_theft, card_fraud, upi_fraud, loan_fraud, insider_fraud
    ipc_sections = Column(String)  # e.g. "420, 468, 471" or "IT Act Sec 66C"
    fraud_amount = Column(Integer, default=0)  # in paise
    offense_date = Column(DateTime)
    offense_description = Column(Text)

    # Filing details
    status = Column(String, default="draft", index=True)  # draft, filed, acknowledged, under_investigation, charge_sheet_filed, court_proceedings, convicted, acquitted, closed, withdrawn
    filed_by = Column(String, ForeignKey("users.id"))
    filed_at = Column(DateTime)
    acknowledged_at = Column(DateTime)
    acknowledgment_number = Column(String)

    # Investigation tracking
    charge_sheet_date = Column(DateTime)
    charge_sheet_number = Column(String)
    court_name = Column(String)
    court_case_number = Column(String)
    next_hearing_date = Column(DateTime)
    hearing_notes = Column(Text)

    # Recovery
    amount_recovered = Column(Integer, default=0)  # in paise
    recovery_details = Column(Text)
    assets_frozen = Column(Boolean, default=False)
    freeze_order_details = Column(Text)

    # RBI reporting
    rbi_fraud_reported = Column(Boolean, default=False)  # FMR-1 filed
    rbi_report_date = Column(DateTime)
    rbi_reference = Column(String)
    cyber_cell_reported = Column(Boolean, default=False)
    cyber_complaint_number = Column(String)

    # Metadata
    priority = Column(String, default="medium")  # critical, high, medium, low
    notes = Column(Text)
    created_by = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    case = relationship("Case")
    customer = relationship("Customer")
    creator = relationship("User", foreign_keys=[created_by])
    filer = relationship("User", foreign_keys=[filed_by])
    activities = relationship("FIRActivity", back_populates="fir", order_by="FIRActivity.created_at.desc()")


class FIRActivity(Base):
    """Activity log for FIR status changes and updates."""
    __tablename__ = "fir_activities"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    fir_id = Column(String, ForeignKey("police_firs.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"))
    activity_type = Column(String, nullable=False)  # created, filed, acknowledged, status_changed, hearing_scheduled, charge_sheet, recovery, note_added, rbi_reported
    description = Column(Text)
    old_value = Column(String)
    new_value = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    fir = relationship("PoliceFIR", back_populates="activities")
    user = relationship("User")
