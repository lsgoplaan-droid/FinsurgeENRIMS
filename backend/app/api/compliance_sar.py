"""
Compliance & SAR — Dedicated compliance module with filing workflows,
regulatory calendar, and compliance dashboard.
"""
import random
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models import CTRReport, SARReport, Customer, Alert, Case, User

router = APIRouter(prefix="/compliance", tags=["Compliance & SAR"])


@router.get("/dashboard")
def compliance_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Compliance dashboard — filing status, deadlines, regulatory metrics."""
    now = datetime.utcnow()

    ctr_pending = db.query(func.count(CTRReport.id)).filter(CTRReport.filing_status.in_(["auto_generated", "pending_review"])).scalar() or 0
    ctr_filed = db.query(func.count(CTRReport.id)).filter(CTRReport.filing_status == "filed").scalar() or 0
    sar_pending = db.query(func.count(SARReport.id)).filter(SARReport.filing_status.in_(["draft", "pending_review"])).scalar() or 0
    sar_filed = db.query(func.count(SARReport.id)).filter(SARReport.filing_status == "filed").scalar() or 0

    expired_kyc = db.query(func.count(Customer.id)).filter(Customer.kyc_status == "expired").scalar() or 0
    pep_customers = db.query(func.count(Customer.id)).filter(Customer.pep_status == True).scalar() or 0

    open_investigations = db.query(func.count(Case.id)).filter(
        ~Case.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"])
    ).scalar() or 0

    return {
        "filing_status": {
            "ctr_pending": ctr_pending,
            "ctr_filed": ctr_filed,
            "sar_pending": sar_pending,
            "sar_filed": sar_filed,
        },
        "compliance_metrics": {
            "expired_kyc_customers": expired_kyc,
            "pep_customers": pep_customers,
            "open_investigations": open_investigations,
        },
        "regulatory_deadlines": [
            {"name": "Monthly CTR Batch Filing to FIU-IND", "due_date": (now + timedelta(days=random.randint(5, 15))).strftime("%Y-%m-%d"), "status": "upcoming", "priority": "high"},
            {"name": "Quarterly AML Compliance Report to Board", "due_date": (now + timedelta(days=random.randint(20, 45))).strftime("%Y-%m-%d"), "status": "upcoming", "priority": "medium"},
            {"name": "Annual KYC Review for High-Risk Customers", "due_date": (now + timedelta(days=random.randint(30, 60))).strftime("%Y-%m-%d"), "status": "in_progress", "priority": "high"},
            {"name": "PMLA Principal Officer Report to FIU-IND", "due_date": (now + timedelta(days=random.randint(10, 25))).strftime("%Y-%m-%d"), "status": "upcoming", "priority": "critical"},
            {"name": "RBI Annual Fraud Return Submission", "due_date": (now + timedelta(days=random.randint(40, 90))).strftime("%Y-%m-%d"), "status": "not_started", "priority": "medium"},
            {"name": "Sanctions List Update (OFAC/UN)", "due_date": (now + timedelta(days=random.randint(1, 3))).strftime("%Y-%m-%d"), "status": "scheduled", "priority": "high"},
        ],
        "recent_filings": [
            {"type": "CTR", "report_number": f"CTR-{(now - timedelta(days=i)).strftime('%Y%m%d')}-{1000+i:04d}", "customer": f"Customer {random.randint(1001, 1070)}", "amount": random.randint(1000000, 5000000) * 100, "filed_date": (now - timedelta(days=i)).strftime("%Y-%m-%d"), "status": "filed"}
            for i in range(1, 6)
        ] + [
            {"type": "SAR", "report_number": f"SAR-{(now - timedelta(days=i*3)).strftime('%Y%m%d')}-{2000+i:04d}", "customer": f"Customer {random.randint(1001, 1070)}", "amount": random.randint(5000000, 50000000) * 100, "filed_date": (now - timedelta(days=i*3)).strftime("%Y-%m-%d"), "status": random.choice(["filed", "pending_review"])}
            for i in range(1, 4)
        ],
    }


@router.get("/regulatory-calendar")
def regulatory_calendar(current_user: User = Depends(get_current_user)):
    """Upcoming regulatory deadlines and compliance calendar."""
    now = datetime.utcnow()

    calendar = []
    items = [
        ("CTR Monthly Filing", "FIU-IND", "monthly", "high", 15),
        ("STR Filing (if any)", "FIU-IND", "as_needed", "critical", 7),
        ("OFAC SDN List Update", "Compliance", "daily", "high", 1),
        ("UN Sanctions List Update", "Compliance", "weekly", "high", 3),
        ("KYC Periodic Review - High Risk", "KYC Team", "quarterly", "high", 45),
        ("KYC Periodic Review - Medium Risk", "KYC Team", "semi_annual", "medium", 90),
        ("Board AML/CFT Report", "Compliance Head", "quarterly", "medium", 60),
        ("RBI Annual Fraud Return", "Compliance", "annual", "high", 120),
        ("PMLA Principal Officer Report", "Principal Officer", "monthly", "critical", 20),
        ("Internal Audit - AML Controls", "Internal Audit", "quarterly", "medium", 75),
        ("PEP List Review", "Compliance", "quarterly", "high", 50),
        ("Risk Assessment Update", "Risk Team", "annual", "medium", 180),
    ]

    for name, owner, frequency, priority, days_until in items:
        calendar.append({
            "name": name,
            "owner": owner,
            "frequency": frequency,
            "priority": priority,
            "next_due": (now + timedelta(days=days_until)).strftime("%Y-%m-%d"),
            "days_until_due": days_until,
            "status": "overdue" if days_until < 0 else "due_soon" if days_until < 7 else "upcoming",
        })

    calendar.sort(key=lambda x: x["days_until_due"])

    return {"calendar": calendar, "total": len(calendar)}
