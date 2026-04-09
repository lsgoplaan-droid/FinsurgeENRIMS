import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class EmployeeActivity(Base):
    __tablename__ = "employee_activities"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    employee_id = Column(String, nullable=False, index=True)  # e.g. EMP-3345
    employee_name = Column(String, nullable=False)
    department = Column(String, nullable=False)
    role = Column(String, nullable=False)
    risk_level = Column(String, default="low", index=True)  # low, medium, high, critical
    status = Column(String, default="normal", index=True)  # normal, suspicious, under_review, cleared, confirmed_fraud
    activity_type = Column(String, nullable=False, index=True)  # Account Access, Login, Privileged Action, Data Export, Config Change, Override, Report Generation, Customer Record Modification
    description = Column(Text, nullable=False)
    workstation_id = Column(String)
    ip_address = Column(String)
    after_hours = Column(Boolean, default=False)
    unauthorized_access = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
