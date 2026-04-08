import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Date, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class KYCReview(Base):
    __tablename__ = "kyc_reviews"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False, index=True)
    review_type = Column(String, nullable=False)  # onboarding, periodic, trigger_based, enhanced
    risk_assessment = Column(String)  # low, medium, high, very_high
    previous_risk = Column(String)
    status = Column(String, default="pending", index=True)  # pending, in_progress, approved, rejected, expired
    reviewer_id = Column(String, ForeignKey("users.id"))
    due_date = Column(Date)
    completed_date = Column(Date)
    findings = Column(Text)
    edd_required = Column(Boolean, default=False)
    edd_reason = Column(String)
    next_review_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    customer = relationship("Customer", back_populates="kyc_reviews")
    reviewer = relationship("User")


class KYCDocument(Base):
    __tablename__ = "kyc_documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False, index=True)
    kyc_review_id = Column(String, ForeignKey("kyc_reviews.id"))
    document_type = Column(String, nullable=False)  # pan_card, aadhaar, passport, voter_id, driving_license, utility_bill, bank_statement
    document_number = Column(String)
    verified = Column(Boolean, default=False)
    verified_by = Column(String, ForeignKey("users.id"))
    verified_at = Column(DateTime)
    expiry_date = Column(Date)
    notes = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="kyc_documents")


class ScreeningResult(Base):
    __tablename__ = "screening_results"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False, index=True)
    screening_type = Column(String, nullable=False)  # pep, sanctions, adverse_media
    source = Column(String)  # ofac, un_sanctions, eu_sanctions, india_mha, pep_database, media_check
    match_found = Column(Boolean, default=False)
    match_score = Column(Float, default=0.0)
    matched_name = Column(String)
    matched_details = Column(Text)  # JSON
    status = Column(String, default="pending_review")  # pending_review, confirmed_match, false_positive, cleared
    reviewed_by = Column(String, ForeignKey("users.id"))
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer", back_populates="screening_results")
