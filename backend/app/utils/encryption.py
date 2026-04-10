"""
PII field-level encryption for Customer sensitive data (PAN, Aadhaar, phone).
Uses cryptography.fernet for AES-128-CBC encryption with HMAC authentication.

Environment: PII_ENCRYPTION_KEY must be set (auto-generated in dev, provided in production).
Key format: Base64-encoded 32-byte key (generated via Fernet.generate_key()).
"""
import os
from cryptography.fernet import Fernet, InvalidToken
from typing import Optional


class PIIEncryption:
    """Manages encryption/decryption of PII fields."""

    def __init__(self):
        key_bytes = os.getenv("PII_ENCRYPTION_KEY", "").encode()
        if not key_bytes or key_bytes == b"":
            raise ValueError("PII_ENCRYPTION_KEY environment variable not set")

        try:
            self.cipher = Fernet(key_bytes)
        except Exception as e:
            raise ValueError(f"Invalid PII_ENCRYPTION_KEY format: {e}")

    def encrypt(self, plaintext: Optional[str]) -> Optional[str]:
        """Encrypt plaintext. Returns None if input is None."""
        if plaintext is None:
            return None
        try:
            ciphertext = self.cipher.encrypt(plaintext.encode()).decode()
            return ciphertext
        except Exception as e:
            raise ValueError(f"Encryption failed: {e}")

    def decrypt(self, ciphertext: Optional[str]) -> Optional[str]:
        """Decrypt ciphertext. Returns None if input is None."""
        if ciphertext is None:
            return None
        try:
            plaintext = self.cipher.decrypt(ciphertext.encode()).decode()
            return plaintext
        except InvalidToken:
            raise ValueError("Decryption failed: invalid token or wrong key")
        except Exception as e:
            raise ValueError(f"Decryption failed: {e}")


# Global encryption instance
_encryption = None


def get_encryption():
    """Lazy-load encryption instance."""
    global _encryption
    if _encryption is None:
        _encryption = PIIEncryption()
    return _encryption


def mask_pan(pan: Optional[str]) -> Optional[str]:
    """Mask PAN: XXXXX1234 (last 4 digits visible)."""
    if not pan or len(pan) < 4:
        return pan
    return f"XXXXX{pan[-4:]}"


def mask_aadhaar(aadhaar: Optional[str]) -> Optional[str]:
    """Mask Aadhaar: XXXX XXXX 1234 (last 4 digits visible)."""
    if not aadhaar or len(aadhaar) < 4:
        return aadhaar
    clean = aadhaar.replace(" ", "")
    if len(clean) != 12:
        return aadhaar
    return f"XXXX XXXX {clean[-4:]}"


def mask_phone(phone: Optional[str]) -> Optional[str]:
    """Mask phone: +91XXXXX3210 (last 4 digits visible)."""
    if not phone or len(phone) < 4:
        return phone
    clean = phone.replace("-", "").replace(" ", "")
    if clean.startswith("+91"):
        return f"+91XXXXX{clean[-4:]}"
    elif clean.startswith("91"):
        return f"91XXXXX{clean[-4:]}"
    else:
        return f"XXXXX{clean[-4:]}"
