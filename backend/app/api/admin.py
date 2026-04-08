import json
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import User, Role, AuditLog, SystemConfig, Notification, Customer, Transaction, Alert, Case

router = APIRouter(prefix="/admin", tags=["Administration"])


@router.get("/users")
def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    users = db.query(User).order_by(User.full_name).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "department": u.department,
            "is_active": u.is_active,
            "roles": [r.name for r in u.roles],
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        }
        for u in users
    ]


@router.get("/roles")
def list_roles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    roles = db.query(Role).order_by(Role.name).all()
    return [
        {"id": r.id, "name": r.name, "description": r.description, "permissions": json.loads(r.permissions) if r.permissions else []}
        for r in roles
    ]


@router.get("/audit-log")
def get_audit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user_id: str = Query(None),
    action: str = Query(None),
    resource_type: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(AuditLog)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)

    total = query.count()
    logs = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for log in logs:
        user = db.query(User).filter(User.id == log.user_id).first()
        items.append({
            "id": log.id,
            "user_name": user.full_name if user else "System",
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "details": log.details,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/system-health")
def system_health(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {
        "status": "healthy",
        "database": "connected",
        "counts": {
            "customers": db.query(func.count(Customer.id)).scalar() or 0,
            "transactions": db.query(func.count(Transaction.id)).scalar() or 0,
            "alerts": db.query(func.count(Alert.id)).scalar() or 0,
            "cases": db.query(func.count(Case.id)).scalar() or 0,
            "users": db.query(func.count(User.id)).scalar() or 0,
        },
    }


@router.get("/config")
def get_config(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    configs = db.query(SystemConfig).all()
    return {c.key: {"value": c.value, "description": c.description} for c in configs}


@router.get("/notifications")
def get_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    notifs = db.query(Notification).filter(Notification.user_id == current_user.id).order_by(Notification.created_at.desc()).limit(50).all()
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "notification_type": n.notification_type,
            "is_read": n.is_read == "true",
            "link_to": n.link_to,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifs
    ]
