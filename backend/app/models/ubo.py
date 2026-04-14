import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Boolean, DateTime, Date, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class UBORecord(Base):
    __tablename__ = "ubo_records"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id = Column(String, ForeignKey("customers.id"), nullable=False)
    ubo_name = Column(String, nullable=False)
    ownership_percentage = Column(Float, nullable=False)        # e.g. 51.0
    nationality = Column(String, default="IN")
    date_of_birth = Column(Date, nullable=True)
    id_type = Column(String, default="pan")                    # pan, passport, aadhaar, cin
    id_number = Column(String, nullable=True)
    relationship_type = Column(String, default="shareholder")  # director, shareholder, trustee, promoter, ubo
    verified = Column(Boolean, default=False)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer = relationship("Customer")
