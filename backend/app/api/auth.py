from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.models.user import User
from app.schemas.user import LoginRequest, TokenResponse, UserResponse
from app.services.auth_service import verify_password, create_access_token
from app.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == request.username).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account disabled")

    user.last_login_at = datetime.utcnow()
    db.commit()

    token = create_access_token({"sub": user.id, "username": user.username})
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            department=user.department,
            is_active=user.is_active,
            roles=[r.name for r in user.roles],
            last_login_at=user.last_login_at,
            created_at=user.created_at,
        ),
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        department=current_user.department,
        is_active=current_user.is_active,
        roles=[r.name for r in current_user.roles],
        last_login_at=current_user.last_login_at,
        created_at=current_user.created_at,
    )


# In-memory token blacklist (use Redis in production via REDIS_URL)
_token_blacklist: set[str] = set()


def is_token_blacklisted(token: str) -> bool:
    return token in _token_blacklist


@router.post("/logout")
def logout(request: Request, current_user: User = Depends(get_current_user)):
    """Invalidate the current token by adding it to the blacklist."""
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        _token_blacklist.add(token)
    return {"detail": "Logged out successfully"}
