import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Date, Integer, Float, Text
from sqlalchemy.orm import relationship
from app.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_number = Column(String, unique=True, nullable=False, index=True)
    customer_type = Column(String, nullable=False)  # individual, corporate, trust
    first_name = Column(String)
    last_name = Column(String)
    company_name = Column(String)
    date_of_birth = Column(Date)
    gender = Column(String)
    nationality = Column(String, default="IN")
    pan_number = Column(String, unique=True, index=True)
    aadhaar_hash = Column(String)
    passport_number = Column(String)
    email = Column(String)
    phone = Column(String, index=True)
    address_line1 = Column(String)
    address_line2 = Column(String)
    city = Column(String)
    state = Column(String)
    country = Column(String, default="IN")
    postal_code = Column(String)
    occupation = Column(String)
    employer = Column(String)
    annual_income = Column(Integer)  # in paise
    source_of_funds = Column(String)
    risk_category = Column(String, default="low", index=True)  # low, medium, high, very_high
    risk_score = Column(Float, default=10.0)
    pep_status = Column(Boolean, default=False)
    kyc_status = Column(String, default="pending", index=True)
    kyc_expiry_date = Column(Date)
    onboarding_date = Column(Date)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    accounts = relationship("Account", back_populates="customer")
    transactions = relationship("Transaction", back_populates="customer")
    alerts = relationship("Alert", back_populates="customer")
    cases = relationship("Case", back_populates="customer")
    kyc_reviews = relationship("KYCReview", back_populates="customer")
    kyc_documents = relationship("KYCDocument", back_populates="customer")
    screening_results = relationship("ScreeningResult", back_populates="customer")

    @property
    def full_name(self):
        if self.customer_type == "corporate":
            return self.company_name or ""
        return f"{self.first_name or ''} {self.last_name or ''}".strip()
