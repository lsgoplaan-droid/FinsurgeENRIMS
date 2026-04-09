"""
Additional feature endpoints:
F2: Transaction simulation/replay
F6: CSV export
F7: Bulk customer import
F9: Risk score recalculation
F11: Scheduled reports summary
"""
import uuid
import csv
import io
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Transaction, Customer, Account, Alert, Case, Rule, User
from app.engine.evaluator import evaluate_transaction

router = APIRouter(tags=["Features"])


# ── F2: Transaction Simulation ──────────────────────────────────────────────

@router.post("/transactions/simulate")
def simulate_transaction(
    rule_id: str = Query(None, description="Test against a specific rule only"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Simulate batch of transactions to test rules without creating real data.
    Replays recent transactions against current rules and shows what WOULD trigger.
    """
    # Get recent transactions to replay
    recent = db.query(Transaction).order_by(Transaction.transaction_date.desc()).limit(100).all()

    results = []
    rules = db.query(Rule).filter(Rule.is_enabled == True).all()
    if rule_id:
        rules = [r for r in rules if r.id == rule_id]

    for txn in recent[:50]:
        from app.engine.evaluator import _build_context, _evaluate_condition, _compute_aggregates
        context = _build_context(db, txn)
        customer = db.query(Customer).filter(Customer.id == txn.customer_id).first()

        matched = []
        for rule in rules:
            conditions = json.loads(rule.conditions) if rule.conditions else {}
            if not conditions:
                continue
            tw = rule.time_window or "24h"
            aggregates = _compute_aggregates(db, txn.customer_id, txn.account_id, tw)
            if _evaluate_condition(conditions, context, aggregates):
                matched.append({"rule_name": rule.name, "severity": rule.severity, "category": rule.category})

        if matched:
            results.append({
                "transaction_ref": txn.transaction_ref,
                "customer_name": customer.full_name if customer else "",
                "amount": txn.amount,
                "channel": txn.channel,
                "method": txn.transaction_method,
                "date": txn.transaction_date.isoformat() if txn.transaction_date else None,
                "rules_matched": len(matched),
                "matched_rules": matched,
            })

    return {
        "simulation_mode": True,
        "transactions_tested": min(len(recent), 50),
        "rules_tested": len(rules),
        "matches_found": len(results),
        "results": results[:25],
    }


# ── F6: CSV Export ──────────────────────────────────────────────────────────

@router.get("/export/transactions")
def export_transactions_csv(
    channel: str = Query(None),
    is_flagged: bool = Query(None),
    date_from: str = Query(None),
    date_to: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export transactions as CSV."""
    query = db.query(Transaction)
    if channel:
        query = query.filter(Transaction.channel == channel)
    if is_flagged is not None:
        query = query.filter(Transaction.is_flagged == is_flagged)
    if date_from:
        query = query.filter(Transaction.transaction_date >= date_from)
    if date_to:
        query = query.filter(Transaction.transaction_date <= date_to)

    txns = query.order_by(Transaction.transaction_date.desc()).limit(10000).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Ref", "Date", "Customer ID", "Account ID", "Type", "Method", "Channel", "Amount (INR)", "Risk Score", "Flagged", "Flag Reason", "City", "Country"])

    for t in txns:
        writer.writerow([
            t.transaction_ref, t.transaction_date.isoformat() if t.transaction_date else "",
            t.customer_id, t.account_id, t.transaction_type, t.transaction_method,
            t.channel, t.amount / 100, t.risk_score or 0, t.is_flagged,
            t.flag_reason or "", t.location_city or "", t.location_country or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=transactions_{datetime.utcnow().strftime('%Y%m%d')}.csv"},
    )


@router.get("/export/alerts")
def export_alerts_csv(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Export alerts as CSV."""
    alerts = db.query(Alert).order_by(Alert.created_at.desc()).limit(5000).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Alert #", "Created", "Type", "Priority", "Status", "Customer ID", "Title", "Risk Score", "Assigned To", "SLA Due", "Overdue"])

    for a in alerts:
        writer.writerow([
            a.alert_number, a.created_at.isoformat() if a.created_at else "",
            a.alert_type, a.priority, a.status, a.customer_id, a.title,
            a.risk_score or 0, a.assigned_to or "", a.sla_due_at.isoformat() if a.sla_due_at else "", a.is_overdue,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=alerts_{datetime.utcnow().strftime('%Y%m%d')}.csv"},
    )


@router.get("/export/customers")
def export_customers_csv(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Export customers as CSV (PII masked)."""
    from app.utils.masking import mask_pan, mask_phone, mask_email
    customers = db.query(Customer).filter(Customer.is_active == True).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Customer #", "Name", "Type", "PAN (masked)", "Phone (masked)", "Email (masked)", "City", "Risk Category", "Risk Score", "KYC Status", "PEP"])

    for c in customers:
        writer.writerow([
            c.customer_number, c.full_name, c.customer_type,
            mask_pan(c.pan_number), mask_phone(c.phone), mask_email(c.email),
            c.city, c.risk_category, c.risk_score or 0, c.kyc_status, c.pep_status,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=customers_{datetime.utcnow().strftime('%Y%m%d')}.csv"},
    )


# ── F9: Risk Score Recalculation ────────────────────────────────────────────

@router.post("/customers/recalculate-risk")
def recalculate_risk_scores(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Recalculate risk scores for all customers based on recent activity.
    In production, this runs as a daily scheduled job.
    """
    customers = db.query(Customer).filter(Customer.is_active == True).all()
    updated = 0
    since_90d = datetime.utcnow() - timedelta(days=90)

    for c in customers:
        # Average transaction risk over 90 days
        avg_txn_risk = db.query(func.avg(Transaction.risk_score)).filter(
            Transaction.customer_id == c.id,
            Transaction.transaction_date >= since_90d,
        ).scalar() or 0

        # Alert frequency factor
        alert_count = db.query(func.count(Alert.id)).filter(
            Alert.customer_id == c.id,
            Alert.created_at >= since_90d,
        ).scalar() or 0
        alert_factor = min(alert_count * 3, 30)

        # KYC risk numeric
        kyc_risk = {"low": 5, "medium": 15, "high": 30, "very_high": 45}.get(c.risk_category, 5)

        # PEP / profile factors
        profile_factor = 0
        if c.pep_status:
            profile_factor += 20

        # Weighted score
        new_score = round(
            0.4 * avg_txn_risk +
            0.2 * kyc_risk +
            0.2 * alert_factor +
            0.1 * profile_factor +
            0.1 * 10,  # base
            1
        )
        new_score = max(0, min(100, new_score))

        if abs((c.risk_score or 0) - new_score) > 0.5:
            c.risk_score = new_score
            if new_score >= 75:
                c.risk_category = "very_high"
            elif new_score >= 50:
                c.risk_category = "high"
            elif new_score >= 25:
                c.risk_category = "medium"
            else:
                c.risk_category = "low"
            updated += 1

    db.commit()
    return {"customers_evaluated": len(customers), "customers_updated": updated}


# ── F11: Report Summary ────────────────────────────────────────────────────

@router.get("/reports/scheduled-summary")
def scheduled_report_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Generate a summary report suitable for daily/weekly email delivery.
    In production, a scheduler (cron/Celery) calls this and emails the result.
    """
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    # Today's stats
    alerts_today = db.query(func.count(Alert.id)).filter(Alert.created_at >= today).scalar() or 0
    txns_today = db.query(func.count(Transaction.id)).filter(Transaction.transaction_date >= today).scalar() or 0
    flagged_today = db.query(func.count(Transaction.id)).filter(Transaction.transaction_date >= today, Transaction.is_flagged == True).scalar() or 0

    # Weekly stats
    alerts_week = db.query(func.count(Alert.id)).filter(Alert.created_at >= week_ago).scalar() or 0
    cases_opened_week = db.query(func.count(Case.id)).filter(Case.created_at >= week_ago).scalar() or 0
    cases_closed_week = db.query(func.count(Case.id)).filter(
        Case.closed_at.isnot(None), Case.closed_at >= week_ago
    ).scalar() or 0

    # Open items
    open_alerts = db.query(func.count(Alert.id)).filter(
        ~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"])
    ).scalar() or 0
    overdue_alerts = db.query(func.count(Alert.id)).filter(Alert.is_overdue == True).scalar() or 0
    open_cases = db.query(func.count(Case.id)).filter(
        ~Case.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"])
    ).scalar() or 0

    # Top triggered rules this week
    top_rules = (
        db.query(Rule.name, Rule.severity, Rule.detection_count)
        .filter(Rule.last_triggered_at >= week_ago)
        .order_by(Rule.detection_count.desc())
        .limit(5)
        .all()
    )

    return {
        "report_type": "daily_summary",
        "generated_at": now.isoformat(),
        "today": {
            "alerts": alerts_today,
            "transactions": txns_today,
            "flagged_transactions": flagged_today,
        },
        "this_week": {
            "alerts_generated": alerts_week,
            "cases_opened": cases_opened_week,
            "cases_closed": cases_closed_week,
        },
        "current_status": {
            "open_alerts": open_alerts,
            "overdue_alerts": overdue_alerts,
            "open_cases": open_cases,
        },
        "top_triggered_rules": [
            {"name": name, "severity": sev, "detections": cnt}
            for name, sev, cnt in top_rules
        ],
    }
