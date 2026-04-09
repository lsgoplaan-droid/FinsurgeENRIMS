"""
Alert Tuning Dashboard — Per-rule TP/FP rates, detection effectiveness,
threshold suggestions for rule optimization.
"""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, case as sql_case
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Alert, Rule, User

router = APIRouter(prefix="/alert-tuning", tags=["Alert Tuning"])


class RuleTuneRequest(BaseModel):
    threshold_amount: Optional[int] = None
    threshold_count: Optional[int] = None
    time_window: Optional[str] = None
    severity: Optional[str] = None
    is_enabled: Optional[bool] = None


@router.put("/rules/{rule_id}/tune")
def tune_rule(rule_id: str, body: RuleTuneRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Tune a rule's thresholds, severity, time window, or enabled state."""
    r = db.query(Rule).filter(Rule.id == rule_id).first()
    if not r:
        raise HTTPException(404, "Rule not found")
    changes = []
    if body.threshold_amount is not None and body.threshold_amount != r.threshold_amount:
        old = r.threshold_amount
        r.threshold_amount = body.threshold_amount
        changes.append(f"threshold_amount: {old} → {body.threshold_amount}")
    if body.threshold_count is not None and body.threshold_count != r.threshold_count:
        old = r.threshold_count
        r.threshold_count = body.threshold_count
        changes.append(f"threshold_count: {old} → {body.threshold_count}")
    if body.time_window is not None and body.time_window != r.time_window:
        old = r.time_window
        r.time_window = body.time_window
        changes.append(f"time_window: {old} → {body.time_window}")
    if body.severity is not None and body.severity != r.severity:
        old = r.severity
        r.severity = body.severity
        changes.append(f"severity: {old} → {body.severity}")
    if body.is_enabled is not None and body.is_enabled != r.is_enabled:
        r.is_enabled = body.is_enabled
        changes.append(f"enabled: {r.is_enabled}")
    db.commit()
    return {"id": r.id, "name": r.name, "changes": changes}


@router.post("/rules/{rule_id}/toggle")
def toggle_tuning_rule(rule_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Toggle a rule from the tuning page."""
    r = db.query(Rule).filter(Rule.id == rule_id).first()
    if not r:
        raise HTTPException(404, "Rule not found")
    r.is_enabled = not r.is_enabled
    db.commit()
    return {"id": r.id, "is_enabled": r.is_enabled}


@router.get("/rule-performance")
def get_rule_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Per-rule TP/FP/Inconclusive rates and detection effectiveness."""
    rules = db.query(Rule).all()

    result = []
    for rule in rules:
        alerts = db.query(Alert).filter(Alert.rule_id == rule.id).all()
        total = len(alerts)
        if total == 0:
            result.append({
                "rule_id": rule.id,
                "rule_name": rule.name,
                "category": rule.category,
                "severity": rule.severity,
                "is_enabled": rule.is_enabled,
                "total_alerts": 0,
                "true_positive": 0,
                "false_positive": 0,
                "inconclusive": 0,
                "open": 0,
                "tp_rate": 0,
                "fp_rate": 0,
                "precision": 0,
                "detection_count": rule.detection_count or 0,
                "suggestion": None,
            })
            continue

        tp = sum(1 for a in alerts if a.status == "closed_true_positive")
        fp = sum(1 for a in alerts if a.status == "closed_false_positive")
        inc = sum(1 for a in alerts if a.status == "closed_inconclusive")
        open_count = total - tp - fp - inc

        closed = tp + fp + inc
        tp_rate = round(tp / closed * 100, 1) if closed > 0 else 0
        fp_rate = round(fp / closed * 100, 1) if closed > 0 else 0
        precision = round(tp / (tp + fp) * 100, 1) if (tp + fp) > 0 else 0

        # Generate threshold suggestion based on FP rate
        suggestion = None
        if closed >= 3:
            if fp_rate > 70:
                suggestion = "High false positive rate — consider raising threshold or adding conditions"
            elif fp_rate > 50:
                suggestion = "Moderate FP rate — review rule conditions for over-triggering patterns"
            elif tp_rate > 80:
                suggestion = "Excellent precision — consider lowering threshold to catch more"
            elif tp_rate == 0 and closed > 5:
                suggestion = "Zero true positives — rule may need redesign or disabling"

        result.append({
            "rule_id": rule.id,
            "rule_name": rule.name,
            "category": rule.category,
            "severity": rule.severity,
            "is_enabled": rule.is_enabled,
            "total_alerts": total,
            "true_positive": tp,
            "false_positive": fp,
            "inconclusive": inc,
            "open": open_count,
            "tp_rate": tp_rate,
            "fp_rate": fp_rate,
            "precision": precision,
            "detection_count": rule.detection_count or 0,
            "suggestion": suggestion,
        })

    # Sort by total alerts descending so busiest rules come first
    result.sort(key=lambda r: r["total_alerts"], reverse=True)
    return {"rules": result, "total": len(result)}


@router.get("/summary")
def get_tuning_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregate tuning metrics across all rules."""
    total_alerts = db.query(func.count(Alert.id)).scalar() or 0
    tp_total = db.query(func.count(Alert.id)).filter(Alert.status == "closed_true_positive").scalar() or 0
    fp_total = db.query(func.count(Alert.id)).filter(Alert.status == "closed_false_positive").scalar() or 0
    inc_total = db.query(func.count(Alert.id)).filter(Alert.status == "closed_inconclusive").scalar() or 0
    open_total = total_alerts - tp_total - fp_total - inc_total

    closed_total = tp_total + fp_total + inc_total
    overall_tp_rate = round(tp_total / closed_total * 100, 1) if closed_total > 0 else 0
    overall_fp_rate = round(fp_total / closed_total * 100, 1) if closed_total > 0 else 0
    overall_precision = round(tp_total / (tp_total + fp_total) * 100, 1) if (tp_total + fp_total) > 0 else 0

    total_rules = db.query(func.count(Rule.id)).scalar() or 0
    enabled_rules = db.query(func.count(Rule.id)).filter(Rule.is_enabled == True).scalar() or 0

    # Rules with alerts
    rules_with_alerts = db.query(func.count(func.distinct(Alert.rule_id))).filter(Alert.rule_id.isnot(None)).scalar() or 0

    # Category breakdown
    cat_data = (
        db.query(
            Rule.category,
            func.count(Alert.id).label("alert_count"),
        )
        .outerjoin(Alert, Alert.rule_id == Rule.id)
        .group_by(Rule.category)
        .all()
    )
    by_category = {cat: count for cat, count in cat_data if cat}

    return {
        "total_alerts": total_alerts,
        "true_positive": tp_total,
        "false_positive": fp_total,
        "inconclusive": inc_total,
        "open": open_total,
        "overall_tp_rate": overall_tp_rate,
        "overall_fp_rate": overall_fp_rate,
        "overall_precision": overall_precision,
        "total_rules": total_rules,
        "enabled_rules": enabled_rules,
        "rules_with_alerts": rules_with_alerts,
        "alerts_by_category": by_category,
    }
