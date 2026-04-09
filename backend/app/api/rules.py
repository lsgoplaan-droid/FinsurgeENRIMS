import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Rule, Scenario, User

router = APIRouter(prefix="/rules", tags=["Rules Engine"])


class RuleCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    category: str = "fraud"
    subcategory: Optional[str] = ""
    severity: str = "medium"
    is_enabled: bool = True
    priority: int = 20
    conditions: Optional[Any] = {}
    actions: Optional[Any] = []
    time_window: Optional[str] = None
    threshold_amount: Optional[int] = None
    threshold_count: Optional[int] = None


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    severity: Optional[str] = None
    is_enabled: Optional[bool] = None
    priority: Optional[int] = None
    conditions: Optional[Any] = None
    actions: Optional[Any] = None
    time_window: Optional[str] = None
    threshold_amount: Optional[int] = None
    threshold_count: Optional[int] = None


@router.get("")
def list_rules(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    category: str = Query(None),
    is_enabled: bool = Query(None),
    severity: str = Query(None),
    search: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Rule)
    if category:
        query = query.filter(Rule.category == category)
    if is_enabled is not None:
        query = query.filter(Rule.is_enabled == is_enabled)
    if severity:
        query = query.filter(Rule.severity == severity)
    if search:
        query = query.filter(Rule.name.ilike(f"%{search}%"))

    total = query.count()
    rules = query.order_by(Rule.priority, Rule.name).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [
            {
                "id": r.id,
                "name": r.name,
                "description": r.description,
                "category": r.category,
                "subcategory": r.subcategory,
                "severity": r.severity,
                "is_enabled": r.is_enabled,
                "priority": r.priority,
                "version": r.version,
                "conditions": json.loads(r.conditions) if r.conditions else {},
                "actions": json.loads(r.actions) if r.actions else [],
                "time_window": r.time_window,
                "threshold_amount": r.threshold_amount,
                "threshold_count": r.threshold_count,
                "detection_count": r.detection_count or 0,
                "last_triggered_at": r.last_triggered_at.isoformat() if r.last_triggered_at else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rules
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/categories")
def get_rule_categories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cats = db.query(Rule.category, Rule.subcategory, func.count(Rule.id)).group_by(Rule.category, Rule.subcategory).all()
    result = {}
    for cat, subcat, count in cats:
        if cat not in result:
            result[cat] = {"total": 0, "subcategories": {}}
        result[cat]["total"] += count
        if subcat:
            result[cat]["subcategories"][subcat] = count
    return result


@router.get("/{rule_id}")
def get_rule(rule_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    r = db.query(Rule).filter(Rule.id == rule_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rule not found")
    return {
        "id": r.id,
        "name": r.name,
        "description": r.description,
        "category": r.category,
        "subcategory": r.subcategory,
        "severity": r.severity,
        "is_enabled": r.is_enabled,
        "priority": r.priority,
        "conditions": json.loads(r.conditions) if r.conditions else {},
        "actions": json.loads(r.actions) if r.actions else [],
        "time_window": r.time_window,
        "threshold_amount": r.threshold_amount,
        "threshold_count": r.threshold_count,
        "detection_count": r.detection_count or 0,
        "last_triggered_at": r.last_triggered_at.isoformat() if r.last_triggered_at else None,
    }


@router.post("/create")
def create_rule(body: RuleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    r = Rule(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        category=body.category,
        subcategory=body.subcategory,
        severity=body.severity,
        is_enabled=body.is_enabled,
        priority=body.priority,
        conditions=json.dumps(body.conditions) if body.conditions else "{}",
        actions=json.dumps(body.actions) if body.actions else "[]",
        time_window=body.time_window,
        threshold_amount=body.threshold_amount,
        threshold_count=body.threshold_count,
        detection_count=0,
    )
    db.add(r)
    db.commit()
    return {"id": r.id, "name": r.name}


@router.put("/{rule_id}")
def update_rule(rule_id: str, body: RuleUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    r = db.query(Rule).filter(Rule.id == rule_id).first()
    if not r:
        raise HTTPException(404, "Rule not found")
    for field in ["name", "description", "category", "subcategory", "severity", "is_enabled", "priority", "time_window", "threshold_amount", "threshold_count"]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(r, field, val)
    if body.conditions is not None:
        r.conditions = json.dumps(body.conditions)
    if body.actions is not None:
        r.actions = json.dumps(body.actions)
    db.commit()
    return {"id": r.id, "name": r.name}


@router.delete("/{rule_id}")
def delete_rule(rule_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    r = db.query(Rule).filter(Rule.id == rule_id).first()
    if not r:
        raise HTTPException(404, "Rule not found")
    db.delete(r)
    db.commit()
    return {"deleted": True, "id": rule_id}


@router.post("/{rule_id}/toggle")
def toggle_rule(rule_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    r = db.query(Rule).filter(Rule.id == rule_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Rule not found")
    r.is_enabled = not r.is_enabled
    db.commit()
    return {"id": r.id, "is_enabled": r.is_enabled}


@router.get("/scenarios/list")
def list_scenarios(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    scenarios = db.query(Scenario).order_by(Scenario.name).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "category": s.category,
            "rule_ids": json.loads(s.rule_ids) if s.rule_ids else [],
            "is_enabled": s.is_enabled,
            "detection_count": s.detection_count or 0,
            "last_triggered_at": s.last_triggered_at.isoformat() if s.last_triggered_at else None,
        }
        for s in scenarios
    ]
