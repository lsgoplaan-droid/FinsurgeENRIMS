from pydantic import BaseModel
from datetime import datetime


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    department: str | None = None
    is_active: bool
    roles: list[str] = []
    last_login_at: datetime | None = None
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    department: str | None = None
    role_names: list[str] = []


class UserUpdate(BaseModel):
    email: str | None = None
    full_name: str | None = None
    department: str | None = None
    is_active: bool | None = None
    role_names: list[str] | None = None
