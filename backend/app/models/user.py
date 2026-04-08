import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Table, Text
from sqlalchemy.orm import relationship
from app.database import Base

user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", String, ForeignKey("users.id"), primary_key=True),
    Column("role_id", String, ForeignKey("roles.id"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    department = Column(String)
    is_active = Column(Boolean, default=True)
    last_login_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    roles = relationship("Role", secondary=user_roles, back_populates="users")
    assigned_alerts = relationship("Alert", foreign_keys="Alert.assigned_to", back_populates="assignee")
    assigned_cases = relationship("Case", foreign_keys="Case.assigned_to", back_populates="assignee")


class Role(Base):
    __tablename__ = "roles"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, unique=True, nullable=False)
    description = Column(String)
    permissions = Column(Text)  # JSON array

    users = relationship("User", secondary=user_roles, back_populates="roles")
