import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class CustomerRelationship(Base):
    __tablename__ = "customer_relationships"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id_1 = Column(String, ForeignKey("customers.id"), nullable=False, index=True)
    customer_id_2 = Column(String, ForeignKey("customers.id"), nullable=False, index=True)
    relationship_type = Column(String, nullable=False)  # spouse, parent_child, business_partner, employer_employee, director, beneficiary
    strength = Column(Float, default=0.5)  # 0-1
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    customer_1 = relationship("Customer", foreign_keys=[customer_id_1])
    customer_2 = relationship("Customer", foreign_keys=[customer_id_2])


class CustomerLink(Base):
    __tablename__ = "customer_links"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id_1 = Column(String, ForeignKey("customers.id"), nullable=False, index=True)
    customer_id_2 = Column(String, ForeignKey("customers.id"), nullable=False, index=True)
    link_type = Column(String, nullable=False)  # shared_address, shared_phone, shared_employer, shared_ip, fund_transfer, same_device
    link_detail = Column(String)
    detected_at = Column(DateTime, default=datetime.utcnow)

    customer_1 = relationship("Customer", foreign_keys=[customer_id_1])
    customer_2 = relationship("Customer", foreign_keys=[customer_id_2])
