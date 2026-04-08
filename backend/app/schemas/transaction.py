from pydantic import BaseModel
from datetime import datetime


class TransactionResponse(BaseModel):
    id: str
    transaction_ref: str
    account_id: str
    customer_id: str
    customer_name: str = ""
    account_number: str = ""
    transaction_type: str
    transaction_method: str
    channel: str
    amount: int
    currency: str = "INR"
    balance_after: int | None = None
    counterparty_name: str | None = None
    counterparty_account: str | None = None
    counterparty_bank: str | None = None
    description: str | None = None
    location_city: str | None = None
    location_country: str | None = None
    risk_score: float = 0.0
    is_flagged: bool = False
    flag_reason: str | None = None
    transaction_date: datetime
    processing_status: str = "completed"
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class TransactionCreate(BaseModel):
    account_id: str
    customer_id: str
    transaction_type: str
    transaction_method: str
    channel: str
    amount: int
    counterparty_account: str | None = None
    counterparty_name: str | None = None
    counterparty_bank: str | None = None
    counterparty_ifsc: str | None = None
    description: str | None = None
    location_city: str | None = None
    location_country: str = "IN"
    ip_address: str | None = None
    device_id: str | None = None


class TransactionStats(BaseModel):
    total_count: int = 0
    total_amount: int = 0
    flagged_count: int = 0
    by_channel: dict = {}
    by_method: dict = {}
    by_risk: dict = {}
