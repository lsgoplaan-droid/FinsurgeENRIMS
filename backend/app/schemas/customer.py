from pydantic import BaseModel, model_validator
from datetime import datetime, date


class CustomerResponse(BaseModel):
    id: str
    customer_number: str
    customer_type: str
    first_name: str | None = None
    last_name: str | None = None
    company_name: str | None = None
    display_name: str = ""
    full_name: str = ""
    date_of_birth: date | None = None
    gender: str | None = None
    nationality: str | None = None
    pan_number: str | None = None
    email: str | None = None
    phone: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    occupation: str | None = None
    employer: str | None = None
    annual_income: int | None = None
    source_of_funds: str | None = None
    risk_category: str = "low"
    risk_score: float = 0.0
    pep_status: bool = False
    kyc_status: str = "pending"
    kyc_expiry_date: date | None = None
    onboarding_date: date | None = None
    is_active: bool = True
    account_count: int = 0
    alert_count: int = 0
    case_count: int = 0
    has_high_risk_connections: bool = False
    created_at: datetime | None = None

    class Config:
        from_attributes = True

    @model_validator(mode="after")
    def mask_pii_fields(self):
        """D2: Mask PII fields in API responses to prevent exposure in list/detail views."""
        from app.utils.encryption import mask_pan, mask_phone
        if self.pan_number:
            self.pan_number = mask_pan(self.pan_number)
        if self.phone:
            self.phone = mask_phone(self.phone)
        return self


class Customer360Response(BaseModel):
    customer: CustomerResponse
    accounts: list[dict] = []
    recent_transactions: list[dict] = []
    alerts: list[dict] = []
    cases: list[dict] = []
    kyc_reviews: list[dict] = []
    screening_results: list[dict] = []
    risk_trend: list[dict] = []
    channel_usage: dict = {}
    network: dict = {}
