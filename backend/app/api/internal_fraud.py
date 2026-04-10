"""
Internal Fraud Monitoring — Employee activity tracking, access monitoring, insider threat detection.
Tracks: account access, login events, privileged actions, data exports, config changes, overrides.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, EmployeeActivity

router = APIRouter(prefix="/internal-fraud", tags=["Internal Fraud"])


class IFRRuleCreate(BaseModel):
    name: str
    description: str
    category: str = "access_control"
    severity: str = "medium"
    enabled: bool = True


class IFRRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    enabled: Optional[bool] = None
    triggers: Optional[int] = None

# Internal fraud detection rules (static configuration — these define what triggers insider threat alerts)
INTERNAL_FRAUD_RULES = [
    {"id": "IFR-001", "name": "After-Hours System Access", "description": "Employee accesses core banking system outside 8AM-8PM IST", "category": "access_control", "severity": "high", "enabled": True, "triggers": 5},
    {"id": "IFR-002", "name": "Bulk Customer Record Access", "description": "More than 50 customer records accessed within 1 hour without case assignment", "category": "data_access", "severity": "critical", "enabled": True, "triggers": 3},
    {"id": "IFR-003", "name": "Unauthorized Department Access", "description": "Employee accesses data outside their department scope", "category": "access_control", "severity": "medium", "enabled": True, "triggers": 7},
    {"id": "IFR-004", "name": "USB Data Export", "description": "Data export to removable media detected from workstation", "category": "data_exfiltration", "severity": "critical", "enabled": True, "triggers": 1},
    {"id": "IFR-005", "name": "Config/Rule Threshold Modification", "description": "Detection rule thresholds modified without change request", "category": "privilege_abuse", "severity": "high", "enabled": True, "triggers": 2},
    {"id": "IFR-006", "name": "Fraud Block Override", "description": "Employee overrides fraud block on transaction without supervisor approval", "category": "privilege_abuse", "severity": "critical", "enabled": True, "triggers": 1},
    {"id": "IFR-007", "name": "Dormant Account Reactivation", "description": "Dormant account (>12 months inactive) reactivated by branch employee", "category": "account_manipulation", "severity": "high", "enabled": True, "triggers": 4},
    {"id": "IFR-008", "name": "Cross-Department Data Query", "description": "Employee runs queries on datasets outside their role scope (e.g., HR accessing salary reports)", "category": "data_access", "severity": "medium", "enabled": True, "triggers": 2},
    {"id": "IFR-009", "name": "Audit Log Deletion", "description": "Attempt to delete or modify audit trail entries detected", "category": "evidence_tampering", "severity": "critical", "enabled": True, "triggers": 1},
    {"id": "IFR-010", "name": "Loan Amount Post-Approval Modification", "description": "Loan amount changed after approval without re-authorization", "category": "privilege_abuse", "severity": "high", "enabled": True, "triggers": 3},
    {"id": "IFR-011", "name": "Unusual Branch Transfer Pattern", "description": "Employee initiates transfers to same beneficiary from multiple customer accounts", "category": "collusion", "severity": "high", "enabled": True, "triggers": 2},
    {"id": "IFR-012", "name": "Failed Login Spike", "description": "More than 5 failed login attempts in 10 minutes from employee account", "category": "access_control", "severity": "medium", "enabled": True, "triggers": 8},
]


@router.get("/rules")
def get_internal_fraud_rules(
    current_user: User = Depends(get_current_user),
):
    """Get all internal fraud detection rules."""
    return INTERNAL_FRAUD_RULES


def _next_ifr_id() -> str:
    nums = []
    for r in INTERNAL_FRAUD_RULES:
        try:
            nums.append(int(r["id"].split("-")[-1]))
        except (ValueError, IndexError):
            pass
    next_num = (max(nums) + 1) if nums else 1
    return f"IFR-{next_num:03d}"


@router.post("/rules", status_code=201)
def create_internal_fraud_rule(
    body: IFRRuleCreate,
    current_user: User = Depends(get_current_user),
):
    """Create a new internal fraud detection rule."""
    rule = {
        "id": _next_ifr_id(),
        "name": body.name,
        "description": body.description,
        "category": body.category,
        "severity": body.severity,
        "enabled": body.enabled,
        "triggers": 0,
    }
    INTERNAL_FRAUD_RULES.append(rule)
    return rule


@router.put("/rules/{rule_id}")
def update_internal_fraud_rule(
    rule_id: str,
    body: IFRRuleUpdate,
    current_user: User = Depends(get_current_user),
):
    """Update an existing internal fraud rule."""
    for r in INTERNAL_FRAUD_RULES:
        if r["id"] == rule_id:
            data = body.model_dump(exclude_none=True)
            r.update(data)
            return r
    raise HTTPException(status_code=404, detail="Rule not found")


@router.delete("/rules/{rule_id}", status_code=204)
def delete_internal_fraud_rule(
    rule_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete an internal fraud rule."""
    for i, r in enumerate(INTERNAL_FRAUD_RULES):
        if r["id"] == rule_id:
            INTERNAL_FRAUD_RULES.pop(i)
            return
    raise HTTPException(status_code=404, detail="Rule not found")


@router.get("/activities")
def get_activities(
    risk_level: str = Query(None),
    status: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all employee activities with insider threat indicators."""
    query = db.query(EmployeeActivity)

    if risk_level:
        query = query.filter(EmployeeActivity.risk_level == risk_level)
    if status:
        query = query.filter(EmployeeActivity.status == status)

    total = query.count()
    items = query.order_by(EmployeeActivity.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    activities = []
    for a in items:
        flags = []
        if a.after_hours:
            flags.append("After Hours")
        if a.unauthorized_access:
            flags.append("Unauthorized")
        activities.append({
            "id": a.id,
            "employee_id": a.employee_id,
            "employee_name": a.employee_name,
            "department": a.department,
            "role": a.role,
            "risk_level": a.risk_level,
            "status": a.status,
            "activity_type": a.activity_type,
            "description": a.description,
            "workstation_id": a.workstation_id,
            "ip_address": a.ip_address,
            "timestamp": a.created_at.isoformat() if a.created_at else None,
            "flags": flags,
        })

    return {"items": activities, "total": total, "page": page, "page_size": page_size}


@router.get("/stats")
def get_internal_fraud_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Summary statistics for internal fraud monitoring."""
    critical = db.query(func.count(EmployeeActivity.id)).filter(EmployeeActivity.risk_level == "critical").scalar() or 0
    under_investigation = db.query(func.count(EmployeeActivity.id)).filter(EmployeeActivity.status == "under_review").scalar() or 0
    after_hours = db.query(func.count(EmployeeActivity.id)).filter(EmployeeActivity.after_hours == True).scalar() or 0
    unauthorized = db.query(func.count(EmployeeActivity.id)).filter(EmployeeActivity.unauthorized_access == True).scalar() or 0

    return {
        "critical_risk": critical,
        "under_investigation": under_investigation,
        "after_hours": after_hours,
        "unauthorized": unauthorized,
    }
