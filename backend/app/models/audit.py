import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), index=True)
    action = Column(String, nullable=False, index=True)
    resource_type = Column(String, index=True)
    resource_id = Column(String)
    details = Column(Text)  # JSON
    ip_address = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")


class SystemConfig(Base):
    __tablename__ = "system_config"

    key = Column(String, primary_key=True)
    value = Column(Text)  # JSON value
    description = Column(String)
    updated_by = Column(String, ForeignKey("users.id"))
    updated_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    message = Column(String)
    notification_type = Column(String)  # alert_assigned, case_escalated, sla_warning, system
    is_read = Column(String, default="false")
    link_to = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
