from pydantic import BaseModel
from enum import Enum
from typing import Any


class RiskCategory(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


class AlertStatus(str, Enum):
    NEW = "new"
    ASSIGNED = "assigned"
    UNDER_REVIEW = "under_review"
    ESCALATED = "escalated"
    CLOSED_TP = "closed_true_positive"
    CLOSED_FP = "closed_false_positive"
    CLOSED_INC = "closed_inconclusive"


class CaseStatus(str, Enum):
    OPEN = "open"
    ASSIGNED = "assigned"
    UNDER_INVESTIGATION = "under_investigation"
    ESCALATED = "escalated"
    PENDING_REGULATORY = "pending_regulatory"
    CLOSED_TP = "closed_true_positive"
    CLOSED_FP = "closed_false_positive"
    CLOSED_INC = "closed_inconclusive"


class Priority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Channel(str, Enum):
    BRANCH = "branch"
    ATM = "atm"
    INTERNET_BANKING = "internet_banking"
    MOBILE_BANKING = "mobile_banking"
    POS = "pos"
    SWIFT = "swift"
    API = "api"


class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int
    total_pages: int
