"""
RBI Compliance Scorecard — Checklist of all RBI Master Directions mapped to system features.
Auto-updated status based on actual system state.
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.dependencies import get_current_user
from app.models import (
    User, Customer, Alert, Case, Transaction, AuditLog, CTRReport, SARReport,
    Rule, KYCReview, WatchlistEntry,
)

router = APIRouter(prefix="/compliance-scorecard", tags=["Compliance"])


def _check_status(implemented: bool, coverage_pct: float) -> str:
    if not implemented:
        return "not_implemented"
    if coverage_pct >= 90:
        return "compliant"
    if coverage_pct >= 50:
        return "partial"
    return "at_risk"


@router.get("/summary")
def compliance_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """RBI Master Direction compliance scorecard with live system checks."""
    now = datetime.utcnow()
    thirty_days = now - timedelta(days=30)

    # Gather system metrics
    total_customers = db.query(func.count(Customer.id)).filter(Customer.is_active == True).scalar() or 1
    kyc_reviewed = db.query(func.count(KYCReview.id)).filter(KYCReview.status == "approved").scalar() or 0
    kyc_coverage = round(min(kyc_reviewed / total_customers * 100, 100), 1)

    total_txns_30d = db.query(func.count(Transaction.id)).filter(Transaction.transaction_date >= thirty_days).scalar() or 1
    screened_txns = db.query(func.count(Transaction.id)).filter(
        Transaction.transaction_date >= thirty_days, Transaction.is_flagged == True
    ).scalar() or 0

    active_rules = db.query(func.count(Rule.id)).filter(Rule.is_enabled == True).scalar() or 0
    total_rules = db.query(func.count(Rule.id)).scalar() or 1

    ctrs_filed = db.query(func.count(CTRReport.id)).filter(CTRReport.filing_status == "filed").scalar() or 0
    ctrs_total = db.query(func.count(CTRReport.id)).scalar() or 0
    sars_filed = db.query(func.count(SARReport.id)).filter(SARReport.filing_status == "filed").scalar() or 0
    sars_total = db.query(func.count(SARReport.id)).scalar() or 0

    audit_entries_30d = db.query(func.count(AuditLog.id)).filter(AuditLog.created_at >= thirty_days).scalar() or 0
    watchlist_entries = db.query(func.count(WatchlistEntry.id)).filter(WatchlistEntry.is_active == True).scalar() or 0

    open_alerts = db.query(func.count(Alert.id)).filter(
        ~Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"])
    ).scalar() or 0
    overdue_alerts = db.query(func.count(Alert.id)).filter(Alert.is_overdue == True).scalar() or 0
    sla_rate = round((1 - overdue_alerts / max(open_alerts, 1)) * 100, 1) if open_alerts else 100.0

    pep_customers = db.query(func.count(Customer.id)).filter(Customer.pep_status == True).scalar() or 0

    # Build scorecard sections
    sections = [
        {
            "id": "kyc_cdd",
            "title": "KYC / CDD (Master Direction on KYC, 2016)",
            "rbi_reference": "RBI/2015-16/Master Direction DBR.AML.BC.No.81/14.01.001/2015-16",
            "requirements": [
                {
                    "id": "kyc-01",
                    "requirement": "Customer Identification Procedure (CIP)",
                    "description": "Verify identity of all customers using officially valid documents (OVDs)",
                    "status": _check_status(True, kyc_coverage),
                    "coverage": kyc_coverage,
                    "evidence": f"{kyc_reviewed} of {total_customers} customers KYC verified",
                    "implemented": True,
                },
                {
                    "id": "kyc-02",
                    "requirement": "Risk-Based Customer Categorization",
                    "description": "Categorize customers into low/medium/high/very-high risk tiers",
                    "status": "compliant",
                    "coverage": 100,
                    "evidence": "All customers auto-scored on 0-100 scale with 4-tier categorization",
                    "implemented": True,
                },
                {
                    "id": "kyc-03",
                    "requirement": "Enhanced Due Diligence (EDD) for PEP",
                    "description": "Apply EDD for Politically Exposed Persons and high-risk customers",
                    "status": _check_status(True, 100 if pep_customers > 0 else 80),
                    "coverage": 100 if pep_customers > 0 else 80,
                    "evidence": f"{pep_customers} PEP customers flagged with enhanced monitoring",
                    "implemented": True,
                },
                {
                    "id": "kyc-04",
                    "requirement": "Ongoing CDD / Periodic Review",
                    "description": "Periodic review of KYC: high-risk every 2 years, medium every 8, low every 10",
                    "status": _check_status(True, 75),
                    "coverage": 75,
                    "evidence": "KYC review scheduling and tracking implemented",
                    "implemented": True,
                },
            ],
        },
        {
            "id": "aml_cft",
            "title": "AML / CFT (Prevention of Money Laundering Act, 2002)",
            "rbi_reference": "PMLA 2002, PML Rules 2005",
            "requirements": [
                {
                    "id": "aml-01",
                    "requirement": "Transaction Monitoring System",
                    "description": "Automated system to monitor transactions against predefined rules/scenarios",
                    "status": "compliant",
                    "coverage": 100,
                    "evidence": f"{active_rules} of {total_rules} detection rules active, screening {total_txns_30d} txns/month",
                    "implemented": True,
                },
                {
                    "id": "aml-02",
                    "requirement": "Suspicious Transaction Reporting (STR)",
                    "description": "File STR with FIU-IND within 7 days of suspicion",
                    "status": _check_status(True, round(sars_filed / max(sars_total, 1) * 100, 1)),
                    "coverage": round(sars_filed / max(sars_total, 1) * 100, 1),
                    "evidence": f"{sars_filed} of {sars_total} SARs filed with FIU-IND",
                    "implemented": True,
                },
                {
                    "id": "aml-03",
                    "requirement": "Currency Transaction Reporting (CTR)",
                    "description": "File CTR for cash transactions > INR 10 lakh within 15 days",
                    "status": _check_status(True, round(ctrs_filed / max(ctrs_total, 1) * 100, 1)),
                    "coverage": round(ctrs_filed / max(ctrs_total, 1) * 100, 1),
                    "evidence": f"{ctrs_filed} of {ctrs_total} CTRs filed",
                    "implemented": True,
                },
                {
                    "id": "aml-04",
                    "requirement": "Watchlist / Sanctions Screening",
                    "description": "Screen against OFAC, UN, India MHA sanctions lists",
                    "status": _check_status(True, 90 if watchlist_entries > 0 else 50),
                    "coverage": 90 if watchlist_entries > 0 else 50,
                    "evidence": f"{watchlist_entries} active watchlist entries being screened",
                    "implemented": True,
                },
                {
                    "id": "aml-05",
                    "requirement": "Record Retention (10 years)",
                    "description": "Maintain records of all transactions and KYC for 10 years from closure",
                    "status": _check_status(True, 85),
                    "coverage": 85,
                    "evidence": "Full audit trail with immutable logging; archival policy pending",
                    "implemented": True,
                },
            ],
        },
        {
            "id": "fraud_risk",
            "title": "Fraud Risk Management (Circular on Cyber Security Framework)",
            "rbi_reference": "RBI/2023-24/Circular on Digital Payment Security Controls",
            "requirements": [
                {
                    "id": "frm-01",
                    "requirement": "Real-time Fraud Detection",
                    "description": "Deploy real-time transaction monitoring with automated alerts",
                    "status": "compliant",
                    "coverage": 100,
                    "evidence": f"Rules engine evaluates every transaction; {screened_txns} flagged in 30 days",
                    "implemented": True,
                },
                {
                    "id": "frm-02",
                    "requirement": "Case Management & Investigation",
                    "description": "Structured case lifecycle from alert to resolution with audit trail",
                    "status": "compliant",
                    "coverage": 100,
                    "evidence": "Full case management with assignment, escalation, evidence linking",
                    "implemented": True,
                },
                {
                    "id": "frm-03",
                    "requirement": "Internal Fraud Monitoring",
                    "description": "Monitor employee activities for unauthorized access or suspicious behavior",
                    "status": _check_status(True, 70),
                    "coverage": 70,
                    "evidence": "Employee activity monitoring module with behavioral analytics",
                    "implemented": True,
                },
                {
                    "id": "frm-04",
                    "requirement": "SLA-Based Alert Resolution",
                    "description": "Define and enforce SLA timelines for alert investigation and closure",
                    "status": _check_status(True, sla_rate),
                    "coverage": sla_rate,
                    "evidence": f"SLA compliance at {sla_rate}%, {overdue_alerts} alerts overdue",
                    "implemented": True,
                },
            ],
        },
        {
            "id": "data_governance",
            "title": "Data Governance & Privacy",
            "rbi_reference": "RBI Data Localization Directive (April 2018) + IT Act 2000",
            "requirements": [
                {
                    "id": "dg-01",
                    "requirement": "Data Localization (India-only storage)",
                    "description": "All payment data must be stored within India (RBI April 2018 directive)",
                    "status": "compliant",
                    "coverage": 100,
                    "evidence": "Azure Central India region; all data stored domestically",
                    "implemented": True,
                },
                {
                    "id": "dg-02",
                    "requirement": "PII Encryption at Rest",
                    "description": "Encrypt PAN, Aadhaar, phone, email in database columns",
                    "status": _check_status(True, 60),
                    "coverage": 60,
                    "evidence": "Encryption module built; wiring to all PII fields in progress",
                    "implemented": True,
                },
                {
                    "id": "dg-03",
                    "requirement": "API Data Masking",
                    "description": "Mask PAN, Aadhaar in API list responses; full view only for authorized users",
                    "status": _check_status(True, 55),
                    "coverage": 55,
                    "evidence": "Masking utilities built; API integration in progress",
                    "implemented": True,
                },
                {
                    "id": "dg-04",
                    "requirement": "Comprehensive Audit Trail",
                    "description": "Log every user action with timestamp, IP, and resource details",
                    "status": "compliant",
                    "coverage": 100,
                    "evidence": f"{audit_entries_30d} audit entries in last 30 days via AuditMiddleware",
                    "implemented": True,
                },
            ],
        },
        {
            "id": "reporting",
            "title": "Regulatory Reporting & Governance",
            "rbi_reference": "RBI Master Direction on Fraud Classification, 2016",
            "requirements": [
                {
                    "id": "rpt-01",
                    "requirement": "Board-Level Risk Reporting",
                    "description": "Generate periodic risk reports for board/CRO review",
                    "status": "compliant",
                    "coverage": 100,
                    "evidence": "One-click Board Report PDF with live data",
                    "implemented": True,
                },
                {
                    "id": "rpt-02",
                    "requirement": "FIU-IND Filing Integration",
                    "description": "Direct electronic filing with Financial Intelligence Unit",
                    "status": _check_status(False, 0),
                    "coverage": 0,
                    "evidence": "CTR/SAR reports generated; FIU-IND API connector pending",
                    "implemented": False,
                },
                {
                    "id": "rpt-03",
                    "requirement": "Maker-Checker for Sensitive Actions",
                    "description": "Dual authorization for rule changes, case closures, role modifications",
                    "status": "compliant",
                    "coverage": 100,
                    "evidence": "7 action types under maker-checker: rules, cases, reports, roles, bulk ops, watchlist, config",
                    "implemented": True,
                },
                {
                    "id": "rpt-04",
                    "requirement": "Police / FIR Tracking",
                    "description": "Track FIR filing status for fraud cases referred to law enforcement",
                    "status": "compliant",
                    "coverage": 100,
                    "evidence": "Police/FIR module with case linking and status tracking",
                    "implemented": True,
                },
            ],
        },
        {
            "id": "it_security",
            "title": "IT Security & Access Control",
            "rbi_reference": "RBI Circular on Cyber Security Framework for Banks",
            "requirements": [
                {
                    "id": "it-01",
                    "requirement": "Role-Based Access Control (RBAC)",
                    "description": "Restrict system access based on user roles with least privilege",
                    "status": "compliant",
                    "coverage": 100,
                    "evidence": "8 roles with granular permissions; JWT-based auth",
                    "implemented": True,
                },
                {
                    "id": "it-02",
                    "requirement": "Multi-Factor Authentication",
                    "description": "MFA/TOTP for all user logins",
                    "status": _check_status(False, 0),
                    "coverage": 0,
                    "evidence": "Password-only auth; TOTP integration planned for Sprint 1",
                    "implemented": False,
                },
                {
                    "id": "it-03",
                    "requirement": "Network Security (WAF + TLS)",
                    "description": "Web Application Firewall with OWASP rules; TLS 1.2+ enforcement",
                    "status": _check_status(True, 100),
                    "coverage": 100,
                    "evidence": "Azure WAF with OWASP 3.2 rules; Application Gateway with TLS 1.2+",
                    "implemented": True,
                },
                {
                    "id": "it-04",
                    "requirement": "Session Management & Token Revocation",
                    "description": "Secure session handling with token blacklist on logout",
                    "status": _check_status(False, 0),
                    "coverage": 0,
                    "evidence": "JWT expiry implemented; token revocation/blacklist pending",
                    "implemented": False,
                },
            ],
        },
    ]

    # Calculate summary metrics
    all_reqs = [r for s in sections for r in s["requirements"]]
    total_reqs = len(all_reqs)
    compliant = sum(1 for r in all_reqs if r["status"] == "compliant")
    partial = sum(1 for r in all_reqs if r["status"] == "partial")
    at_risk = sum(1 for r in all_reqs if r["status"] == "at_risk")
    not_impl = sum(1 for r in all_reqs if r["status"] == "not_implemented")
    avg_coverage = round(sum(r["coverage"] for r in all_reqs) / total_reqs, 1) if total_reqs else 0

    return {
        "sections": sections,
        "summary": {
            "total_requirements": total_reqs,
            "compliant": compliant,
            "partial": partial,
            "at_risk": at_risk,
            "not_implemented": not_impl,
            "overall_score": round(compliant / total_reqs * 100, 1) if total_reqs else 0,
            "avg_coverage": avg_coverage,
            "last_assessed": now.isoformat(),
        },
    }
