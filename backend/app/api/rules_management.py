"""
Enhanced Rules Management — Full CRUD for detection rules, rule versioning,
testing, and bulk operations.
"""
import uuid
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel
from typing import Optional, Any
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, Rule, Scenario, Alert

router = APIRouter(prefix="/rules-management", tags=["Rules Management"])

# Industry-standard rule categories with descriptions
RULE_CATEGORIES = [
    {"code": "aml", "label": "Anti-Money Laundering", "subcategories": [
        {"code": "structuring", "label": "Structuring / Smurfing"},
        {"code": "layering", "label": "Layering / Placement"},
        {"code": "geographic", "label": "Geographic Risk"},
        {"code": "trade_based", "label": "Trade-Based Money Laundering"},
        {"code": "hawala", "label": "Hawala / Informal Value Transfer"},
        {"code": "shell_company", "label": "Shell Company / Benami"},
    ]},
    {"code": "fraud", "label": "Fraud Detection", "subcategories": [
        {"code": "card", "label": "Card Fraud"},
        {"code": "account_takeover", "label": "Account Takeover"},
        {"code": "wire", "label": "Wire / Transfer Fraud"},
        {"code": "upi", "label": "UPI Fraud"},
        {"code": "loan", "label": "Loan Fraud"},
        {"code": "insurance", "label": "Insurance Fraud"},
        {"code": "phishing", "label": "Phishing / Social Engineering"},
        {"code": "sim_swap", "label": "SIM Swap"},
        {"code": "mule_account", "label": "Mule Account"},
        {"code": "first_party", "label": "First Party Fraud"},
    ]},
    {"code": "kyc", "label": "KYC / CDD", "subcategories": [
        {"code": "pep", "label": "PEP Monitoring"},
        {"code": "cdd", "label": "Customer Due Diligence"},
        {"code": "edd", "label": "Enhanced Due Diligence"},
        {"code": "beneficial_ownership", "label": "Beneficial Ownership"},
    ]},
    {"code": "compliance", "label": "Regulatory Compliance", "subcategories": [
        {"code": "sanctions", "label": "Sanctions Screening"},
        {"code": "dormant", "label": "Dormant Account"},
        {"code": "tax_evasion", "label": "Tax Evasion"},
        {"code": "insider", "label": "Insider Trading"},
    ]},
    {"code": "operational", "label": "Operational Risk", "subcategories": [
        {"code": "velocity", "label": "Transaction Velocity"},
        {"code": "after_hours", "label": "After Hours Activity"},
        {"code": "channel_anomaly", "label": "Channel Anomaly"},
        {"code": "behavioral", "label": "Behavioral Anomaly"},
    ]},
]

CONDITION_OPERATORS = [
    {"code": "equals", "label": "Equals", "types": ["string", "number"]},
    {"code": "not_equals", "label": "Not Equals", "types": ["string", "number"]},
    {"code": "greater_than", "label": "Greater Than", "types": ["number"]},
    {"code": "greater_than_or_equal", "label": "Greater Than or Equal", "types": ["number"]},
    {"code": "less_than", "label": "Less Than", "types": ["number"]},
    {"code": "less_than_or_equal", "label": "Less Than or Equal", "types": ["number"]},
    {"code": "between", "label": "Between", "types": ["number"]},
    {"code": "in", "label": "In List", "types": ["string"]},
    {"code": "not_in", "label": "Not In List", "types": ["string"]},
    {"code": "contains", "label": "Contains", "types": ["string"]},
]

CONDITION_FIELDS = [
    {"field": "amount", "label": "Transaction Amount (paise)", "type": "number"},
    {"field": "channel", "label": "Channel", "type": "string", "options": ["branch", "atm", "internet_banking", "mobile_banking", "upi", "swift", "pos", "imps", "neft", "rtgs"]},
    {"field": "transaction_type", "label": "Transaction Type", "type": "string", "options": ["credit", "debit"]},
    {"field": "method", "label": "Payment Method", "type": "string", "options": ["cash", "cheque", "dd", "neft", "rtgs", "imps", "upi", "swift", "card", "standing_instruction"]},
    {"field": "location_country", "label": "Location Country", "type": "string"},
    {"field": "location_city", "label": "Location City", "type": "string"},
    {"field": "is_international", "label": "Is International", "type": "boolean"},
    {"field": "risk_score", "label": "Risk Score", "type": "number"},
    {"field": "customer.risk_category", "label": "Customer Risk Category", "type": "string", "options": ["low", "medium", "high", "very_high"]},
    {"field": "customer.kyc_status", "label": "Customer KYC Status", "type": "string", "options": ["approved", "pending", "expired", "rejected"]},
    {"field": "customer.pep_status", "label": "Customer PEP Status", "type": "boolean"},
    {"field": "customer.occupation", "label": "Customer Occupation", "type": "string"},
    {"field": "account.account_type", "label": "Account Type", "type": "string", "options": ["savings", "current", "fd", "rd", "nre", "nro", "loan", "credit_card"]},
    {"field": "account.status", "label": "Account Status", "type": "string", "options": ["active", "frozen", "dormant", "closed"]},
    {"field": "agg.transaction_count", "label": "Transaction Count (window)", "type": "number"},
    {"field": "agg.transaction_sum", "label": "Transaction Sum (window)", "type": "number"},
    {"field": "agg.cash_transaction_count", "label": "Cash Transaction Count", "type": "number"},
    {"field": "agg.cash_transaction_sum", "label": "Cash Transaction Sum", "type": "number"},
    {"field": "agg.unique_counterparties", "label": "Unique Counterparties", "type": "number"},
    {"field": "agg.unique_channels", "label": "Unique Channels", "type": "number"},
    {"field": "agg.unique_locations", "label": "Unique Locations", "type": "number"},
    {"field": "agg.round_amount_count", "label": "Round Amount Count", "type": "number"},
    {"field": "device_id", "label": "Device ID", "type": "string"},
    {"field": "ip_address", "label": "IP Address", "type": "string"},
]

RULE_ACTIONS = [
    {"code": "create_alert", "label": "Create Alert"},
    {"code": "flag_transaction", "label": "Flag Transaction"},
    {"code": "generate_ctr", "label": "Generate CTR Report"},
    {"code": "trigger_edd", "label": "Trigger Enhanced Due Diligence"},
    {"code": "adjust_risk_score", "label": "Adjust Customer Risk Score"},
    {"code": "freeze_account", "label": "Freeze Account"},
    {"code": "block_transaction", "label": "Block Transaction"},
    {"code": "notify_rm", "label": "Notify Relationship Manager"},
    {"code": "notify_compliance", "label": "Notify Compliance Officer"},
    {"code": "notify_risk_manager", "label": "Notify Risk Manager"},
    {"code": "escalate_to_management", "label": "Escalate to Management"},
]


class RuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    subcategory: Optional[str] = None
    severity: str = "medium"
    priority: int = 30
    conditions: Any  # JSON condition tree
    actions: Any  # JSON action list
    time_window: Optional[str] = None
    threshold_amount: Optional[int] = None
    threshold_count: Optional[int] = None
    is_enabled: bool = True


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    severity: Optional[str] = None
    priority: Optional[int] = None
    conditions: Optional[Any] = None
    actions: Optional[Any] = None
    time_window: Optional[str] = None
    threshold_amount: Optional[int] = None
    threshold_count: Optional[int] = None
    is_enabled: Optional[bool] = None


@router.get("/reference-data")
def rule_reference_data(current_user: User = Depends(get_current_user)):
    """Reference data for rule builder forms."""
    return {
        "categories": RULE_CATEGORIES,
        "operators": CONDITION_OPERATORS,
        "fields": CONDITION_FIELDS,
        "actions": RULE_ACTIONS,
        "severities": [
            {"code": "critical", "label": "Critical", "sla_hours": 4},
            {"code": "high", "label": "High", "sla_hours": 24},
            {"code": "medium", "label": "Medium", "sla_hours": 72},
            {"code": "low", "label": "Low", "sla_hours": 168},
        ],
        "time_windows": [
            {"code": "10m", "label": "10 Minutes"},
            {"code": "30m", "label": "30 Minutes"},
            {"code": "1h", "label": "1 Hour"},
            {"code": "6h", "label": "6 Hours"},
            {"code": "24h", "label": "24 Hours"},
            {"code": "7d", "label": "7 Days"},
            {"code": "30d", "label": "30 Days"},
            {"code": "90d", "label": "90 Days"},
        ],
    }


@router.get("/list")
def list_rules(
    category: str = None,
    severity: str = None,
    is_enabled: str = None,
    search: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all detection rules with performance stats."""
    q = db.query(Rule)
    if category:
        q = q.filter(Rule.category == category)
    if severity:
        q = q.filter(Rule.severity == severity)
    if is_enabled is not None:
        q = q.filter(Rule.is_enabled == (is_enabled == "true"))
    if search:
        q = q.filter(Rule.name.ilike(f"%{search}%"))

    rules = q.order_by(Rule.priority, Rule.name).all()

    items = []
    for r in rules:
        alerts = db.query(Alert).filter(Alert.rule_id == r.id).all()
        total = len(alerts)
        tp = sum(1 for a in alerts if a.status == "closed_true_positive")
        fp = sum(1 for a in alerts if a.status == "closed_false_positive")
        reviewed = tp + fp + sum(1 for a in alerts if a.status == "closed_inconclusive")

        items.append({
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "category": r.category,
            "subcategory": r.subcategory,
            "severity": r.severity,
            "priority": r.priority,
            "is_enabled": r.is_enabled,
            "conditions": json.loads(r.conditions) if isinstance(r.conditions, str) else r.conditions,
            "actions": json.loads(r.actions) if isinstance(r.actions, str) else r.actions,
            "time_window": r.time_window,
            "threshold_amount": r.threshold_amount,
            "threshold_count": r.threshold_count,
            "detection_count": r.detection_count or 0,
            "last_triggered_at": r.last_triggered_at.isoformat() if r.last_triggered_at else None,
            "total_alerts": total,
            "tp_count": tp,
            "fp_count": fp,
            "tp_rate": round(tp / reviewed * 100, 1) if reviewed else 0,
            "precision": round(tp / (tp + fp) * 100, 1) if (tp + fp) > 0 else 0,
        })

    summary = {
        "total": len(items),
        "enabled": sum(1 for i in items if i["is_enabled"]),
        "disabled": sum(1 for i in items if not i["is_enabled"]),
        "by_category": {},
        "by_severity": {},
    }
    for i in items:
        summary["by_category"][i["category"]] = summary["by_category"].get(i["category"], 0) + 1
        summary["by_severity"][i["severity"]] = summary["by_severity"].get(i["severity"], 0) + 1

    return {"rules": items, "summary": summary}


@router.post("/create")
def create_rule(body: RuleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create a new detection rule."""
    # Generate rule ID
    prefix_map = {"aml": "AML", "fraud": "FRD", "kyc": "KYC", "compliance": "CMP", "operational": "OPR"}
    prefix = prefix_map.get(body.category, "GEN")
    sub = (body.subcategory or "GEN")[:3].upper()
    count = db.query(func.count(Rule.id)).filter(Rule.category == body.category).scalar() or 0
    rule_id_str = f"{prefix}-{sub}-{count + 1:03d}"

    rule = Rule(
        id=str(uuid.uuid4()),
        name=body.name,
        description=body.description,
        category=body.category,
        subcategory=body.subcategory,
        severity=body.severity,
        priority=body.priority,
        conditions=json.dumps(body.conditions) if not isinstance(body.conditions, str) else body.conditions,
        actions=json.dumps(body.actions) if not isinstance(body.actions, str) else body.actions,
        time_window=body.time_window,
        threshold_amount=body.threshold_amount,
        threshold_count=body.threshold_count,
        is_enabled=body.is_enabled,
        detection_count=0,
    )
    db.add(rule)
    db.commit()
    return {"id": rule.id, "name": rule.name, "rule_code": rule_id_str}


@router.put("/{rule_id}")
def update_rule(rule_id: str, body: RuleUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update a detection rule."""
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")

    for field, val in body.dict(exclude_unset=True).items():
        if field in ("conditions", "actions") and val is not None:
            val = json.dumps(val) if not isinstance(val, str) else val
        setattr(rule, field, val)
    db.commit()
    return {"id": rule.id, "name": rule.name}


@router.post("/{rule_id}/toggle")
def toggle_rule(rule_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Toggle rule enabled/disabled."""
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")
    rule.is_enabled = not rule.is_enabled
    db.commit()
    return {"id": rule.id, "is_enabled": rule.is_enabled}


@router.post("/{rule_id}/duplicate")
def duplicate_rule(rule_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Duplicate a rule for testing/modification."""
    original = db.query(Rule).filter(Rule.id == rule_id).first()
    if not original:
        raise HTTPException(404, "Rule not found")

    new_rule = Rule(
        id=str(uuid.uuid4()),
        name=f"{original.name} (Copy)",
        description=original.description,
        category=original.category,
        subcategory=original.subcategory,
        severity=original.severity,
        priority=original.priority,
        conditions=original.conditions,
        actions=original.actions,
        time_window=original.time_window,
        threshold_amount=original.threshold_amount,
        threshold_count=original.threshold_count,
        is_enabled=False,  # Disabled by default
        detection_count=0,
    )
    db.add(new_rule)
    db.commit()
    return {"id": new_rule.id, "name": new_rule.name}


@router.delete("/{rule_id}")
def delete_rule(rule_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Delete a detection rule (only if no alerts linked)."""
    rule = db.query(Rule).filter(Rule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Rule not found")

    alert_count = db.query(func.count(Alert.id)).filter(Alert.rule_id == rule.id).scalar() or 0
    if alert_count > 0:
        raise HTTPException(400, f"Cannot delete rule with {alert_count} linked alerts. Disable it instead.")

    db.delete(rule)
    db.commit()
    return {"deleted": True}


@router.get("/scenarios")
def list_scenarios(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List all detection scenarios with their rules."""
    scenarios = db.query(Scenario).order_by(Scenario.name).all()
    items = []
    for s in scenarios:
        rule_ids = json.loads(s.rule_ids) if isinstance(s.rule_ids, str) else (s.rule_ids or [])
        rules = db.query(Rule).filter(Rule.id.in_(rule_ids)).all() if rule_ids else []
        items.append({
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "is_enabled": s.is_enabled,
            "detection_count": s.detection_count or 0,
            "rules": [{
                "id": r.id,
                "name": r.name,
                "severity": r.severity,
                "is_enabled": r.is_enabled,
            } for r in rules],
        })
    return {"scenarios": items}


@router.get("/industry-best-practices")
def industry_best_practices(current_user: User = Depends(get_current_user)):
    """Industry best practices for fraud detection rules — RBI/FATF/Wolfsberg guidance."""
    return {
        "frameworks": [
            {
                "name": "RBI Master Direction on KYC/AML",
                "rules": [
                    "CTR for all cash transactions >= INR 10 lakh",
                    "STR within 7 days of suspicious activity detection",
                    "KYC periodic review: High-risk annually, Medium biennial, Low every 10 years",
                    "Cross-border wire transfer monitoring for all amounts",
                    "PEP enhanced due diligence and senior management approval",
                    "Structuring detection below CTR threshold (INR 9-9.99 lakh pattern)",
                ],
            },
            {
                "name": "FATF 40 Recommendations",
                "rules": [
                    "Risk-based approach to customer due diligence",
                    "Beneficial ownership identification for all legal entities",
                    "Correspondent banking enhanced due diligence",
                    "Wire transfer originator/beneficiary information",
                    "New technologies risk assessment (crypto, digital payments)",
                    "Targeted financial sanctions screening",
                ],
            },
            {
                "name": "Wolfsberg Group Principles",
                "rules": [
                    "Transaction monitoring tuning based on TP/FP rates",
                    "Risk-based alert prioritization",
                    "Periodic model validation and back-testing",
                    "Scenario-based detection (not just threshold rules)",
                    "Network analysis for complex laundering schemes",
                    "Behavioral analytics baseline per customer segment",
                ],
            },
            {
                "name": "RBI Fraud Monitoring (2024 Master Direction)",
                "rules": [
                    "Real-time fraud monitoring for digital transactions",
                    "SMS/Email alerts to customers on all transactions",
                    "Cooling period for new beneficiary transfers",
                    "Device binding and fingerprinting for mobile banking",
                    "Velocity checks on card and UPI transactions",
                    "Geo-fencing for domestic cards used internationally",
                    "FMR-1 reporting within 7 days for frauds > INR 1 lakh",
                    "Flash report to RBI within 3 days for frauds > INR 5 crore",
                ],
            },
            {
                "name": "Indian Cyber Crime Coordination Centre (I4C)",
                "rules": [
                    "1930 helpline integration for reported fraud accounts",
                    "Automated account freeze on confirmed mule accounts",
                    "Cross-bank information sharing via CFCFRMS portal",
                    "Real-time payment hold for flagged UPI transactions",
                    "Cybercrime.gov.in portal complaint integration",
                ],
            },
        ],
        "recommended_rules": [
            {"name": "Mule Account Detection", "category": "fraud", "severity": "critical",
             "description": "Account receiving >5 transfers from different sources within 24h and immediately transferring out 90%+"},
            {"name": "Hawala Pattern Detection", "category": "aml", "severity": "critical",
             "description": "Matching inward/outward cash transactions across geographically distant branches"},
            {"name": "Trade-Based ML — Over/Under Invoicing", "category": "aml", "severity": "high",
             "description": "Trade finance amount significantly deviating from market price for declared goods"},
            {"name": "Shell Company Layering", "category": "aml", "severity": "critical",
             "description": "Multiple transfers between related entities with no apparent business purpose"},
            {"name": "Loan Stacking Fraud", "category": "fraud", "severity": "high",
             "description": "Customer applying for multiple loans across branches/products simultaneously"},
            {"name": "SIM Swap + High Value Transfer", "category": "fraud", "severity": "critical",
             "description": "Mobile banking transfer >INR 2L within 24h of SIM change notification"},
            {"name": "Dormant-to-Active Burst", "category": "compliance", "severity": "high",
             "description": "Dormant account (>12 months) reactivated with >10 transactions in first 48h"},
            {"name": "Beneficiary Concentration", "category": "aml", "severity": "medium",
             "description": "80%+ of outgoing transfers to single beneficiary over 30 days"},
            {"name": "Tax Evasion Pattern", "category": "compliance", "severity": "high",
             "description": "Large cash deposits timed around tax filing deadlines"},
            {"name": "First-Party Fraud — Bust Out", "category": "fraud", "severity": "critical",
             "description": "Credit limit maxed out with cash advance + immediate closure request"},
        ],
    }
