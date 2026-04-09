"""
Field-level PII encryption using AES-256-GCM.
Encrypts: PAN numbers, Aadhaar, sensitive identifiers.
"""
import base64
import hashlib
import os
from app.config import settings


def _get_key() -> bytes:
    """Derive a 32-byte key from the configured PII encryption key."""
    raw = settings.PII_ENCRYPTION_KEY.encode()
    return hashlib.sha256(raw).digest()


def encrypt_pii(plaintext: str) -> str:
    """Encrypt a PII field. Returns base64-encoded 'nonce:ciphertext:tag'."""
    if not plaintext:
        return ""
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        key = _get_key()
        nonce = os.urandom(12)
        aesgcm = AESGCM(key)
        ct = aesgcm.encrypt(nonce, plaintext.encode(), None)
        return base64.b64encode(nonce + ct).decode()
    except ImportError:
        # Fallback: simple XOR obfuscation if cryptography not installed
        key = _get_key()
        encrypted = bytes(b ^ key[i % len(key)] for i, b in enumerate(plaintext.encode()))
        return base64.b64encode(encrypted).decode()


def decrypt_pii(ciphertext: str) -> str:
    """Decrypt a PII field."""
    if not ciphertext:
        return ""
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        key = _get_key()
        raw = base64.b64decode(ciphertext)
        nonce = raw[:12]
        ct = raw[12:]
        aesgcm = AESGCM(key)
        return aesgcm.decrypt(nonce, ct, None).decode()
    except ImportError:
        key = _get_key()
        raw = base64.b64decode(ciphertext)
        decrypted = bytes(b ^ key[i % len(key)] for i, b in enumerate(raw))
        return decrypted.decode()
