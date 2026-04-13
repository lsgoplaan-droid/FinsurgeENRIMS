"""
SMS OTP Service for high-value transaction approvals.

Demo mode: logs to console + returns a mock message ID.
Production: set SMS_GATEWAY_URL env var to your SMS provider endpoint.
"""
import hashlib
import logging
import os
import secrets
import uuid
from datetime import timedelta

logger = logging.getLogger(__name__)

OTP_EXPIRY_MINUTES = 5
MAX_ATTEMPTS = 3

# Approval thresholds in paise (1 INR = 100 paise)
THRESHOLDS = {
    "retail_standard": 2500000,    # INR 25,000
    "retail_premium":  10000000,   # INR 100,000
    "sme":             20000000,   # INR 200,000
    "corporate":       50000000,   # INR 500,000
    "high_risk":       0,          # all transactions (0 means always trigger)
    "default":         5000000,    # INR 50,000
}


def generate_otp() -> str:
    """Return a cryptographically random 6-digit OTP string."""
    return str(secrets.randbelow(900000) + 100000)


def hash_otp(otp: str) -> str:
    """Return SHA256 hex digest of the OTP."""
    return hashlib.sha256(otp.encode()).hexdigest()


def verify_otp(otp: str, stored_hash: str) -> bool:
    """Constant-time comparison of OTP against stored SHA256 hash."""
    candidate_hash = hashlib.sha256(otp.encode()).hexdigest()
    return secrets.compare_digest(candidate_hash, stored_hash)


def get_threshold_for_customer(customer) -> int:
    """
    Return the SMS approval threshold in paise for the given customer.

    Looks at risk_category first, then falls back to the default.
    A threshold of 0 means every transaction requires SMS approval.
    Returns -1 to signal 'never require SMS approval' (not used currently
    but left as an escape hatch).
    """
    risk = (customer.risk_category or "").lower()

    if risk in ("high", "very_high"):
        return THRESHOLDS["high_risk"]   # 0 → every transaction

    # Try to infer segment from customer_type / occupation
    customer_type = (getattr(customer, "customer_type", "") or "").lower()
    occupation = (getattr(customer, "occupation", "") or "").lower()

    if customer_type == "corporate":
        return THRESHOLDS["corporate"]

    if customer_type in ("sme", "trust") or "sme" in occupation or "business" in occupation:
        return THRESHOLDS["sme"]

    # Retail customers — distinguish premium by annual income
    annual_income = getattr(customer, "annual_income", None) or 0
    if annual_income >= 100_000_00 * 100:  # INR 10 lakh+ → premium
        return THRESHOLDS["retail_premium"]

    return THRESHOLDS["default"]


def build_sms_message(otp: str, amount_inr: float, beneficiary: str, expires_in: int = OTP_EXPIRY_MINUTES) -> str:
    """
    Build the SMS body text.

    Example output:
        FinsurgeENRIMS: Your transfer of INR 50,000.00 to Acme Corp requires approval.
        OTP: 482917. Reply YES 482917 to approve or NO to cancel. Valid 5 mins.
        Do not share this OTP with anyone.
    """
    amount_formatted = f"{amount_inr:,.2f}"
    lines = [
        f"FinsurgeENRIMS: Your transfer of INR {amount_formatted} to {beneficiary} requires your approval.",
        f"OTP: {otp}. Valid for {expires_in} mins.",
        "Do not share this OTP with anyone.",
    ]
    return " ".join(lines)


def send_sms(phone_number: str, message: str) -> dict:
    """
    Send an SMS.

    In demo mode (no SMS_GATEWAY_URL configured): logs to console.
    In production: HTTP POST to SMS_GATEWAY_URL with JSON payload.

    Returns:
        {"status": "sent"|"failed", "message_id": str}
    """
    gateway_url = os.getenv("SMS_GATEWAY_URL", "")
    message_id = str(uuid.uuid4())

    if not gateway_url:
        # Demo mode — log to console
        logger.info("=== SMS (DEMO MODE) ===")
        logger.info("To     : %s", phone_number)
        logger.info("Message: %s", message)
        logger.info("Msg-ID : %s", message_id)
        logger.info("======================")
        return {"status": "sent", "message_id": message_id}

    # Production path — POST to configured SMS gateway
    try:
        import httpx  # optional dependency; add to requirements if using real SMS

        api_key = os.getenv("SMS_GATEWAY_API_KEY", "")
        payload = {
            "to": phone_number,
            "message": message,
            "api_key": api_key,
        }
        response = httpx.post(gateway_url, json=payload, timeout=10)
        response.raise_for_status()
        data = response.json()
        logger.info("SMS sent to %s, gateway response: %s", phone_number, data)
        return {"status": "sent", "message_id": data.get("message_id", message_id)}
    except Exception as exc:
        logger.error("SMS send failed to %s: %s", phone_number, exc)
        return {"status": "failed", "message_id": message_id, "error": str(exc)}


def mask_phone(phone: str) -> str:
    """Return a masked version of the phone number, e.g. +91*****6789."""
    if not phone or len(phone) < 4:
        return "****"
    return "*" * (len(phone) - 4) + phone[-4:]
