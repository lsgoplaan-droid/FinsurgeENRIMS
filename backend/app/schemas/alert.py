from pydantic import BaseModel
from datetime import datetime


class AlertResponse(BaseModel):
    id: str
    alert_number: str
    rule_id: str | None = None
    rule_name: str | None = None
    customer_id: str
    customer_name: str = ""
    account_id: str | None = None
    transaction_id: str | None = None
    alert_type: str
    priority: str
    risk_score: float = 0.0
    status: str
    title: str
    description: str | None = None
    details: str | None = None
    assigned_to: str | None = None
    assignee_name: str | None = None
    assigned_at: datetime | None = None
    sla_due_at: datetime | None = None
    is_overdue: bool = False
    case_id: str | None = None
    closure_reason: str | None = None
    closed_at: datetime | None = None
    notes: list[dict] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class AlertAssign(BaseModel):
    assigned_to: str


class AlertClose(BaseModel):
    disposition: str  # true_positive, false_positive, inconclusive
    reason: str


class AlertNote(BaseModel):
    note: str


class AlertStats(BaseModel):
    total: int = 0
    new: int = 0
    assigned: int = 0
    under_review: int = 0
    escalated: int = 0
    closed: int = 0
    by_priority: dict = {}
    by_type: dict = {}
    overdue: int = 0
