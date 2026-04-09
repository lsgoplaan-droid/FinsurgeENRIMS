"""
Data masking utilities for API responses.
Masks PII fields in list views; full values only in detail views with audit.
"""


def mask_pan(pan: str | None) -> str:
    """Mask PAN: ABCDE1234F → XXXXX1234X"""
    if not pan or len(pan) < 4:
        return pan or ""
    return "X" * (len(pan) - 4) + pan[-4:-1] + "X"


def mask_phone(phone: str | None) -> str:
    """Mask phone: +919876543210 → +91XXXXX3210"""
    if not phone or len(phone) < 4:
        return phone or ""
    if phone.startswith("+91"):
        return "+91" + "X" * (len(phone) - 7) + phone[-4:]
    return "X" * (len(phone) - 4) + phone[-4:]


def mask_email(email: str | None) -> str:
    """Mask email: user@domain.com → u***@domain.com"""
    if not email or "@" not in email:
        return email or ""
    local, domain = email.split("@", 1)
    if len(local) <= 1:
        return f"{local}***@{domain}"
    return f"{local[0]}{'*' * (len(local) - 1)}@{domain}"


def mask_aadhaar(aadhaar: str | None) -> str:
    """Mask Aadhaar: show only last 4 digits."""
    if not aadhaar or len(aadhaar) < 4:
        return aadhaar or ""
    return "X" * (len(aadhaar) - 4) + aadhaar[-4:]


def mask_account_number(acct: str | None) -> str:
    """Mask account: 1234567890 → XXXXXX7890"""
    if not acct or len(acct) < 4:
        return acct or ""
    return "X" * (len(acct) - 4) + acct[-4:]
