"""
Fraud Scenarios — FATF typology library with pre-built detection scenarios.
Covers Tier 1-3: AML, fraud, cyber, UPI, mule, TBML, insider, synthetic ID.
"""
import json
import random
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.database import get_db
from sqlalchemy.orm import Session
from app.dependencies import get_current_user
from app.models import User, Scenario, Rule

router = APIRouter(prefix="/fraud-scenarios", tags=["Fraud Scenarios"])


class TypologyCreate(BaseModel):
    name: str
    category: str
    subcategory: Optional[str] = None
    risk: str = "medium"
    status: str = "active"
    description: str
    fatf_reference: Optional[str] = None
    indicators: List[str] = []
    rules_count: int = 0


class TypologyUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    risk: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    fatf_reference: Optional[str] = None
    indicators: Optional[List[str]] = None
    rules_count: Optional[int] = None

NOW = datetime.utcnow()

# Complete FATF + RBI typology library
TYPOLOGY_LIBRARY = [
    # AML Typologies
    {"id": "TYP-AML-001", "name": "Cash Structuring / Smurfing", "category": "AML", "subcategory": "Structuring",
     "risk": "critical", "status": "active", "rules_count": 5, "detections_30d": random.randint(15, 45),
     "description": "Breaking large cash amounts into smaller deposits below CTR threshold (INR 10L) across multiple branches or days.",
     "fatf_reference": "FATF Typology 2006", "indicators": ["Multiple cash deposits just below threshold", "Different branches same day", "Round amounts", "No business justification"]},

    {"id": "TYP-AML-002", "name": "Layering Through Multiple Accounts", "category": "AML", "subcategory": "Layering",
     "risk": "critical", "status": "active", "rules_count": 4, "detections_30d": random.randint(8, 25),
     "description": "Rapid movement of funds through multiple accounts to obscure the money trail. Funds pass through 3+ intermediaries.",
     "fatf_reference": "FATF Typology 2009", "indicators": ["Rapid fund transfers", "Multiple intermediary accounts", "No economic rationale", "Shell company involvement"]},

    {"id": "TYP-AML-003", "name": "Round-Tripping", "category": "AML", "subcategory": "Integration",
     "risk": "high", "status": "active", "rules_count": 2, "detections_30d": random.randint(3, 12),
     "description": "Funds sent abroad return to origin through a different route, appearing as legitimate foreign investment.",
     "fatf_reference": "FATF Typology 2012", "indicators": ["Outward remittance followed by inward FDI", "Same beneficial owner", "Circular fund flow"]},

    {"id": "TYP-AML-004", "name": "Trade-Based Money Laundering", "category": "AML", "subcategory": "TBML",
     "risk": "critical", "status": "active", "rules_count": 3, "detections_30d": random.randint(5, 18),
     "description": "Over/under invoicing of imports/exports, phantom shipments, or multiple invoicing for same goods.",
     "fatf_reference": "FATF TBML Report 2006", "indicators": ["Price anomaly vs market rate", "Mismatched trade documents", "High-risk trade corridors", "Phantom shipments"]},

    {"id": "TYP-AML-005", "name": "Hawala / Hundi Network", "category": "AML", "subcategory": "Informal VTS",
     "risk": "high", "status": "active", "rules_count": 2, "detections_30d": random.randint(2, 8),
     "description": "Informal value transfer system bypassing banking channels. Matching deposits/withdrawals with no direct link.",
     "fatf_reference": "FATF Special Recommendation VI", "indicators": ["Cash-intensive business cover", "Matching counter-flows", "No trade documents"]},

    {"id": "TYP-AML-006", "name": "Funnel Account Activity", "category": "AML", "subcategory": "Structuring",
     "risk": "high", "status": "active", "rules_count": 2, "detections_30d": random.randint(4, 15),
     "description": "Single account receives multiple cash deposits from different cities/branches and quickly wires funds out.",
     "fatf_reference": "FinCEN Advisory 2014", "indicators": ["Multi-city cash deposits", "Immediate outward transfer", "No local business presence"]},

    # Fraud Typologies
    {"id": "TYP-FRD-001", "name": "Mule Account Network", "category": "Fraud", "subcategory": "Money Mule",
     "risk": "critical", "status": "active", "rules_count": 4, "detections_30d": random.randint(10, 30),
     "description": "Accounts used as pass-through for fraudulent/stolen funds. Recruited accounts show rapid in/out pattern.",
     "fatf_reference": "Europol Mule Report 2023", "indicators": ["New account high volume", "Rapid in-out same day", "Multiple small incoming + single large outgoing", "Young account holder"]},

    {"id": "TYP-FRD-002", "name": "Synthetic Identity Fraud", "category": "Fraud", "subcategory": "Identity",
     "risk": "critical", "status": "active", "rules_count": 3, "detections_30d": random.randint(2, 10),
     "description": "Fabricated identity combining real and fake data elements for account opening and credit abuse.",
     "fatf_reference": "Federal Reserve SR 2019", "indicators": ["SSN/PAN mismatch with name/DOB", "No credit history", "Authorized user piggybacking", "Bust-out pattern"]},

    {"id": "TYP-FRD-003", "name": "UPI Fraud / QR Code Scam", "category": "Fraud", "subcategory": "Digital Payment",
     "risk": "high", "status": "active", "rules_count": 4, "detections_30d": random.randint(20, 60),
     "description": "Fake UPI collect requests, malicious QR codes, SIM swap followed by UPI takeover.",
     "fatf_reference": "RBI Circular 2023", "indicators": ["Multiple collect requests to same user", "New device + immediate UPI registration", "SIM change + UPI activity within 24h", "QR code payment to new merchant"]},

    {"id": "TYP-FRD-004", "name": "Account Takeover (ATO)", "category": "Fraud", "subcategory": "Cyber",
     "risk": "critical", "status": "active", "rules_count": 3, "detections_30d": random.randint(8, 22),
     "description": "Unauthorized access via credential theft, phishing, or social engineering followed by fund drain.",
     "fatf_reference": "NIST SP 800-63B", "indicators": ["New device login", "Password change + immediate transfer", "Unusual IP/geo", "Rapid beneficiary add + transfer"]},

    {"id": "TYP-FRD-005", "name": "Loan / Application Fraud", "category": "Fraud", "subcategory": "Application",
     "risk": "high", "status": "active", "rules_count": 3, "detections_30d": random.randint(5, 15),
     "description": "Falsified income documents, inflated property valuations, or fake employment for loan approval.",
     "fatf_reference": "RBI Master Direction on Fraud 2024", "indicators": ["Income inconsistent with ITR", "Multiple loan applications", "Same property different valuations", "Employer verification failure"]},

    {"id": "TYP-FRD-006", "name": "Insider / Employee Fraud", "category": "Fraud", "subcategory": "Internal",
     "risk": "critical", "status": "active", "rules_count": 5, "detections_30d": random.randint(3, 12),
     "description": "Employee creates ghost accounts, unauthorized overrides, data theft, or collusion with external fraudsters.",
     "fatf_reference": "ACFE Report 2024", "indicators": ["After-hours access", "Unauthorized account access", "Override without approval", "Bulk data export", "Config changes"]},

    {"id": "TYP-FRD-007", "name": "Check / DD Fraud", "category": "Fraud", "subcategory": "Instrument",
     "risk": "medium", "status": "active", "rules_count": 2, "detections_30d": random.randint(3, 10),
     "description": "Counterfeit checks, altered amounts, forged signatures, or stolen demand drafts.",
     "fatf_reference": "RBI Circular 2019", "indicators": ["High-value check from new account", "Altered payee name", "Multiple DDs to same beneficiary", "Check deposited far from issuing branch"]},

    {"id": "TYP-FRD-008", "name": "Cyber Attack / Credential Stuffing", "category": "Fraud", "subcategory": "Cyber",
     "risk": "critical", "status": "active", "rules_count": 3, "detections_30d": random.randint(5, 20),
     "description": "Automated login attempts using stolen credentials from data breaches. Distributed across IPs.",
     "fatf_reference": "OWASP Top 10 2021", "indicators": ["High failed login rate", "Multiple IPs same account", "Known breached credentials", "Bot-like behavior pattern"]},

    {"id": "TYP-FRD-009", "name": "Benami Transaction Detection", "category": "Fraud", "subcategory": "Regulatory",
     "risk": "high", "status": "active", "rules_count": 2, "detections_30d": random.randint(1, 5),
     "description": "Transactions in fictitious or borrowed names. Prohibited under Benami Transactions Act 1988.",
     "fatf_reference": "Benami Act 1988 (India)", "indicators": ["Property in nominee name", "Undisclosed beneficial owner", "Cash purchases in third-party name"]},

    {"id": "TYP-FRD-010", "name": "Shell Company Operations", "category": "Fraud", "subcategory": "Corporate",
     "risk": "high", "status": "active", "rules_count": 2, "detections_30d": random.randint(2, 8),
     "description": "Companies with no real business operations used as conduits for money laundering or tax evasion.",
     "fatf_reference": "FATF Transparency Report 2019", "indicators": ["No employees", "No physical office", "High-value transactions inconsistent with turnover", "Director linked to multiple shell entities"]},

    # Cyber Fraud Typologies
    {"id": "TYP-CFR-001", "name": "Phishing & Vishing Attack", "category": "cyber_fraud", "subcategory": "Social Engineering",
     "risk": "critical", "status": "active", "rules_count": 4, "detections_30d": random.randint(12, 40),
     "description": "Fraudulent emails, SMS, or calls impersonating the bank to steal OTP, credentials, or card details. Increasing use of AI-generated voice cloning.",
     "fatf_reference": "RBI Cybersecurity Framework 2016", "indicators": ["Login from new device after OTP received", "Credential change + immediate transfer", "Customer reports unsolicited OTP request", "Known phishing domain in referrer URL"]},

    {"id": "TYP-CFR-002", "name": "SIM Swap Fraud", "category": "cyber_fraud", "subcategory": "Mobile Takeover",
     "risk": "critical", "status": "active", "rules_count": 3, "detections_30d": random.randint(8, 25),
     "description": "Fraudster convinces telecom to transfer victim's phone number to a new SIM, then takes over banking OTP channel.",
     "fatf_reference": "TRAI & RBI Joint Advisory 2020", "indicators": ["SIM change event followed by bank login within 24h", "OTP delivered to new SIM within 15 min of swap", "High-value NEFT/IMPS immediately after SIM change"]},

    {"id": "TYP-CFR-003", "name": "Internet Banking Credential Stuffing", "category": "cyber_fraud", "subcategory": "Credential Attack",
     "risk": "high", "status": "active", "rules_count": 3, "detections_30d": random.randint(15, 50),
     "description": "Automated login attempts using stolen username/password pairs from data breaches. Distributed across IPs to evade rate limiting.",
     "fatf_reference": "OWASP Top 10 2021", "indicators": ["High failed login rate across multiple accounts", "Login attempts from Tor/proxy IPs", "Known breach dataset credentials", "Multiple accounts same IP within 1 min"]},

    {"id": "TYP-CFR-004", "name": "Malware / RAT Based Attack", "category": "cyber_fraud", "subcategory": "Malware",
     "risk": "critical", "status": "active", "rules_count": 2, "detections_30d": random.randint(3, 12),
     "description": "Remote Access Trojans installed on customer devices capture keystrokes, intercept OTPs, and initiate unauthorized transfers.",
     "fatf_reference": "CERT-In Advisory CI-20-024", "indicators": ["Transfer initiated from known infected IP range", "Unusual browser agent for existing device", "Transaction initiated at 3-5 AM local time", "Multiple beneficiary adds within 1 hour"]},

    {"id": "TYP-CFR-005", "name": "API Exploitation / Man-in-the-Middle", "category": "cyber_fraud", "subcategory": "Technical Attack",
     "risk": "high", "status": "active", "rules_count": 2, "detections_30d": random.randint(2, 8),
     "description": "Exploitation of weak API endpoints, JWT token forgery, or TLS interception to intercept or replay banking transactions.",
     "fatf_reference": "RBI IT Framework for NBFCs 2017", "indicators": ["Replayed request timestamps", "Token used from different IP than issuance", "Requests with malformed auth headers", "Unusually high API call rate from single token"]},

    # AI Fraud Typologies
    {"id": "TYP-AIF-001", "name": "AI-Generated Synthetic Identity", "category": "ai_fraud", "subcategory": "Synthetic ID",
     "risk": "critical", "status": "active", "rules_count": 3, "detections_30d": random.randint(2, 10),
     "description": "Generative AI used to create photorealistic fake Aadhaar, PAN, and income documents for fraudulent account opening and loan applications.",
     "fatf_reference": "FATF Report on Virtual Assets 2023", "indicators": ["Document metadata inconsistency", "Font rendering artifacts in ID documents", "Aadhaar QR scan fails but visual looks valid", "AI image forensics flag (ELA analysis)"]},

    {"id": "TYP-AIF-002", "name": "Deepfake Voice/Video KYC Bypass", "category": "ai_fraud", "subcategory": "Biometric Fraud",
     "risk": "critical", "status": "active", "rules_count": 2, "detections_30d": random.randint(1, 6),
     "description": "AI-generated voice clones or deepfake videos used to pass Video KYC verification, impersonate customers in call centers, or bypass liveness detection.",
     "fatf_reference": "RBI Video-based Customer Identification Process 2021", "indicators": ["V-CIP liveness score below 0.7", "Audio frequency anomaly in call recording", "Background inconsistency in video KYC", "Face movement patterns outside normal range"]},

    {"id": "TYP-AIF-003", "name": "AI-Powered Phishing & Spear Phishing", "category": "ai_fraud", "subcategory": "Social Engineering",
     "risk": "high", "status": "active", "rules_count": 3, "detections_30d": random.randint(5, 20),
     "description": "Large Language Models used to craft highly personalized phishing emails using scraped customer data, indistinguishable from genuine bank communication.",
     "fatf_reference": "CERT-In Advisory 2024", "indicators": ["Email domain typosquatting with valid SSL", "Personalized content matching customer transaction history", "Customer reports unsolicited link leading to lookalike site"]},

    {"id": "TYP-AIF-004", "name": "ML Model Adversarial Evasion", "category": "ai_fraud", "subcategory": "Model Evasion",
     "risk": "high", "status": "active", "rules_count": 2, "detections_30d": random.randint(1, 5),
     "description": "Adversarial inputs deliberately crafted to evade the bank's fraud detection ML models — transactions designed to score just below alert thresholds.",
     "fatf_reference": "NIST AI RMF 2023", "indicators": ["Transaction amount clusters just below model threshold", "Incremental amount increases testing system limits", "Behavioral drift — gradually changing pattern to avoid detection", "High volume of low-value probes before large transfer"]},

    {"id": "TYP-AIF-005", "name": "AI Mule Recruitment Network", "category": "ai_fraud", "subcategory": "Money Mule",
     "risk": "critical", "status": "active", "rules_count": 3, "detections_30d": random.randint(4, 15),
     "description": "Automated chatbots and fake job portals recruit money mules at scale. AI-generated job offers target vulnerable demographics with legitimate-looking employment ads.",
     "fatf_reference": "Europol AI Mule Report 2024", "indicators": ["New account receives large credits within 48h of opening", "Account holder age 18-25, recent graduate", "Same bank account linked to multiple 'employers'", "Cash withdrawals immediately after large credits"]},

    # Internal Fraud Typologies
    {"id": "TYP-IFR-001", "name": "Rogue Employee Account Manipulation", "category": "internal_fraud", "subcategory": "Account Fraud",
     "risk": "critical", "status": "active", "rules_count": 5, "detections_30d": random.randint(2, 8),
     "description": "Branch or back-office employee creates ghost accounts, credits unauthorized amounts, or manipulates dormant accounts for personal gain.",
     "fatf_reference": "ACFE Report on Occupational Fraud 2024", "indicators": ["After-hours CBS access without authorization", "New account with no KYC, credited within 24h", "Dormant account activated by same-branch employee", "Multiple overrides in single session"]},

    {"id": "TYP-IFR-002", "name": "Loan Fraud by Relationship Manager", "category": "internal_fraud", "subcategory": "Loan Fraud",
     "risk": "critical", "status": "active", "rules_count": 3, "detections_30d": random.randint(1, 5),
     "description": "Relationship Manager inflates customer income, inflates collateral valuations, or links loan disbursement to personally-controlled accounts.",
     "fatf_reference": "RBI Fraud Risk Management Guidelines 2019", "indicators": ["RM approvals for same customer cluster", "Loan disbursed to non-KYC account", "Income documentation inconsistency", "Collateral valuation above market rate by >20%"]},

    {"id": "TYP-IFR-003", "name": "Data Theft & Exfiltration", "category": "internal_fraud", "subcategory": "Data Exfiltration",
     "risk": "high", "status": "active", "rules_count": 3, "detections_30d": random.randint(1, 4),
     "description": "Employee exports bulk customer data via email, USB, or cloud upload for sale to competitors or fraudsters.",
     "fatf_reference": "DPDP Act 2023 (India)", "indicators": ["Bulk record download outside business hours", "USB device detected on workstation", "Large email attachment to personal domain", "Data query volume 10x above baseline"]},

    {"id": "TYP-IFR-004", "name": "Maker-Checker Collusion", "category": "internal_fraud", "subcategory": "Collusion",
     "risk": "critical", "status": "active", "rules_count": 2, "detections_30d": random.randint(1, 4),
     "description": "Two or more employees collude to bypass dual-control authorization. One initiates a fraudulent transaction and the other approves it against bank policy.",
     "fatf_reference": "RBI Internal Controls Circular 2020", "indicators": ["Maker and checker in same department", "Approval within seconds of initiation", "Both employees accessed same customer record same day", "Transaction amount at authorization threshold"]},

    {"id": "TYP-IFR-005", "name": "IT Administrator Privilege Abuse", "category": "internal_fraud", "subcategory": "Privilege Abuse",
     "risk": "critical", "status": "active", "rules_count": 3, "detections_30d": random.randint(1, 3),
     "description": "System administrator misuses elevated access to bypass controls, disable audit logging, modify detection rules, or extract unencrypted data.",
     "fatf_reference": "NIST SP 800-53 AC-2", "indicators": ["Audit log gaps or deletions", "Rule threshold modified without change request", "Config change during off-hours", "Admin access to prod database outside maintenance window"]},

    # Compliance Scenarios
    {"id": "TYP-CMP-001", "name": "Sanctions Evasion", "category": "Compliance", "subcategory": "Sanctions",
     "risk": "critical", "status": "active", "rules_count": 2, "detections_30d": random.randint(1, 5),
     "description": "Transactions structured to evade sanctions screening via intermediaries or name variations.",
     "fatf_reference": "UN Security Council Resolutions", "indicators": ["Transaction to sanctioned jurisdiction via intermediary", "Name spelling variations", "Third-party payments"]},

    {"id": "TYP-CMP-002", "name": "Tax Evasion Facilitation", "category": "Compliance", "subcategory": "Tax",
     "risk": "high", "status": "active", "rules_count": 2, "detections_30d": random.randint(3, 10),
     "description": "Cash transactions designed to avoid tax reporting, unreported foreign accounts, or income layering.",
     "fatf_reference": "FATF Recommendation 2012", "indicators": ["Large cash without PAN declaration", "Foreign account undisclosed in KYC", "Income vs transaction mismatch"]},
]


@router.get("/typologies")
def get_typology_library(
    category: str = None,
    current_user: User = Depends(get_current_user),
):
    """Get the complete FATF typology library."""
    result = TYPOLOGY_LIBRARY
    if category:
        result = [t for t in result if t["category"].lower() == category.lower()]
    return {
        "typologies": result,
        "items": result,  # also expose under 'items' for consistency with paginated endpoints
        "total": len(result),
        "by_category": {
            "AML": sum(1 for t in TYPOLOGY_LIBRARY if t["category"] == "AML"),
            "Fraud": sum(1 for t in TYPOLOGY_LIBRARY if t["category"] == "Fraud"),
            "Compliance": sum(1 for t in TYPOLOGY_LIBRARY if t["category"] == "Compliance"),
        },
    }


def _next_typology_id(category: str) -> str:
    """Generate next sequential ID for a category, e.g. TYP-CFR-006."""
    prefix_map = {
        "aml": "AML", "fraud": "FRD", "compliance": "CMP",
        "cyber_fraud": "CFR", "ai_fraud": "AIF", "internal_fraud": "IFR",
    }
    prefix = prefix_map.get(category.lower(), "OTH")
    existing = [t["id"] for t in TYPOLOGY_LIBRARY if t["id"].startswith(f"TYP-{prefix}-")]
    nums = []
    for tid in existing:
        try:
            nums.append(int(tid.split("-")[-1]))
        except (ValueError, IndexError):
            pass
    next_num = (max(nums) + 1) if nums else 1
    return f"TYP-{prefix}-{next_num:03d}"


@router.post("/typologies", status_code=201)
def create_typology(
    body: TypologyCreate,
    current_user: User = Depends(get_current_user),
):
    """Create a new fraud typology entry. Stored in the in-memory library."""
    new_id = _next_typology_id(body.category)
    typ = {
        "id": new_id,
        "name": body.name,
        "category": body.category,
        "subcategory": body.subcategory or "",
        "risk": body.risk,
        "status": body.status,
        "rules_count": body.rules_count,
        "detections_30d": 0,
        "description": body.description,
        "fatf_reference": body.fatf_reference or "",
        "indicators": body.indicators,
    }
    TYPOLOGY_LIBRARY.append(typ)
    return typ


@router.put("/typologies/{typology_id}")
def update_typology(
    typology_id: str,
    body: TypologyUpdate,
    current_user: User = Depends(get_current_user),
):
    """Update an existing typology in the library."""
    for typ in TYPOLOGY_LIBRARY:
        if typ["id"] == typology_id:
            data = body.model_dump(exclude_none=True)
            typ.update(data)
            return typ
    raise HTTPException(status_code=404, detail="Typology not found")


@router.delete("/typologies/{typology_id}", status_code=204)
def delete_typology(
    typology_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a typology from the library."""
    for i, typ in enumerate(TYPOLOGY_LIBRARY):
        if typ["id"] == typology_id:
            TYPOLOGY_LIBRARY.pop(i)
            return
    raise HTTPException(status_code=404, detail="Typology not found")


@router.get("/scenarios")
def get_scenarios(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get configured detection scenarios."""
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


@router.get("/stats")
def get_scenario_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    total_scenarios = db.query(Scenario).count()
    active = db.query(Scenario).filter(Scenario.is_enabled == True).count()
    total_rules = db.query(Rule).count()
    active_rules = db.query(Rule).filter(Rule.is_enabled == True).count()
    total_detections = sum(t["detections_30d"] for t in TYPOLOGY_LIBRARY)

    return {
        "total_typologies": len(TYPOLOGY_LIBRARY),
        "total_scenarios": total_scenarios,
        "active_scenarios": active,
        "total_rules": total_rules,
        "active_rules": active_rules,
        "detections_30d": total_detections,
        "by_risk": {
            "critical": sum(1 for t in TYPOLOGY_LIBRARY if t["risk"] == "critical"),
            "high": sum(1 for t in TYPOLOGY_LIBRARY if t["risk"] == "high"),
            "medium": sum(1 for t in TYPOLOGY_LIBRARY if t["risk"] == "medium"),
        },
        "by_category": {
            "AML": sum(1 for t in TYPOLOGY_LIBRARY if t["category"] == "AML"),
            "Fraud": sum(1 for t in TYPOLOGY_LIBRARY if t["category"] == "Fraud"),
            "cyber_fraud": sum(1 for t in TYPOLOGY_LIBRARY if t["category"] == "cyber_fraud"),
            "ai_fraud": sum(1 for t in TYPOLOGY_LIBRARY if t["category"] == "ai_fraud"),
            "internal_fraud": sum(1 for t in TYPOLOGY_LIBRARY if t["category"] == "internal_fraud"),
            "Compliance": sum(1 for t in TYPOLOGY_LIBRARY if t["category"] == "Compliance"),
        },
    }
