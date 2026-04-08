import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Float, Text, ForeignKey
from app.database import Base


class Rule(Base):
    __tablename__ = "rules"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    description = Column(Text)
    category = Column(String, nullable=False, index=True)  # aml, fraud, kyc, compliance, operational
    subcategory = Column(String)  # structuring, layering, velocity, geographic, identity, card
    severity = Column(String, nullable=False)  # critical, high, medium, low
    is_enabled = Column(Boolean, default=True, index=True)
    priority = Column(Integer, default=100)
    version = Column(Integer, default=1)
    conditions = Column(Text, nullable=False)  # JSON
    actions = Column(Text, nullable=False)  # JSON
    time_window = Column(String)  # 1h, 24h, 7d, 30d, 90d
    threshold_amount = Column(Integer)  # in paise
    threshold_count = Column(Integer)
    applicable_channels = Column(Text)  # JSON array or null=all
    applicable_customer_types = Column(Text)  # JSON array or null=all
    detection_count = Column(Integer, default=0)
    last_triggered_at = Column(DateTime)
    created_by = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    description = Column(Text)
    category = Column(String)
    rule_ids = Column(Text)  # JSON array of rule IDs
    is_enabled = Column(Boolean, default=True)
    detection_count = Column(Integer, default=0)
    last_triggered_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
