import json
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Rule, Scenario, User

router = APIRouter(prefix="/rules", tags=["Rules Engine"])


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
