"""
API response data masking — automatically masks sensitive fields in responses.
Applied in schemas/serializers to ensure masked data is returned in list/detail endpoints.

PII fields masked:
- pan_number → XXXXX1234 format
- aadhaar_number → XXXX XXXX 1234 format  
- phone → +91XXXXX3210 format
- email → (optional masking, currently shown in detail view)
"""
from typing import Optional
from app.utils.encryption import mask_pan, mask_aadhaar, mask_phone


def mask_customer_for_list(customer_dict: dict) -> dict:
    """Mask PII in customer list response (pan, aadhaar, phone masked)."""
    if not customer_dict:
        return customer_dict

    masked = customer_dict.copy()

    # Mask PAN
    if "pan_number" in masked and masked["pan_number"]:
        masked["pan_number"] = mask_pan(masked["pan_number"])

    # Mask Aadhaar
    if "aadhaar_number" in masked and masked["aadhaar_number"]:
        masked["aadhaar_number"] = mask_aadhaar(masked["aadhaar_number"])

    # Mask phone
    if "phone" in masked and masked["phone"]:
        masked["phone"] = mask_phone(masked["phone"])

    # Email not masked in list (GDPR allows showing email if user has consent)

    return masked


def mask_customer_for_detail(customer_dict: dict) -> dict:
    """Mask PII in customer detail response (shows full data in detail view).
    
    In production with proper audit logging, this can show unmasked data
    since the audit trail captures who accessed what.
    For now, keep masked for consistency.
    """
    return mask_customer_for_list(customer_dict)
