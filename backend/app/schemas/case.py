from pydantic import BaseModel
from datetime import datetime


class CaseResponse(BaseModel):
    id: str
    case_number: str
    title: str
    description: str | None = None
    case_type: str
    priority: str
    status: str
    customer_id: str
    customer_name: str = ""
    assigned_to: str | None = None
    assignee_name: str | None = None
    assigned_at: datetime | None = None
    escalated_to: str | None = None
    escalation_reason: str | None = None
    sla_due_at: datetime | None = None
    is_overdue: bool = False
    disposition: str | None = None
    disposition_notes: str | None = None
    total_suspicious_amount: int = 0
    regulatory_filed: bool = False
    alert_count: int = 0
    evidence_count: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class CaseCreate(BaseModel):
    title: str
    description: str | None = None
    case_type: str
    priority: str
    customer_id: str
    alert_ids: list[str] = []


class CaseAssign(BaseModel):
    assigned_to: str


class CaseEscalate(BaseModel):
    escalated_to: str
    reason: str


class CaseDisposition(BaseModel):
    disposition: str  # true_positive, false_positive, inconclusive
    notes: str


class CaseStats(BaseModel):
    total: int = 0
    open: int = 0
    under_investigation: int = 0
    escalated: int = 0
    pending_regulatory: int = 0
    closed: int = 0
    by_type: dict = {}
    by_priority: dict = {}
    overdue: int = 0
