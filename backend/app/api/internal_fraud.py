"""
Internal Fraud Monitoring — Employee activity tracking, access monitoring, insider threat detection.
Tracks: account access, login events, privileged actions, data exports, config changes, overrides.
"""
import random
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/internal-fraud", tags=["Internal Fraud"])

NOW = datetime.utcnow()

# Simulated employee data for the demo
EMPLOYEES = [
    {"id": "EMP-3345", "name": "Sanjay Iyer", "department": "Branch Banking", "role": "Relationship Manager"},
    {"id": "EMP-0789", "name": "Kavitha Menon", "department": "Risk Management", "role": "Risk Analyst"},
    {"id": "EMP-5521", "name": "Vikash Gupta", "department": "IT Operations", "role": "Database Administrator"},
    {"id": "EMP-2234", "name": "Deepak Rao", "department": "ATM Operations", "role": "ATM Support Engineer"},
    {"id": "EMP-2847", "name": "Rajesh Kumar", "department": "Retail Banking Operations", "role": "Branch Manager"},
    {"id": "EMP-1234", "name": "Sneha Patel", "department": "Digital Banking Support", "role": "Support Analyst"},
    {"id": "EMP-0045", "name": "Priya Nair", "department": "Compliance", "role": "Compliance Officer"},
    {"id": "EMP-3891", "name": "Amit Sharma", "department": "Credit Operations", "role": "Credit Officer"},
    {"id": "EMP-4422", "name": "Rohit Verma", "department": "Treasury", "role": "Treasury Analyst"},
    {"id": "EMP-6677", "name": "Meena Das", "department": "HR", "role": "HR Manager"},
    {"id": "EMP-7890", "name": "Suresh Reddy", "department": "IT Security", "role": "Security Engineer"},
    {"id": "EMP-1122", "name": "Anita Joshi", "department": "Loan Operations", "role": "Loan Officer"},
]

ACTIVITY_TYPES = ["Account Access", "Login", "Privileged Action", "Data Export", "Config Change", "Override", "Report Generation", "Customer Record Modification"]
WORKSTATIONS = ["WRK-BRANCH-01", "WRK-BRANCH-04", "WRK-BRANCH-11", "WRK-RISK-03", "WRK-IT-ADMIN-01", "WRK-ATM-05", "WRK-OPS-12", "WRK-COMP-02", "WRK-CREDIT-08", "WRK-TREASURY-01", "WRK-HR-02", "WRK-SEC-01"]

SUSPICIOUS_ACTIVITIES = [
    {"emp_idx": 2, "risk": "critical", "status": "under_review", "activity": "Privileged Action",
     "description": "Accessed production database directly bypassing application layer. Queried customer PII tables.",
     "flags": ["After Hours", "Unauthorized"]},
    {"emp_idx": 3, "risk": "medium", "status": "suspicious", "activity": "Account Access",
     "description": "Accessed customer account linked to ongoing fraud case. No investigative assignment on record.",
     "flags": ["Unauthorized"]},
    {"emp_idx": 4, "risk": "critical", "status": "under_review", "activity": "Account Access",
     "description": "Accessed 847 customer accounts between 02:00-04:30 AM without documented business reason.",
     "flags": ["After Hours", "Unauthorized"]},
    {"emp_idx": 5, "risk": "high", "status": "suspicious", "activity": "Data Export",
     "description": "Exported 5,200 customer transaction records to personal USB drive. Export volume exceeds normal business need.",
     "flags": ["Unauthorized"]},
    {"emp_idx": 6, "risk": "high", "status": "cleared", "activity": "Config Change",
     "description": "Modified velocity rule threshold from 5 to 50 transactions/hour during off-peak period.",
     "flags": []},
    {"emp_idx": 7, "risk": "critical", "status": "confirmed_fraud", "activity": "Override",
     "description": "Manual override of fraud block on transaction INR 850,000 without supervisor approval.",
     "flags": ["Unauthorized"]},
    {"emp_idx": 8, "risk": "high", "status": "under_review", "activity": "Account Access",
     "description": "Accessed dormant accounts and initiated reactivation for 12 accounts with no customer requests.",
     "flags": ["After Hours"]},
    {"emp_idx": 9, "risk": "medium", "status": "suspicious", "activity": "Report Generation",
     "description": "Generated salary reports for departments outside area of responsibility.",
     "flags": []},
    {"emp_idx": 11, "risk": "high", "status": "under_review", "activity": "Customer Record Modification",
     "description": "Modified loan approval amounts for 3 accounts after business hours without maker-checker approval.",
     "flags": ["After Hours", "Unauthorized"]},
]


@router.get("/activities")
def get_activities(
    risk_level: str = Query(None),
    status: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
):
    """Get all employee activities with insider threat indicators."""
    activities = []

    # Normal activities
    for i, emp in enumerate(EMPLOYEES):
        days_ago = random.randint(0, 7)
        hours = random.randint(8, 17)
        dt = (NOW - timedelta(days=days_ago)).replace(hour=hours, minute=random.randint(0, 59))
        activity = {
            "id": str(uuid.uuid4()),
            "employee_id": emp["id"],
            "employee_name": emp["name"],
            "department": emp["department"],
            "role": emp["role"],
            "risk_level": "low",
            "status": "normal",
            "activity_type": random.choice(["Account Access", "Login", "Report Generation"]),
            "description": f"{'Successful login from approved workstation during business hours' if random.random() < 0.5 else 'Accessed VIP customer account to assist with account query'} - ticket reference TKT-{random.randint(10000, 99999)}",
            "workstation": WORKSTATIONS[i % len(WORKSTATIONS)],
            "ip_address": f"10.0.{random.randint(0, 10)}.{random.randint(1, 254)}",
            "timestamp": dt.isoformat(),
            "flags": [],
        }
        activities.append(activity)

    # Suspicious activities
    for sa in SUSPICIOUS_ACTIVITIES:
        emp = EMPLOYEES[sa["emp_idx"]]
        days_ago = random.randint(0, 30)
        hours = random.randint(0, 23)
        dt = (NOW - timedelta(days=days_ago)).replace(hour=hours, minute=random.randint(0, 59))
        activity = {
            "id": str(uuid.uuid4()),
            "employee_id": emp["id"],
            "employee_name": emp["name"],
            "department": emp["department"],
            "role": emp["role"],
            "risk_level": sa["risk"],
            "status": sa["status"],
            "activity_type": sa["activity"],
            "description": sa["description"],
            "workstation": WORKSTATIONS[sa["emp_idx"] % len(WORKSTATIONS)],
            "ip_address": f"10.0.{random.randint(0, 5)}.{random.randint(1, 254)}",
            "timestamp": dt.isoformat(),
            "flags": sa["flags"],
        }
        activities.append(activity)

    # Sort by timestamp desc
    activities.sort(key=lambda x: x["timestamp"], reverse=True)

    # Filters
    if risk_level:
        activities = [a for a in activities if a["risk_level"] == risk_level]
    if status:
        activities = [a for a in activities if a["status"] == status]

    total = len(activities)
    start = (page - 1) * page_size
    items = activities[start:start + page_size]

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/stats")
def get_internal_fraud_stats(current_user: User = Depends(get_current_user)):
    critical = sum(1 for sa in SUSPICIOUS_ACTIVITIES if sa["risk"] == "critical")
    under_investigation = sum(1 for sa in SUSPICIOUS_ACTIVITIES if sa["status"] == "under_review")
    after_hours = sum(1 for sa in SUSPICIOUS_ACTIVITIES if "After Hours" in sa["flags"])
    unauthorized = sum(1 for sa in SUSPICIOUS_ACTIVITIES if "Unauthorized" in sa["flags"])

    return {
        "critical_risk": critical,
        "under_investigation": under_investigation,
        "after_hours": after_hours,
        "unauthorized": unauthorized,
    }
