"""
AI Agent — Intelligent analysis assistant for fraud investigation.
Provides: risk assessment, pattern analysis, investigation recommendations,
SAR narrative generation, and anomaly insights.
"""
import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Customer, Transaction, Alert, Case, Rule, User

router = APIRouter(prefix="/ai-agent", tags=["AI Agent"])


@router.post("/analyze-customer")
def analyze_customer(
    customer_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """AI-powered customer risk analysis with recommendations."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return {"error": "Customer not found"}

    # Gather intelligence
    since_90d = datetime.utcnow() - timedelta(days=90)
    txn_count = db.query(func.count(Transaction.id)).filter(Transaction.customer_id == customer_id, Transaction.transaction_date >= since_90d).scalar() or 0
    flagged_count = db.query(func.count(Transaction.id)).filter(Transaction.customer_id == customer_id, Transaction.is_flagged == True).scalar() or 0
    alert_count = db.query(func.count(Alert.id)).filter(Alert.customer_id == customer_id).scalar() or 0
    case_count = db.query(func.count(Case.id)).filter(Case.customer_id == customer_id).scalar() or 0
    total_volume = db.query(func.sum(Transaction.amount)).filter(Transaction.customer_id == customer_id, Transaction.transaction_date >= since_90d).scalar() or 0

    # Channel analysis
    channels = dict(db.query(Transaction.channel, func.count(Transaction.id)).filter(Transaction.customer_id == customer_id).group_by(Transaction.channel).all())

    # Risk factors
    risk_factors = []
    recommendations = []

    if customer.pep_status:
        risk_factors.append({"factor": "PEP Status", "severity": "high", "detail": "Customer is a Politically Exposed Person requiring Enhanced Due Diligence"})
        recommendations.append("Ensure EDD review is current and all source-of-wealth documentation is verified")

    if customer.risk_score and customer.risk_score > 70:
        risk_factors.append({"factor": "High Risk Score", "severity": "critical", "detail": f"Risk score {customer.risk_score:.0f}/100 exceeds critical threshold"})
        recommendations.append("Escalate to Compliance Head for review. Consider filing STR if suspicious pattern confirmed")

    if flagged_count > 5:
        risk_factors.append({"factor": "Multiple Flagged Transactions", "severity": "high", "detail": f"{flagged_count} flagged transactions in 90 days"})
        recommendations.append("Review all flagged transactions. Look for structuring, layering, or velocity patterns")

    if customer.kyc_status == "expired":
        risk_factors.append({"factor": "Expired KYC", "severity": "high", "detail": "KYC review has expired. Transactions should be restricted per RBI direction"})
        recommendations.append("Initiate immediate KYC review. Restrict non-essential transactions until KYC is renewed")

    if total_volume > (customer.annual_income or 0) * 2:
        risk_factors.append({"factor": "Volume Exceeds Income", "severity": "medium", "detail": f"Transaction volume {total_volume/100:.0f} INR exceeds 2x declared annual income"})
        recommendations.append("Request source of funds documentation. Compare with tax returns")

    if alert_count > 3 and case_count == 0:
        risk_factors.append({"factor": "Uninvestigated Alerts", "severity": "medium", "detail": f"{alert_count} alerts but no cases opened"})
        recommendations.append("Consolidate related alerts into an investigation case")

    # Pattern insights
    patterns = []
    cash_pct = channels.get("branch", 0) + channels.get("atm", 0)
    digital_pct = channels.get("internet_banking", 0) + channels.get("mobile_banking", 0)
    if txn_count > 0:
        if cash_pct / txn_count > 0.6:
            patterns.append({"type": "Cash-Heavy Profile", "detail": f"{cash_pct/txn_count*100:.0f}% of transactions are cash-based. Unusual for declared occupation: {customer.occupation}"})
        if channels.get("swift", 0) > 0 and customer.customer_type == "individual":
            patterns.append({"type": "International Wire Activity", "detail": f"Individual customer with SWIFT transactions. Verify foreign exchange compliance"})

    if not risk_factors:
        risk_factors.append({"factor": "Low Risk Profile", "severity": "low", "detail": "No significant risk factors identified"})
        recommendations.append("Continue routine monitoring. Next periodic review as per KYC schedule")

    # Overall assessment
    if customer.risk_score and customer.risk_score > 75:
        overall = "CRITICAL — Immediate investigation recommended"
    elif customer.risk_score and customer.risk_score > 50:
        overall = "HIGH — Enhanced monitoring and review required"
    elif customer.risk_score and customer.risk_score > 25:
        overall = "MEDIUM — Standard monitoring with periodic review"
    else:
        overall = "LOW — Routine monitoring sufficient"

    return {
        "customer_name": customer.full_name,
        "customer_number": customer.customer_number,
        "overall_assessment": overall,
        "risk_score": customer.risk_score or 0,
        "risk_category": customer.risk_category,
        "analysis_summary": {
            "transactions_90d": txn_count,
            "flagged_transactions": flagged_count,
            "total_alerts": alert_count,
            "open_cases": case_count,
            "transaction_volume_90d": total_volume,
            "channel_distribution": channels,
        },
        "risk_factors": risk_factors,
        "behavioral_patterns": patterns,
        "recommendations": recommendations,
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.post("/generate-sar-narrative")
def generate_sar_narrative(
    customer_id: str = Query(...),
    case_id: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a SAR/STR narrative from customer and case data."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return {"error": "Customer not found"}

    since_90d = datetime.utcnow() - timedelta(days=90)
    flagged_txns = db.query(Transaction).filter(
        Transaction.customer_id == customer_id, Transaction.is_flagged == True
    ).order_by(Transaction.transaction_date).all()

    total_suspicious = sum(t.amount for t in flagged_txns)
    alerts = db.query(Alert).filter(Alert.customer_id == customer_id).all()
    alert_types = list(set(a.alert_type for a in alerts))

    # Build narrative
    date_range = ""
    if flagged_txns:
        first = flagged_txns[0].transaction_date.strftime("%d-%b-%Y") if flagged_txns[0].transaction_date else ""
        last = flagged_txns[-1].transaction_date.strftime("%d-%b-%Y") if flagged_txns[-1].transaction_date else ""
        date_range = f"{first} to {last}"

    methods = list(set(t.transaction_method for t in flagged_txns))
    channels = list(set(t.channel for t in flagged_txns))

    narrative = f"""SUSPICIOUS TRANSACTION REPORT

Subject: {customer.full_name} ({customer.customer_number})
Customer Type: {customer.customer_type.title()}
PAN: {customer.pan_number or 'Not available'}
Address: {customer.city or ''}, {customer.state or ''}, India

Period of Suspicious Activity: {date_range}
Total Suspicious Amount: INR {total_suspicious / 100:,.0f}

DESCRIPTION OF SUSPICIOUS ACTIVITY:

During the review period, the FinsurgeFRIMS monitoring system detected {len(flagged_txns)} suspicious transactions associated with the above-named customer, totaling INR {total_suspicious / 100:,.0f}. The suspicious activity was identified through automated detection rules covering {', '.join(alert_types)} categories.

The transactions involved the following methods: {', '.join(methods)} through {', '.join(channels)} channels.

{'The customer is classified as a Politically Exposed Person (PEP), requiring Enhanced Due Diligence under RBI KYC Master Direction.' if customer.pep_status else ''}

The customer's risk score is currently {customer.risk_score:.0f}/100, classified as {customer.risk_category.replace('_', ' ').upper()} risk.

A total of {len(alerts)} alerts were generated by the automated monitoring system. {'A formal investigation case has been opened.' if any(a.case_id for a in alerts) else 'Investigation is pending.'}

The activity pattern is consistent with {', '.join(alert_types)} typologies as defined by FATF and RBI guidelines.

RECOMMENDED ACTION:
- File this STR with FIU-IND within the prescribed timeline
- Restrict account operations pending investigation outcome
- Preserve all transaction records for minimum 5 years as per PMLA Section 12
- Notify the Principal Officer as required under PMLA Act 2002

Report generated by FinsurgeFRIMS on {datetime.utcnow().strftime('%d-%b-%Y at %H:%M UTC')}
Prepared by: {current_user.full_name}"""

    return {
        "narrative": narrative,
        "customer_name": customer.full_name,
        "total_suspicious_amount": total_suspicious,
        "flagged_transactions": len(flagged_txns),
        "alert_count": len(alerts),
        "date_range": date_range,
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.get("/anomaly-summary")
def get_anomaly_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """AI-detected anomaly summary across the bank."""
    since_7d = datetime.utcnow() - timedelta(days=7)

    high_risk_customers = db.query(Customer).filter(Customer.risk_score > 70).count()
    new_alerts = db.query(func.count(Alert.id)).filter(Alert.created_at >= since_7d).scalar() or 0
    flagged_txns = db.query(func.count(Transaction.id)).filter(Transaction.is_flagged == True, Transaction.transaction_date >= since_7d).scalar() or 0

    # Top anomalies
    top_rules = db.query(Rule.name, Rule.category, Rule.detection_count).order_by(Rule.detection_count.desc()).limit(5).all()

    return {
        "period": "Last 7 days",
        "high_risk_customers": high_risk_customers,
        "new_alerts": new_alerts,
        "flagged_transactions": flagged_txns,
        "top_triggered_rules": [
            {"rule": name, "category": cat, "detections": cnt or 0}
            for name, cat, cnt in top_rules
        ],
        "insights": [
            {"type": "trend", "message": f"{new_alerts} new alerts generated this week. {'Increasing trend detected.' if new_alerts > 20 else 'Within normal range.'}"},
            {"type": "pattern", "message": f"{high_risk_customers} customers currently above critical risk threshold (70+)."},
            {"type": "recommendation", "message": "Review overdue SLA items. Run weekly risk recalculation for updated scores."},
        ],
    }
