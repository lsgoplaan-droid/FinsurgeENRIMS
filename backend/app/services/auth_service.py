import hashlib
import secrets
from datetime import datetime, timedelta
from jose import JWTError, jwt
from app.config import settings


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000).hex()
    return f"{salt}${hashed}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        salt, stored_hash = hashed_password.split("$", 1)
        computed = hashlib.pbkdf2_hmac("sha256", plain_password.encode(), salt.encode(), 100000).hex()
        return computed == stored_hash
    except Exception:
        return False


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None
