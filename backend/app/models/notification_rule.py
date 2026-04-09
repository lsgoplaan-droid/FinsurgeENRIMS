import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class NotificationRule(Base):
    """Configurable notification rules — triggers SMS/email/in-app alerts based on events."""
    __tablename__ = "notification_rules"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(Text)

    # Trigger conditions
    trigger_event = Column(String, nullable=False)  # alert_created, alert_escalated, alert_sla_breach, case_created, case_escalated, case_sla_breach, high_risk_transaction, sar_filed, ctr_filed, fir_filed, rule_triggered, system_error
    condition_priority = Column(String)  # critical, high, medium, low — null means all
    condition_alert_type = Column(String)  # aml, fraud, kyc, compliance — null means all
    condition_amount_min = Column(Integer)  # minimum amount in paise — null means no min
    condition_risk_score_min = Column(Integer)  # minimum risk score — null means no min

    # Recipients
    recipient_type = Column(String, nullable=False)  # role, user, rm, risk_manager, compliance_officer, branch_head, cro, ceo
    recipient_roles = Column(String)  # comma-separated roles if recipient_type=role
    recipient_user_ids = Column(String)  # comma-separated user IDs if recipient_type=user

    # Channels
    channel_sms = Column(Boolean, default=False)
    channel_email = Column(Boolean, default=False)
    channel_in_app = Column(Boolean, default=True)
    channel_whatsapp = Column(Boolean, default=False)

    # Template
    message_template = Column(Text)  # Supports {alert_number}, {case_number}, {customer_name}, {amount}, {priority} placeholders

    # Behavior
    is_active = Column(Boolean, default=True)
    cooldown_minutes = Column(Integer, default=0)  # Minimum gap between repeat notifications
    escalation_delay_minutes = Column(Integer, default=0)  # Delay before sending (for escalation chains)
    max_per_day = Column(Integer, default=100)  # Rate limit per day
    severity = Column(String, default="medium")  # notification urgency: critical, high, medium, low

    created_by = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class NotificationLog(Base):
    """Log of all notifications sent — for audit and delivery tracking."""
    __tablename__ = "notification_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    notification_rule_id = Column(String, ForeignKey("notification_rules.id"), index=True)
    trigger_event = Column(String, nullable=False)
    resource_type = Column(String)  # alert, case, transaction, fir
    resource_id = Column(String)

    # Delivery
    channel = Column(String, nullable=False)  # sms, email, in_app, whatsapp
    recipient_user_id = Column(String, ForeignKey("users.id"))
    recipient_contact = Column(String)  # phone number or email address
    status = Column(String, default="pending")  # pending, sent, delivered, failed, read
    sent_at = Column(DateTime)
    delivered_at = Column(DateTime)
    read_at = Column(DateTime)
    failure_reason = Column(String)

    # Content
    subject = Column(String)
    message = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
