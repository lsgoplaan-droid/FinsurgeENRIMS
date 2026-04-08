"""
Master seed script for FinsurgeENRIMS demo data.
Creates a complete, realistic Indian banking dataset with:
- 8 users, 6 roles
- 50 customers with crafted personas
- 80 accounts
- 5000+ transactions over 90 days
- 26 detection rules
- 10 scenarios
- 150+ alerts, 25 cases
- 200 watchlist entries
- KYC reviews, screening results
- Network relationships
- CTR/SAR reports
"""
import uuid
import json
import random
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from app.services.auth_service import hash_password
from app.models import (
    User, Role, user_roles,
    Customer, Account, Transaction,
    Rule, Scenario,
    Alert, AlertNote,
    Case, CaseActivity, CaseEvidence, case_alerts,
    KYCReview, KYCDocument, ScreeningResult,
    WatchlistEntry,
    CTRReport, SARReport,
    CustomerRelationship, CustomerLink,
    AuditLog, SystemConfig,
)

NOW = datetime.utcnow()
TODAY = NOW.date()

# ─── Indian data ────────────────────────────────────────────────────────────
CITIES = [
    ("Mumbai", "Maharashtra"), ("Delhi", "Delhi"), ("Bangalore", "Karnataka"),
    ("Chennai", "Tamil Nadu"), ("Kolkata", "West Bengal"), ("Hyderabad", "Telangana"),
    ("Pune", "Maharashtra"), ("Ahmedabad", "Gujarat"), ("Jaipur", "Rajasthan"),
    ("Lucknow", "Uttar Pradesh"), ("Kochi", "Kerala"), ("Chandigarh", "Punjab"),
]

OCCUPATIONS = [
    "Software Engineer", "Doctor", "Lawyer", "Business Owner", "Teacher",
    "Government Officer", "Chartered Accountant", "Real Estate Developer",
    "Jeweller", "Import/Export Trader", "Restaurant Owner", "Retired",
    "Student", "Homemaker", "Architect", "Journalist",
]

BANKS = [
    ("State Bank of India", "SBIN"), ("HDFC Bank", "HDFC"), ("ICICI Bank", "ICIC"),
    ("Axis Bank", "UTIB"), ("Punjab National Bank", "PUNB"), ("Bank of Baroda", "BARB"),
    ("Kotak Mahindra", "KKBK"), ("Yes Bank", "YESB"), ("IndusInd Bank", "INDB"),
]


def _uid():
    return str(uuid.uuid4())


def _pan():
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    return f"{''.join(random.choices(letters, k=5))}{''.join(random.choices('0123456789', k=4))}{random.choice(letters)}"


def _acct():
    return f"{''.join(random.choices('0123456789', k=10))}"


def _ifsc(branch_num):
    return f"SNTL0{branch_num:06d}"


def _txn_ref():
    return f"TXN{datetime.utcnow().strftime('%Y%m%d')}{_uid()[:8].upper()}"


def _random_date(start_days_ago, end_days_ago=0):
    start = NOW - timedelta(days=start_days_ago)
    end = NOW - timedelta(days=end_days_ago)
    delta = end - start
    random_seconds = random.randint(0, max(int(delta.total_seconds()), 1))
    return start + timedelta(seconds=random_seconds)


# ─── Seed Functions ─────────────────────────────────────────────────────────

def seed_roles(db: Session) -> dict:
    roles_data = {
        "admin": ("System Administrator", '["all"]'),
        "compliance_officer": ("Compliance Officer", '["view_all","manage_alerts","manage_cases","manage_kyc","manage_reports","manage_rules"]'),
        "analyst": ("Risk Analyst", '["view_all","manage_alerts","add_notes"]'),
        "investigator": ("Fraud Investigator", '["view_all","manage_cases","manage_alerts","add_evidence"]'),
        "auditor": ("Internal Auditor", '["view_all","view_audit_log"]'),
        "viewer": ("Read-Only Viewer", '["view_dashboard","view_alerts","view_cases"]'),
    }
    role_map = {}
    for name, (desc, perms) in roles_data.items():
        role = Role(id=_uid(), name=name, description=desc, permissions=perms)
        db.add(role)
        role_map[name] = role
    db.flush()
    return role_map


def seed_users(db: Session, role_map: dict) -> dict:
    pwd = hash_password("Demo@2026")
    users_data = [
        ("admin", "admin@sentinel.bank", "System Administrator", "IT", ["admin"]),
        ("sunita.krishnan", "sunita@sentinel.bank", "Sunita Krishnan", "Compliance", ["compliance_officer"]),
        ("arun.nair", "arun@sentinel.bank", "Arun Nair", "Compliance", ["compliance_officer"]),
        ("deepa.venkatesh", "deepa@sentinel.bank", "Deepa Venkatesh", "Risk Analytics", ["analyst"]),
        ("ravi.kumar", "ravi@sentinel.bank", "Ravi Kumar", "Risk Analytics", ["analyst"]),
        ("fatima.sheikh", "fatima@sentinel.bank", "Fatima Sheikh", "Risk Analytics", ["analyst"]),
        ("pradeep.mohan", "pradeep@sentinel.bank", "Pradeep Mohan", "Investigations", ["investigator"]),
        ("lakshmi.iyer", "lakshmi@sentinel.bank", "Lakshmi Iyer", "Audit", ["auditor"]),
    ]
    user_map = {}
    for uname, email, fullname, dept, roles in users_data:
        user = User(id=_uid(), username=uname, email=email, password_hash=pwd, full_name=fullname, department=dept)
        db.add(user)
        db.flush()
        for rname in roles:
            db.execute(user_roles.insert().values(user_id=user.id, role_id=role_map[rname].id))
        user_map[uname] = user
    db.flush()
    return user_map


def seed_customers(db: Session) -> list:
    customers = []

    # Define crafted personas
    personas = [
        # Group 1: The Structurer (AML)
        {"num": "CIF-1001", "type": "individual", "first": "Rajesh", "last": "Mehta", "gender": "M", "city": "Mumbai", "state": "Maharashtra", "occupation": "Jeweller", "income": 2500000_00, "risk": "high", "score": 78.5, "pep": False, "kyc": "approved"},
        {"num": "CIF-1002", "type": "individual", "first": "Priya", "last": "Mehta", "gender": "F", "city": "Mumbai", "state": "Maharashtra", "occupation": "Homemaker", "income": 0, "risk": "medium", "score": 45.0, "pep": False, "kyc": "approved"},
        # Group 2: The Layerer (AML)
        {"num": "CIF-1003", "type": "corporate", "company": "Hassan Trading LLC", "city": "Delhi", "state": "Delhi", "occupation": "Import/Export Trader", "income": 50000000_00, "risk": "very_high", "score": 92.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1004", "type": "corporate", "company": "Zenith Enterprises Pvt Ltd", "city": "Delhi", "state": "Delhi", "occupation": "Business Owner", "income": 10000000_00, "risk": "high", "score": 71.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1005", "type": "corporate", "company": "Global Commodities Trading", "city": "Mumbai", "state": "Maharashtra", "occupation": "Import/Export Trader", "income": 25000000_00, "risk": "high", "score": 68.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1006", "type": "corporate", "company": "Pacific Imports Ltd", "city": "Chennai", "state": "Tamil Nadu", "occupation": "Import/Export Trader", "income": 15000000_00, "risk": "high", "score": 65.0, "pep": False, "kyc": "expired"},
        # Group 3: Round-tripper
        {"num": "CIF-1007", "type": "corporate", "company": "Vikram Enterprises", "city": "Bangalore", "state": "Karnataka", "occupation": "Business Owner", "income": 80000000_00, "risk": "high", "score": 74.0, "pep": False, "kyc": "approved"},
        # Group 4: Card fraud victim
        {"num": "CIF-1010", "type": "individual", "first": "Ananya", "last": "Sharma", "gender": "F", "city": "Bangalore", "state": "Karnataka", "occupation": "Software Engineer", "income": 3500000_00, "risk": "medium", "score": 42.0, "pep": False, "kyc": "approved"},
        # Group 5: Account takeover
        {"num": "CIF-1011", "type": "individual", "first": "Srinivas", "last": "Rao", "gender": "M", "city": "Chennai", "state": "Tamil Nadu", "occupation": "Doctor", "income": 5000000_00, "risk": "high", "score": 62.0, "pep": False, "kyc": "approved"},
        # Group 6: PEP
        {"num": "CIF-1015", "type": "individual", "first": "K.", "last": "Dhanabalan", "gender": "M", "city": "Chennai", "state": "Tamil Nadu", "occupation": "Government Officer", "income": 1200000_00, "risk": "very_high", "score": 88.0, "pep": True, "kyc": "approved"},
        # Group 7: Normal good customers
        {"num": "CIF-1020", "type": "individual", "first": "Meera", "last": "Patel", "gender": "F", "city": "Ahmedabad", "state": "Gujarat", "occupation": "Software Engineer", "income": 1800000_00, "risk": "low", "score": 12.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1021", "type": "individual", "first": "Arjun", "last": "Singh", "gender": "M", "city": "Delhi", "state": "Delhi", "occupation": "Teacher", "income": 800000_00, "risk": "low", "score": 8.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1022", "type": "individual", "first": "Kavitha", "last": "Nair", "gender": "F", "city": "Kochi", "state": "Kerala", "occupation": "Chartered Accountant", "income": 2200000_00, "risk": "low", "score": 15.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1023", "type": "individual", "first": "Mohammed", "last": "Iqbal", "gender": "M", "city": "Hyderabad", "state": "Telangana", "occupation": "Real Estate Developer", "income": 4500000_00, "risk": "medium", "score": 38.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1024", "type": "individual", "first": "Lakshmi", "last": "Subramanian", "gender": "F", "city": "Chennai", "state": "Tamil Nadu", "occupation": "Retired", "income": 600000_00, "risk": "low", "score": 10.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1025", "type": "individual", "first": "Vikash", "last": "Gupta", "gender": "M", "city": "Jaipur", "state": "Rajasthan", "occupation": "Restaurant Owner", "income": 1500000_00, "risk": "low", "score": 18.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1026", "type": "individual", "first": "Divya", "last": "Reddy", "gender": "F", "city": "Hyderabad", "state": "Telangana", "occupation": "Lawyer", "income": 3000000_00, "risk": "low", "score": 14.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1027", "type": "individual", "first": "Rohan", "last": "Kapoor", "gender": "M", "city": "Pune", "state": "Maharashtra", "occupation": "Architect", "income": 2800000_00, "risk": "low", "score": 11.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1028", "type": "individual", "first": "Neha", "last": "Joshi", "gender": "F", "city": "Pune", "state": "Maharashtra", "occupation": "Doctor", "income": 4000000_00, "risk": "low", "score": 9.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1029", "type": "individual", "first": "Amit", "last": "Verma", "gender": "M", "city": "Lucknow", "state": "Uttar Pradesh", "occupation": "Government Officer", "income": 900000_00, "risk": "low", "score": 13.0, "pep": False, "kyc": "approved"},
        # More customers for volume
        {"num": "CIF-1030", "type": "individual", "first": "Sanjay", "last": "Deshmukh", "gender": "M", "city": "Mumbai", "state": "Maharashtra", "occupation": "Business Owner", "income": 6000000_00, "risk": "medium", "score": 35.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1031", "type": "individual", "first": "Priyanka", "last": "Chopra", "gender": "F", "city": "Mumbai", "state": "Maharashtra", "occupation": "Journalist", "income": 2000000_00, "risk": "low", "score": 16.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1032", "type": "individual", "first": "Karthik", "last": "Sundaram", "gender": "M", "city": "Bangalore", "state": "Karnataka", "occupation": "Software Engineer", "income": 4200000_00, "risk": "low", "score": 7.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1033", "type": "individual", "first": "Anjali", "last": "Mishra", "gender": "F", "city": "Delhi", "state": "Delhi", "occupation": "Teacher", "income": 700000_00, "risk": "low", "score": 11.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1034", "type": "individual", "first": "Suresh", "last": "Babu", "gender": "M", "city": "Chennai", "state": "Tamil Nadu", "occupation": "Business Owner", "income": 3500000_00, "risk": "medium", "score": 32.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1035", "type": "individual", "first": "Pooja", "last": "Agarwal", "gender": "F", "city": "Kolkata", "state": "West Bengal", "occupation": "Chartered Accountant", "income": 2500000_00, "risk": "low", "score": 14.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1036", "type": "individual", "first": "Rahul", "last": "Dutta", "gender": "M", "city": "Kolkata", "state": "West Bengal", "occupation": "Lawyer", "income": 2800000_00, "risk": "low", "score": 12.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1037", "type": "individual", "first": "Swathi", "last": "Pillai", "gender": "F", "city": "Kochi", "state": "Kerala", "occupation": "Doctor", "income": 3200000_00, "risk": "low", "score": 10.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1038", "type": "individual", "first": "Manoj", "last": "Tiwari", "gender": "M", "city": "Lucknow", "state": "Uttar Pradesh", "occupation": "Real Estate Developer", "income": 5000000_00, "risk": "medium", "score": 40.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1039", "type": "individual", "first": "Rekha", "last": "Sharma", "gender": "F", "city": "Jaipur", "state": "Rajasthan", "occupation": "Homemaker", "income": 0, "risk": "low", "score": 8.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1040", "type": "individual", "first": "Vivek", "last": "Menon", "gender": "M", "city": "Bangalore", "state": "Karnataka", "occupation": "Software Engineer", "income": 5500000_00, "risk": "low", "score": 9.0, "pep": False, "kyc": "approved"},
        # Internal fraud persona
        {"num": "CIF-1050", "type": "individual", "first": "Prakash", "last": "Kulkarni", "gender": "M", "city": "Pune", "state": "Maharashtra", "occupation": "Business Owner", "income": 1200000_00, "risk": "high", "score": 55.0, "pep": False, "kyc": "approved"},
        # More high-risk
        {"num": "CIF-1051", "type": "individual", "first": "Deepak", "last": "Malhotra", "gender": "M", "city": "Chandigarh", "state": "Punjab", "occupation": "Import/Export Trader", "income": 8000000_00, "risk": "high", "score": 72.0, "pep": False, "kyc": "expired"},
        {"num": "CIF-1052", "type": "corporate", "company": "Diamond Star Jewellers", "city": "Mumbai", "state": "Maharashtra", "occupation": "Jeweller", "income": 30000000_00, "risk": "high", "score": 69.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1053", "type": "individual", "first": "Rajiv", "last": "Saxena", "gender": "M", "city": "Delhi", "state": "Delhi", "occupation": "Business Owner", "income": 12000000_00, "risk": "very_high", "score": 85.0, "pep": True, "kyc": "approved"},
        # Additional normal customers to reach 50
        {"num": "CIF-1060", "type": "individual", "first": "Geeta", "last": "Krishnan", "gender": "F", "city": "Hyderabad", "state": "Telangana", "occupation": "Teacher", "income": 750000_00, "risk": "low", "score": 6.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1061", "type": "individual", "first": "Ramesh", "last": "Choudhary", "gender": "M", "city": "Ahmedabad", "state": "Gujarat", "occupation": "Retired", "income": 500000_00, "risk": "low", "score": 10.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1062", "type": "individual", "first": "Bhavna", "last": "Gandhi", "gender": "F", "city": "Ahmedabad", "state": "Gujarat", "occupation": "Architect", "income": 2000000_00, "risk": "low", "score": 11.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1063", "type": "individual", "first": "Tarun", "last": "Bhatia", "gender": "M", "city": "Delhi", "state": "Delhi", "occupation": "Software Engineer", "income": 3800000_00, "risk": "low", "score": 8.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1064", "type": "individual", "first": "Nandini", "last": "Rao", "gender": "F", "city": "Bangalore", "state": "Karnataka", "occupation": "Doctor", "income": 4500000_00, "risk": "low", "score": 7.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1065", "type": "individual", "first": "Aditya", "last": "Jain", "gender": "M", "city": "Mumbai", "state": "Maharashtra", "occupation": "Chartered Accountant", "income": 3000000_00, "risk": "low", "score": 12.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1066", "type": "individual", "first": "Shreya", "last": "Das", "gender": "F", "city": "Kolkata", "state": "West Bengal", "occupation": "Journalist", "income": 1200000_00, "risk": "low", "score": 9.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1067", "type": "individual", "first": "Harish", "last": "Chandra", "gender": "M", "city": "Jaipur", "state": "Rajasthan", "occupation": "Government Officer", "income": 1000000_00, "risk": "low", "score": 14.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1068", "type": "individual", "first": "Vandana", "last": "Khanna", "gender": "F", "city": "Chandigarh", "state": "Punjab", "occupation": "Business Owner", "income": 2800000_00, "risk": "low", "score": 15.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1069", "type": "individual", "first": "Prasad", "last": "Hegde", "gender": "M", "city": "Bangalore", "state": "Karnataka", "occupation": "Restaurant Owner", "income": 1800000_00, "risk": "low", "score": 11.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1070", "type": "individual", "first": "Asha", "last": "Pandey", "gender": "F", "city": "Lucknow", "state": "Uttar Pradesh", "occupation": "Lawyer", "income": 2200000_00, "risk": "low", "score": 10.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1071", "type": "individual", "first": "Sandeep", "last": "Gill", "gender": "M", "city": "Chandigarh", "state": "Punjab", "occupation": "Software Engineer", "income": 3500000_00, "risk": "low", "score": 8.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1072", "type": "individual", "first": "Priti", "last": "Mahajan", "gender": "F", "city": "Pune", "state": "Maharashtra", "occupation": "Teacher", "income": 900000_00, "risk": "low", "score": 7.0, "pep": False, "kyc": "approved"},
        {"num": "CIF-1073", "type": "individual", "first": "Venkat", "last": "Raman", "gender": "M", "city": "Chennai", "state": "Tamil Nadu", "occupation": "Retired", "income": 400000_00, "risk": "low", "score": 9.0, "pep": False, "kyc": "approved"},
    ]

    for p in personas:
        cid = _uid()
        c = Customer(
            id=cid,
            customer_number=p["num"],
            customer_type=p["type"],
            first_name=p.get("first"),
            last_name=p.get("last"),
            company_name=p.get("company"),
            date_of_birth=date(random.randint(1955, 2000), random.randint(1, 12), random.randint(1, 28)) if p["type"] == "individual" else None,
            gender=p.get("gender"),
            nationality="IN",
            pan_number=_pan(),
            email=f"{p.get('first', p.get('company', 'info')).lower().replace(' ', '').replace('.', '')}@{'gmail' if p['type'] == 'individual' else 'company'}.com",
            phone=f"+91{random.randint(7000000000, 9999999999)}",
            address_line1=f"{random.randint(1, 500)}, {random.choice(['MG Road', 'Park Street', 'Brigade Road', 'Anna Salai', 'FC Road', 'Linking Road'])}",
            city=p["city"],
            state=p["state"],
            country="IN",
            postal_code=f"{random.randint(100000, 999999)}",
            occupation=p.get("occupation", ""),
            annual_income=p["income"],
            source_of_funds="Business Income" if p["income"] > 3000000_00 else "Salary",
            risk_category=p["risk"],
            risk_score=p["score"],
            pep_status=p["pep"],
            kyc_status=p["kyc"],
            kyc_expiry_date=TODAY + timedelta(days=random.randint(-30, 365)),
            onboarding_date=TODAY - timedelta(days=random.randint(365, 2000)),
        )
        db.add(c)
        customers.append(c)

    db.flush()
    return customers


def seed_accounts(db: Session, customers: list) -> dict:
    """Create 1-3 accounts per customer."""
    acct_map = {}  # customer_id -> [accounts]

    branch_num = 1
    for c in customers:
        num_accounts = 1 if c.risk_category == "low" else random.choice([1, 2, 3])
        accts = []

        # Primary savings/current account
        acct_type = "current" if c.customer_type == "corporate" else "savings"
        balance = random.randint(50000_00, 50000000_00) if c.customer_type == "corporate" else random.randint(10000_00, 5000000_00)
        a = Account(
            id=_uid(), account_number=_acct(), customer_id=c.id,
            account_type=acct_type, balance=balance, status="active",
            branch_code=f"BR{branch_num:04d}", ifsc_code=_ifsc(branch_num),
            opened_date=c.onboarding_date,
        )
        db.add(a)
        accts.append(a)
        branch_num = (branch_num % 20) + 1

        if num_accounts >= 2:
            a2 = Account(
                id=_uid(), account_number=_acct(), customer_id=c.id,
                account_type=random.choice(["savings", "fixed_deposit"]),
                balance=random.randint(100000_00, 10000000_00), status="active",
                branch_code=f"BR{branch_num:04d}", ifsc_code=_ifsc(branch_num),
                opened_date=c.onboarding_date + timedelta(days=random.randint(30, 365)),
            )
            db.add(a2)
            accts.append(a2)

        if num_accounts >= 3:
            a3 = Account(
                id=_uid(), account_number=_acct(), customer_id=c.id,
                account_type="credit_card",
                balance=random.randint(-500000_00, 0), status="active",
                branch_code=f"BR{branch_num:04d}", ifsc_code=_ifsc(branch_num),
                opened_date=c.onboarding_date + timedelta(days=random.randint(60, 500)),
            )
            db.add(a3)
            accts.append(a3)

        acct_map[c.id] = accts

    db.flush()
    return acct_map


def seed_transactions(db: Session, customers: list, acct_map: dict) -> list:
    """Generate 5000+ transactions with realistic patterns."""
    all_txns = []
    channels = ["branch", "atm", "internet_banking", "mobile_banking", "pos", "swift"]
    cities_list = [c[0] for c in CITIES]

    for c in customers:
        accts = acct_map.get(c.id, [])
        if not accts:
            continue

        primary_acct = accts[0]

        if c.risk_category in ("high", "very_high"):
            # Suspicious patterns
            num_txns = random.randint(80, 200)
        elif c.risk_category == "medium":
            num_txns = random.randint(50, 120)
        else:
            num_txns = random.randint(30, 80)

        for _ in range(num_txns):
            acct = random.choice(accts)
            dt = _random_date(90, 0)
            city = c.city
            country = "IN"
            channel = random.choice(channels[:5])  # Mostly domestic
            flagged = False
            flag_reason = None
            risk = random.uniform(0, 20)

            # ── Structuring pattern (Rajesh Mehta CIF-1001) ──
            if c.customer_number == "CIF-1001" and random.random() < 0.3:
                amount = random.randint(900000_00, 999000_00)  # Just below 10L
                method = "cash_deposit"
                channel = "branch"
                city = random.choice(["Mumbai", "Pune", "Thane"])
                txn_type = "credit"
                risk = random.uniform(60, 85)
                flagged = True
                flag_reason = "Potential structuring - amount below CTR threshold"
            # ── Layering pattern (Hassan Trading CIF-1003) ──
            elif c.customer_number == "CIF-1003" and random.random() < 0.25:
                amount = random.randint(5000000_00, 20000000_00)
                method = random.choice(["rtgs", "neft", "swift"])
                channel = random.choice(["internet_banking", "swift"])
                txn_type = random.choice(["credit", "debit"])
                risk = random.uniform(70, 95)
                flagged = True
                flag_reason = "Rapid high-value transfers - layering pattern"
            # ── Card fraud (Ananya Sharma CIF-1010) ──
            elif c.customer_number == "CIF-1010" and random.random() < 0.15:
                amount = random.randint(5000_00, 100000_00)
                method = "card_payment"
                channel = "pos"
                city = random.choice(["Delhi", "Kolkata", "Mumbai"])  # Not her home city
                txn_type = "debit"
                risk = random.uniform(50, 75)
                flagged = True
                flag_reason = "Geographic anomaly - card used far from home"
            # ── Account takeover (Dr. Srinivas Rao CIF-1011) ──
            elif c.customer_number == "CIF-1011" and random.random() < 0.1:
                amount = random.randint(1000000_00, 1500000_00)
                method = "neft"
                channel = "internet_banking"
                txn_type = "debit"
                risk = random.uniform(65, 90)
                flagged = True
                flag_reason = "High-value transfer after device change"
            # ── PEP high cash (K. Dhanabalan CIF-1015) ──
            elif c.customer_number == "CIF-1015" and random.random() < 0.2:
                amount = random.randint(500000_00, 2000000_00)
                method = "cash_deposit"
                channel = "branch"
                txn_type = "credit"
                risk = random.uniform(55, 80)
                flagged = True
                flag_reason = "PEP customer - large cash transaction"
            # ── Normal transaction ──
            else:
                if c.customer_type == "corporate":
                    amount = random.randint(10000_00, 5000000_00)
                else:
                    amount = random.randint(100_00, 500000_00)

                method = random.choice(["neft", "upi", "imps", "card_payment", "atm", "cash_deposit", "cash_withdrawal", "internal_transfer"])
                txn_type = random.choice(["credit", "debit"])

                if method in ("cash_deposit", "cash_withdrawal"):
                    channel = random.choice(["branch", "atm"])
                elif method in ("upi", "imps"):
                    channel = "mobile_banking"
                elif method in ("neft", "rtgs", "internal_transfer"):
                    channel = "internet_banking"
                elif method == "card_payment":
                    channel = "pos"
                elif method == "atm":
                    channel = "atm"
                else:
                    channel = random.choice(channels[:5])

            # Counterparty
            bank = random.choice(BANKS)
            counterparty_name = f"{random.choice(['Acme', 'Global', 'Star', 'Prime', 'Metro'])} {random.choice(['Corp', 'Ltd', 'Services', 'Traders', 'Solutions'])}" if random.random() < 0.5 else None

            txn = Transaction(
                id=_uid(),
                transaction_ref=f"TXN{dt.strftime('%Y%m%d')}{_uid()[:8].upper()}",
                account_id=acct.id,
                customer_id=c.id,
                transaction_type=txn_type,
                transaction_method=method,
                channel=channel,
                amount=amount,
                balance_after=acct.balance + (amount if txn_type == "credit" else -amount),
                counterparty_name=counterparty_name,
                counterparty_account=_acct() if counterparty_name else None,
                counterparty_bank=bank[0] if counterparty_name else None,
                counterparty_ifsc=f"{bank[1]}0{random.randint(100000, 999999)}" if counterparty_name else None,
                description=f"{method.upper()}/{c.customer_number}/{dt.strftime('%b%Y').upper()}",
                location_city=city,
                location_country=country,
                risk_score=risk,
                is_flagged=flagged,
                flag_reason=flag_reason,
                transaction_date=dt,
                value_date=dt.date(),
                processing_status="completed",
            )
            db.add(txn)
            all_txns.append(txn)

    db.flush()
    return all_txns


def seed_rules(db: Session) -> list:
    """Create 26 pre-built detection rules."""
    rules = []

    rules_data = [
        # AML - Structuring
        ("AML-STR-001", "Single Cash Transaction Above CTR Threshold", "aml", "structuring", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.amount", "operator": "greater_than_or_equal", "value": 1000000_00}, {"field": "transaction.transaction_method", "operator": "in", "value": ["cash_deposit", "cash_withdrawal"]}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "aml"}}, {"action": "generate_ctr", "params": {}}],
         None, 1000000_00, None),

        ("AML-STR-002", "Multiple Cash Deposits Below Threshold in 24h", "aml", "structuring", "critical",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "equals", "value": "cash_deposit"}, {"field": "aggregate.cash_transaction_sum", "operator": "greater_than", "value": 1000000_00, "time_window": "24h"}, {"field": "aggregate.cash_transaction_count", "operator": "greater_than", "value": 2, "time_window": "24h"}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "aml"}}, {"action": "flag_transaction", "params": {"reason": "Structuring pattern"}}],
         "24h", None, 2),

        ("AML-STR-003", "Cash Deposits Just Below Threshold Pattern", "aml", "structuring", "critical",
         {"logic": "AND", "conditions": [{"field": "transaction.amount", "operator": "between", "value": [900000_00, 999999_00]}, {"field": "transaction.transaction_method", "operator": "equals", "value": "cash_deposit"}, {"field": "aggregate.transaction_count", "operator": "greater_than", "value": 2, "time_window": "7d"}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "aml"}}, {"action": "adjust_risk_score", "params": {"adjustment": 20, "direction": "increase"}}],
         "7d", 900000_00, 2),

        ("AML-STR-004", "Cash Deposits From Multiple Branches", "aml", "structuring", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "in", "value": ["cash_deposit"]}, {"field": "aggregate.unique_locations", "operator": "greater_than", "value": 2, "time_window": "24h"}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "aml"}}],
         "24h", None, None),

        ("AML-STR-005", "Round Amount Cash Deposits Pattern", "aml", "structuring", "medium",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "in", "value": ["cash_deposit"]}, {"field": "aggregate.round_amount_count", "operator": "greater_than", "value": 3, "time_window": "7d"}]},
         [{"action": "create_alert", "params": {"priority": "medium", "alert_type": "aml"}}],
         "7d", None, 3),

        # AML - Layering
        ("AML-LAY-001", "Rapid Fund Transfers Through Multiple Accounts", "aml", "layering", "critical",
         {"logic": "AND", "conditions": [{"field": "aggregate.unique_counterparties", "operator": "greater_than", "value": 3, "time_window": "24h"}, {"field": "aggregate.transaction_sum", "operator": "greater_than", "value": 5000000_00, "time_window": "24h"}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "aml"}}, {"action": "flag_transaction", "params": {"reason": "Layering pattern"}}],
         "24h", 5000000_00, None),

        ("AML-LAY-002", "High Value Transfer Followed by Immediate Withdrawal", "aml", "layering", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.amount", "operator": "greater_than", "value": 2000000_00}, {"field": "transaction.transaction_type", "operator": "equals", "value": "debit"}, {"field": "aggregate.transaction_count", "operator": "greater_than", "value": 3, "time_window": "1h"}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "aml"}}],
         "1h", 2000000_00, 3),

        ("AML-LAY-003", "Rapid Incoming and Outgoing Transfers", "aml", "layering", "high",
         {"logic": "AND", "conditions": [{"field": "aggregate.transaction_count", "operator": "greater_than", "value": 5, "time_window": "1h"}, {"field": "aggregate.transaction_sum", "operator": "greater_than", "value": 2000000_00, "time_window": "1h"}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "aml"}}],
         "1h", None, 5),

        ("AML-LAY-004", "Multiple Small Transfers to Single Beneficiary", "aml", "layering", "medium",
         {"logic": "AND", "conditions": [{"field": "transaction.amount", "operator": "less_than", "value": 200000_00}, {"field": "aggregate.transaction_count", "operator": "greater_than", "value": 5, "time_window": "24h"}]},
         [{"action": "create_alert", "params": {"priority": "medium", "alert_type": "aml"}}],
         "24h", None, 5),

        # AML - Geographic
        ("AML-GEO-001", "Transaction From High Risk Country", "aml", "geographic", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.location_country", "operator": "in", "value": ["AF", "IR", "KP", "SY", "YE", "MM"]}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "aml"}}, {"action": "flag_transaction", "params": {"reason": "High-risk country"}}],
         None, None, None),

        ("AML-GEO-002", "Sudden International Wire From Domestic Account", "aml", "geographic", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "equals", "value": "swift"}, {"field": "transaction.amount", "operator": "greater_than", "value": 500000_00}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "aml"}}],
         None, 500000_00, None),

        ("AML-GEO-003", "Transactions From Multiple Countries in 24h", "aml", "geographic", "critical",
         {"logic": "AND", "conditions": [{"field": "aggregate.unique_locations", "operator": "greater_than", "value": 2, "time_window": "24h"}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "aml"}}],
         "24h", None, None),

        # Fraud - Card
        ("FRD-CRD-001", "Card Used in Multiple Countries Within 6h", "fraud", "card", "critical",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "equals", "value": "card_payment"}, {"field": "aggregate.unique_locations", "operator": "greater_than", "value": 1, "time_window": "6h"}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Geographic anomaly"}}],
         "6h", None, None),

        ("FRD-CRD-002", "Card Transaction 5x Average Spending", "fraud", "card", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "in", "value": ["card_payment", "pos"]}, {"field": "transaction.amount", "operator": "greater_than", "value": 100000_00}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}],
         None, 100000_00, None),

        ("FRD-CRD-003", "Multiple Declined Then Successful Transaction", "fraud", "card", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "in", "value": ["card_payment"]}, {"field": "aggregate.transaction_count", "operator": "greater_than", "value": 3, "time_window": "1h"}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}],
         "1h", None, 3),

        # Fraud - Identity/Account Takeover
        ("FRD-ATO-001", "Password Change Followed by Large Transfer", "fraud", "identity", "critical",
         {"logic": "AND", "conditions": [{"field": "transaction.amount", "operator": "greater_than", "value": 500000_00}, {"field": "transaction.channel", "operator": "equals", "value": "internet_banking"}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Possible account takeover"}}],
         "1h", 500000_00, None),

        ("FRD-ATO-002", "New Device High Value Transaction", "fraud", "identity", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.amount", "operator": "greater_than", "value": 200000_00}, {"field": "transaction.channel", "operator": "in", "value": ["internet_banking", "mobile_banking"]}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}],
         None, 200000_00, None),

        ("FRD-ATO-003", "Multiple Failed Login Attempts", "fraud", "identity", "medium",
         {"logic": "AND", "conditions": [{"field": "aggregate.transaction_count", "operator": "greater_than", "value": 5, "time_window": "1h"}]},
         [{"action": "create_alert", "params": {"priority": "medium", "alert_type": "fraud"}}],
         "1h", None, 5),

        # Fraud - Wire/Transfer
        ("FRD-WIR-001", "First Time International Wire Above Threshold", "fraud", "wire", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "equals", "value": "swift"}, {"field": "transaction.amount", "operator": "greater_than", "value": 500000_00}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}],
         None, 500000_00, None),

        ("FRD-WIR-002", "Wire to New Beneficiary Above Threshold", "fraud", "wire", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "in", "value": ["neft", "rtgs", "swift"]}, {"field": "transaction.amount", "operator": "greater_than", "value": 200000_00}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}],
         None, 200000_00, None),

        ("FRD-WIR-003", "Large Standing Instruction to New Account", "fraud", "wire", "medium",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "equals", "value": "standing_instruction"}, {"field": "transaction.amount", "operator": "greater_than", "value": 100000_00}]},
         [{"action": "create_alert", "params": {"priority": "medium", "alert_type": "fraud"}}],
         None, 100000_00, None),

        # KYC/CDD
        ("KYC-001", "Expired KYC Customer Transaction", "kyc", "compliance", "high",
         {"logic": "AND", "conditions": [{"field": "customer.kyc_status", "operator": "equals", "value": "expired"}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "kyc"}}, {"action": "trigger_edd", "params": {"reason": "KYC expired"}}],
         None, None, None),

        ("KYC-002", "Transaction Inconsistent With Income", "kyc", "compliance", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.amount", "operator": "greater_than", "value": 1000000_00}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "kyc"}}],
         None, 1000000_00, None),

        ("KYC-003", "PEP Customer Large Cash Transaction", "kyc", "pep", "critical",
         {"logic": "AND", "conditions": [{"field": "customer.pep_status", "operator": "equals", "value": True}, {"field": "transaction.transaction_method", "operator": "in", "value": ["cash_deposit", "cash_withdrawal"]}, {"field": "transaction.amount", "operator": "greater_than", "value": 200000_00}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "kyc"}}, {"action": "trigger_edd", "params": {"reason": "PEP large cash"}}],
         None, 200000_00, None),

        # Compliance
        ("CMP-001", "Dormant Account Reactivation With Large Deposit", "compliance", "dormant", "high",
         {"logic": "AND", "conditions": [{"field": "account.status", "operator": "equals", "value": "dormant"}, {"field": "transaction.amount", "operator": "greater_than", "value": 500000_00}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "compliance"}}],
         None, 500000_00, None),

        ("CMP-002", "Unusual Number of New Beneficiaries", "compliance", "beneficiary", "medium",
         {"logic": "AND", "conditions": [{"field": "aggregate.unique_counterparties", "operator": "greater_than", "value": 10, "time_window": "30d"}]},
         [{"action": "create_alert", "params": {"priority": "medium", "alert_type": "compliance"}}],
         "30d", None, 10),
    ]

    for name, desc, cat, subcat, sev, conds, acts, tw, threshold_amt, threshold_cnt in rules_data:
        r = Rule(
            id=_uid(), name=name, description=desc, category=cat, subcategory=subcat,
            severity=sev, is_enabled=True, priority=10 if sev == "critical" else 20 if sev == "high" else 30,
            conditions=json.dumps(conds), actions=json.dumps(acts),
            time_window=tw, threshold_amount=threshold_amt, threshold_count=threshold_cnt,
            detection_count=random.randint(0, 50),
            last_triggered_at=_random_date(30, 0) if random.random() < 0.7 else None,
        )
        db.add(r)
        rules.append(r)

    db.flush()
    return rules


def seed_scenarios(db: Session, rules: list):
    rule_by_name = {r.name: r for r in rules}

    scenarios_data = [
        ("Structuring Detection", "Detects cash structuring patterns designed to avoid CTR reporting thresholds", "aml",
         ["AML-STR-001", "AML-STR-002", "AML-STR-003", "AML-STR-004", "AML-STR-005"]),
        ("Layering Detection", "Identifies rapid fund movement through multiple accounts to obscure origin", "aml",
         ["AML-LAY-001", "AML-LAY-002", "AML-LAY-003", "AML-LAY-004"]),
        ("Geographic Risk", "Monitors transactions involving high-risk jurisdictions", "aml",
         ["AML-GEO-001", "AML-GEO-002", "AML-GEO-003"]),
        ("Card Fraud Detection", "Real-time card transaction anomaly detection", "fraud",
         ["FRD-CRD-001", "FRD-CRD-002", "FRD-CRD-003"]),
        ("Account Takeover Prevention", "Detects unauthorized account access patterns", "fraud",
         ["FRD-ATO-001", "FRD-ATO-002", "FRD-ATO-003"]),
        ("Wire Fraud Prevention", "Monitors wire transfers for fraudulent patterns", "fraud",
         ["FRD-WIR-001", "FRD-WIR-002", "FRD-WIR-003"]),
        ("KYC Compliance Monitoring", "Ensures KYC compliance for all customer transactions", "kyc",
         ["KYC-001", "KYC-002", "KYC-003"]),
        ("PEP Enhanced Monitoring", "Enhanced monitoring for Politically Exposed Persons", "kyc",
         ["KYC-003"]),
        ("Dormant Account Monitoring", "Monitors reactivation of dormant accounts", "compliance",
         ["CMP-001"]),
        ("Beneficiary Risk Monitoring", "Tracks unusual beneficiary addition patterns", "compliance",
         ["CMP-002"]),
    ]

    for name, desc, cat, rule_names in scenarios_data:
        rids = [rule_by_name[rn].id for rn in rule_names if rn in rule_by_name]
        s = Scenario(
            id=_uid(), name=name, description=desc, category=cat,
            rule_ids=json.dumps(rids), is_enabled=True,
            detection_count=random.randint(5, 100),
            last_triggered_at=_random_date(14, 0),
        )
        db.add(s)
    db.flush()


def seed_alerts(db: Session, customers: list, rules: list, user_map: dict) -> list:
    """Create 150+ alerts in various states."""
    alerts = []
    analysts = [user_map["deepa.venkatesh"], user_map["ravi.kumar"], user_map["fatima.sheikh"]]
    compliance = [user_map["sunita.krishnan"], user_map["arun.nair"]]

    high_risk_customers = [c for c in customers if c.risk_category in ("high", "very_high")]
    medium_risk_customers = [c for c in customers if c.risk_category == "medium"]
    all_risky = high_risk_customers + medium_risk_customers

    statuses = (
        [("new", 30)] +
        [("assigned", 35)] +
        [("under_review", 25)] +
        [("escalated", 15)] +
        [("closed_true_positive", 20)] +
        [("closed_false_positive", 15)] +
        [("closed_inconclusive", 10)]
    )

    alert_counter = 1
    for status, count in statuses:
        for i in range(count):
            customer = random.choice(all_risky if status != "closed_false_positive" else customers)
            rule = random.choice(rules)
            priority = rule.severity
            dt = _random_date(60, 0)

            alert_num = f"ALT-{dt.strftime('%Y%m%d')}-{alert_counter:04d}"
            alert_counter += 1

            sla_hours = {"critical": 4, "high": 24, "medium": 72, "low": 168}.get(priority, 72)
            sla_due = dt + timedelta(hours=sla_hours)
            is_overdue = NOW > sla_due and status not in ("closed_true_positive", "closed_false_positive", "closed_inconclusive")

            assigned_to = None
            assigned_at = None
            closed_by = None
            closed_at = None

            if status in ("assigned", "under_review", "escalated", "closed_true_positive", "closed_false_positive", "closed_inconclusive"):
                assigned_to = random.choice(analysts).id
                assigned_at = dt + timedelta(hours=random.randint(1, 12))

            if status in ("closed_true_positive", "closed_false_positive", "closed_inconclusive"):
                closed_by = random.choice(compliance).id
                closed_at = dt + timedelta(days=random.randint(1, 14))

            alert = Alert(
                id=_uid(),
                alert_number=alert_num,
                rule_id=rule.id,
                customer_id=customer.id,
                alert_type=rule.category,
                priority=priority,
                risk_score=random.uniform(40, 95),
                status=status,
                title=f"{rule.description} - {customer.full_name}",
                description=f"Rule {rule.name} triggered for customer {customer.customer_number}. {rule.description}",
                details=json.dumps({"rule": rule.name, "customer": customer.customer_number, "triggered_values": {"amount": random.randint(100000_00, 10000000_00)}}),
                assigned_to=assigned_to,
                assigned_at=assigned_at,
                sla_due_at=sla_due,
                is_overdue=is_overdue,
                closed_by=closed_by,
                closed_at=closed_at,
                closure_reason="Confirmed suspicious activity" if status == "closed_true_positive" else "Normal business activity" if status == "closed_false_positive" else None,
                created_at=dt,
            )
            db.add(alert)
            alerts.append(alert)

    db.flush()
    return alerts


def seed_cases(db: Session, customers: list, alerts: list, user_map: dict) -> list:
    """Create 25 cases."""
    cases = []
    investigator = user_map["pradeep.mohan"]
    compliance = [user_map["sunita.krishnan"], user_map["arun.nair"]]
    analysts = [user_map["deepa.venkatesh"], user_map["ravi.kumar"]]

    high_risk = [c for c in customers if c.risk_category in ("high", "very_high")]

    case_configs = [
        ("open", 5), ("assigned", 4), ("under_investigation", 5),
        ("escalated", 3), ("pending_regulatory", 2),
        ("closed_true_positive", 4), ("closed_false_positive", 2),
    ]

    case_counter = 1
    for status, count in case_configs:
        for i in range(count):
            customer = random.choice(high_risk)
            dt = _random_date(60, 0)
            case_num = f"CSE-{dt.strftime('%Y%m%d')}-{case_counter:04d}"
            case_counter += 1

            case_type = random.choice(["aml_investigation", "fraud_investigation", "kyc_review", "compliance_review"])
            priority = random.choice(["critical", "high", "medium"])

            assigned_to = None
            if status != "open":
                assigned_to = random.choice([investigator] + analysts).id

            c = Case(
                id=_uid(),
                case_number=case_num,
                title=f"{case_type.replace('_', ' ').title()} - {customer.full_name}",
                description=f"Investigation into suspicious activities by {customer.customer_number}",
                case_type=case_type,
                priority=priority,
                status=status,
                customer_id=customer.id,
                assigned_to=assigned_to,
                assigned_at=dt + timedelta(hours=2) if assigned_to else None,
                sla_due_at=dt + timedelta(days=30),
                is_overdue=random.random() < 0.2,
                disposition="true_positive" if status == "closed_true_positive" else "false_positive" if status == "closed_false_positive" else None,
                total_suspicious_amount=random.randint(500000_00, 50000000_00),
                regulatory_filed=status == "pending_regulatory",
                created_at=dt,
            )
            db.add(c)
            db.flush()

            # Link some alerts to this case
            customer_alerts = [a for a in alerts if a.customer_id == customer.id][:3]
            for a in customer_alerts:
                db.execute(case_alerts.insert().values(case_id=c.id, alert_id=a.id))
                a.case_id = c.id

            # Add activities
            act = CaseActivity(case_id=c.id, user_id=user_map["admin"].id, activity_type="created", description="Case created from alert investigation", created_at=dt)
            db.add(act)
            if assigned_to:
                act2 = CaseActivity(case_id=c.id, user_id=user_map["admin"].id, activity_type="assigned", description=f"Assigned to investigator", created_at=dt + timedelta(hours=2))
                db.add(act2)

            cases.append(c)

    db.flush()
    return cases


def seed_watchlist(db: Session):
    """Create 200 watchlist entries."""
    sources = ["ofac_sdn", "un_consolidated", "eu_sanctions", "india_mha", "internal_blacklist", "pep_list"]
    nationalities = ["PK", "AF", "IR", "SY", "MM", "KP", "YE", "IQ", "LY", "SD", "IN", "BD", "LK", "NP", "AE", "SA"]

    # Realistic-ish names
    first_names = ["Mohammed", "Abdul", "Hassan", "Ali", "Omar", "Ibrahim", "Yusuf", "Ahmad", "Khalid", "Tariq",
                   "Fatima", "Aisha", "Zahra", "Mariam", "Khadija", "Raj", "Vikram", "Suresh", "Deepak", "Ganesh"]
    last_names = ["Khan", "Al-Rashid", "Bukhari", "Syed", "Sheikh", "Qureshi", "Malik", "Ahmed", "Hussain", "Patel",
                  "Gupta", "Sharma", "Singh", "Kumar", "Nair", "Das", "Roy", "Jain", "Mehta", "Reddy"]

    for i in range(200):
        fname = random.choice(first_names)
        lname = random.choice(last_names)
        full_name = f"{fname} {lname}"
        aliases = json.dumps([f"{fname[0]}. {lname}", f"{lname}, {fname}"]) if random.random() < 0.4 else None

        entry = WatchlistEntry(
            id=_uid(),
            list_source=random.choice(sources),
            entry_type=random.choice(["individual", "entity"]) if random.random() < 0.8 else "entity",
            full_name=full_name,
            aliases=aliases,
            date_of_birth=date(random.randint(1940, 1995), random.randint(1, 12), random.randint(1, 28)) if random.random() < 0.6 else None,
            nationality=random.choice(nationalities),
            country=random.choice(nationalities),
            reason=random.choice(["Terrorism financing", "Money laundering", "Narcotics trafficking", "Sanctions violation", "Corruption", "Arms dealing", "Tax evasion", "Fraud"]),
            listed_date=date(random.randint(2015, 2026), random.randint(1, 12), random.randint(1, 28)),
            is_active=True,
        )
        db.add(entry)

    db.flush()


def seed_kyc(db: Session, customers: list, user_map: dict):
    """Create KYC reviews and documents for all customers."""
    reviewer_id = user_map["sunita.krishnan"].id

    # First pass: create all reviews
    reviews = {}
    for c in customers:
        review_id = _uid()
        review = KYCReview(
            id=review_id,
            customer_id=c.id,
            review_type="onboarding" if random.random() < 0.6 else random.choice(["periodic", "trigger_based"]),
            risk_assessment=c.risk_category,
            status="approved" if c.kyc_status == "approved" else c.kyc_status,
            reviewer_id=reviewer_id if c.kyc_status in ("approved", "rejected") else None,
            due_date=TODAY + timedelta(days=random.randint(-30, 180)),
            completed_date=TODAY - timedelta(days=random.randint(30, 365)) if c.kyc_status == "approved" else None,
            findings="KYC verified, all documents in order" if c.kyc_status == "approved" else None,
            edd_required=c.risk_category in ("high", "very_high") or c.pep_status,
            edd_reason="High risk customer" if c.risk_category in ("high", "very_high") else "PEP status" if c.pep_status else None,
            next_review_date=TODAY + timedelta(days=90 if c.risk_category == "high" else 180 if c.risk_category == "medium" else 365),
        )
        db.add(review)
        reviews[c.id] = review_id
    db.flush()

    # Second pass: documents and screenings
    for c in customers:
        review_id = reviews[c.id]

        doc_types = ["pan_card", "aadhaar"]
        if c.customer_type == "individual":
            doc_types.extend(random.sample(["passport", "voter_id", "driving_license", "utility_bill"], k=random.randint(0, 2)))
        else:
            doc_types.extend(["incorporation_cert", "board_resolution"])

        for dt in doc_types:
            doc = KYCDocument(
                id=_uid(),
                customer_id=c.id,
                kyc_review_id=review_id,
                document_type=dt,
                document_number=_pan() if dt == "pan_card" else f"DOC{random.randint(100000, 999999)}",
                verified=c.kyc_status == "approved",
                verified_by=reviewer_id if c.kyc_status == "approved" else None,
                verified_at=NOW - timedelta(days=random.randint(30, 365)) if c.kyc_status == "approved" else None,
            )
            db.add(doc)

        for screening_type in ["pep", "sanctions", "adverse_media"]:
            match = c.pep_status and screening_type == "pep"
            result = ScreeningResult(
                id=_uid(),
                customer_id=c.id,
                screening_type=screening_type,
                source={"pep": "pep_database", "sanctions": "ofac", "adverse_media": "media_check"}[screening_type],
                match_found=match,
                match_score=random.uniform(85, 99) if match else random.uniform(0, 30),
                matched_name=c.full_name if match else None,
                status="confirmed_match" if match else "cleared",
                reviewed_by=reviewer_id,
                reviewed_at=NOW - timedelta(days=random.randint(1, 90)),
            )
            db.add(result)

    db.flush()


def seed_network(db: Session, customers: list):
    """Create relationships and links between customers."""
    cust_by_num = {c.customer_number: c for c in customers}

    # Explicit relationships
    relationships = [
        ("CIF-1001", "CIF-1002", "spouse", 0.95),
        ("CIF-1003", "CIF-1004", "business_partner", 0.8),
        ("CIF-1003", "CIF-1005", "business_partner", 0.7),
        ("CIF-1004", "CIF-1006", "business_partner", 0.6),
        ("CIF-1005", "CIF-1006", "business_partner", 0.65),
        ("CIF-1003", "CIF-1007", "business_partner", 0.5),
        ("CIF-1053", "CIF-1015", "business_partner", 0.4),
        ("CIF-1001", "CIF-1052", "business_partner", 0.7),
    ]

    for c1_num, c2_num, rel_type, strength in relationships:
        c1 = cust_by_num.get(c1_num)
        c2 = cust_by_num.get(c2_num)
        if c1 and c2:
            rel = CustomerRelationship(
                id=_uid(), customer_id_1=c1.id, customer_id_2=c2.id,
                relationship_type=rel_type, strength=strength, is_verified=True,
            )
            db.add(rel)

    # Auto-detected links
    links = [
        ("CIF-1001", "CIF-1002", "shared_address", "42, MG Road, Mumbai"),
        ("CIF-1001", "CIF-1002", "shared_phone", "+919876543210"),
        ("CIF-1003", "CIF-1004", "fund_transfer", "Multiple RTGS transfers"),
        ("CIF-1004", "CIF-1005", "fund_transfer", "NEFT transfers totaling INR 5Cr"),
        ("CIF-1005", "CIF-1006", "fund_transfer", "SWIFT transfers to overseas"),
        ("CIF-1003", "CIF-1005", "shared_address", "14, Connaught Place, Delhi"),
        ("CIF-1051", "CIF-1052", "shared_employer", "Diamond Star Group"),
    ]

    for c1_num, c2_num, link_type, detail in links:
        c1 = cust_by_num.get(c1_num)
        c2 = cust_by_num.get(c2_num)
        if c1 and c2:
            link = CustomerLink(
                id=_uid(), customer_id_1=c1.id, customer_id_2=c2.id,
                link_type=link_type, link_detail=detail,
            )
            db.add(link)

    db.flush()


def seed_reports(db: Session, customers: list, cases: list, user_map: dict):
    """Create CTR and SAR reports."""
    filer = user_map["sunita.krishnan"]

    # CTR reports
    high_cash_customers = [c for c in customers if c.risk_category in ("high", "very_high")]
    for i in range(15):
        customer = random.choice(high_cash_customers)
        dt = _random_date(60, 0)
        ctr = CTRReport(
            id=_uid(),
            report_number=f"CTR-{dt.strftime('%Y%m%d')}-{i+1:04d}",
            customer_id=customer.id,
            transaction_amount=random.randint(1000000_00, 5000000_00),
            transaction_date=dt,
            filing_status=random.choice(["auto_generated", "pending_review", "filed"]),
            filed_by=filer.id if random.random() < 0.6 else None,
            filed_at=dt + timedelta(days=1) if random.random() < 0.6 else None,
        )
        db.add(ctr)

    # SAR reports
    for i in range(5):
        customer = random.choice(high_cash_customers)
        c = cases[i] if i < len(cases) else None
        dt = _random_date(45, 0)
        sar = SARReport(
            id=_uid(),
            report_number=f"SAR-{dt.strftime('%Y%m%d')}-{i+1:04d}",
            case_id=c.id if c else None,
            customer_id=customer.id,
            suspicious_activity_type=random.choice(["Structuring", "Layering", "Round-tripping", "Identity theft", "Unusual cash activity"]),
            narrative=f"Suspicious activity detected for customer {customer.customer_number}. Multiple transactions exhibiting patterns consistent with potential money laundering. Total suspicious amount: INR {random.randint(10, 500)} lakhs over a {random.randint(7, 60)} day period.",
            total_amount=random.randint(1000000_00, 50000000_00),
            date_range_start=(dt - timedelta(days=60)).date(),
            date_range_end=dt.date(),
            filing_status=random.choice(["draft", "pending_review", "filed"]),
            filed_by=filer.id if random.random() < 0.5 else None,
            filed_at=dt + timedelta(days=3) if random.random() < 0.5 else None,
            regulatory_reference=f"FIU-IND-{dt.strftime('%Y')}-{random.randint(10000, 99999)}" if random.random() < 0.3 else None,
        )
        db.add(sar)

    db.flush()


def seed_system_config(db: Session):
    configs = [
        ("ctr_threshold_inr", "1000000_00", "Currency Transaction Report threshold in paise (INR 10,00,000)"),
        ("sla_critical_hours", "4", "SLA for critical priority alerts (hours)"),
        ("sla_high_hours", "24", "SLA for high priority alerts (hours)"),
        ("sla_medium_hours", "72", "SLA for medium priority alerts (hours)"),
        ("sla_low_hours", "168", "SLA for low priority alerts (hours)"),
        ("case_sla_days", "30", "Default case investigation SLA (days)"),
        ("risk_score_critical_threshold", "75", "Risk score threshold for critical alerts"),
        ("risk_score_high_threshold", "50", "Risk score threshold for high alerts"),
        ("kyc_review_low_days", "365", "KYC review period for low risk customers (days)"),
        ("kyc_review_medium_days", "180", "KYC review period for medium risk customers (days)"),
        ("kyc_review_high_days", "90", "KYC review period for high risk customers (days)"),
        ("watchlist_match_threshold", "0.85", "Fuzzy match threshold for watchlist screening"),
    ]
    for key, value, desc in configs:
        db.add(SystemConfig(key=key, value=value, description=desc))
    db.flush()


# ─── Master Seeder ──────────────────────────────────────────────────────────

def seed_all(db: Session):
    """Run all seed functions in order."""
    print("  Seeding roles...")
    role_map = seed_roles(db)

    print("  Seeding users...")
    user_map = seed_users(db, role_map)
    db.commit()  # Commit users first so FKs work

    print("  Seeding customers...")
    customers = seed_customers(db)

    print("  Seeding accounts...")
    acct_map = seed_accounts(db, customers)
    db.commit()  # Commit customers/accounts

    print("  Seeding transactions (this may take a moment)...")
    txns = seed_transactions(db, customers, acct_map)
    print(f"    Created {len(txns)} transactions")
    db.commit()

    print("  Seeding rules...")
    rules = seed_rules(db)

    print("  Seeding scenarios...")
    seed_scenarios(db, rules)
    db.commit()

    print("  Seeding alerts...")
    alerts = seed_alerts(db, customers, rules, user_map)
    print(f"    Created {len(alerts)} alerts")
    db.commit()

    print("  Seeding cases...")
    cases = seed_cases(db, customers, alerts, user_map)
    print(f"    Created {len(cases)} cases")
    db.commit()

    print("  Seeding watchlist...")
    seed_watchlist(db)
    db.commit()

    print("  Seeding KYC reviews...")
    seed_kyc(db, customers, user_map)
    db.commit()

    print("  Seeding network relationships...")
    seed_network(db, customers)
    db.commit()

    print("  Seeding reports...")
    seed_reports(db, customers, cases, user_map)

    print("  Seeding system config...")
    seed_system_config(db)

    db.commit()
    print("  All seed data committed!")
