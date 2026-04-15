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
    CTRReport, SARReport, LVTRReport,
    CustomerRelationship, CustomerLink,
    AuditLog, SystemConfig,
    EmployeeActivity,
    PoliceFIR, FIRActivity,
    NotificationRule, NotificationLog,
    SMSApproval,
    UBORecord,
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

            # ── Card fraud (Ananya Sharma CIF-1010) ──
            if c.customer_number == "CIF-1010" and random.random() < 0.15:
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

        # ── Enterprise Fraud Detection Rules (R-001 to R-014) ──────────────

        ("R-001", "Transaction Velocity - 5+ txns in 10 min", "fraud", "velocity", "critical",
         {"logic": "AND", "conditions": [{"field": "aggregate.transaction_count", "operator": "greater_than", "value": 5, "time_window": "10m"}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Velocity breach: 5+ txns in 10 min"}}],
         "1h", None, 5),

        ("R-002", "High Value Transaction Outside Business Hours", "fraud", "after_hours", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.amount", "operator": "greater_than", "value": 500000_00}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "High-value txn outside business hours"}}],
         None, 500000_00, None),

        ("R-003", "Geographic Anomaly - Location Jump", "fraud", "geographic", "critical",
         {"logic": "AND", "conditions": [{"field": "aggregate.unique_locations", "operator": "greater_than", "value": 1, "time_window": "1h"}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Geographic anomaly: 500km+ jump in 1 hour"}}],
         "1h", None, None),

        ("R-004", "Blacklisted Entity Transaction", "fraud", "blacklist", "critical",
         {"logic": "AND", "conditions": [{"field": "transaction.counterparty_account", "operator": "is_not_null"}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Beneficiary on blacklist"}}],
         None, None, None),

        ("R-005", "New Payee Large Amount Transfer", "fraud", "new_payee", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.amount", "operator": "greater_than", "value": 50000_00}, {"field": "transaction.transaction_method", "operator": "in", "value": ["upi", "neft", "imps"]}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "First-time payee + amount > INR 50,000"}}],
         None, 50000_00, None),

        ("R-006", "Dormant Account Reactivation", "fraud", "dormant", "medium",
         {"logic": "AND", "conditions": [{"field": "account.status", "operator": "equals", "value": "dormant"}]},
         [{"action": "create_alert", "params": {"priority": "medium", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Dormant account activity after 90+ days"}}],
         None, None, None),

        ("R-007", "Multiple Failed Auth Attempts", "fraud", "brute_force", "high",
         {"logic": "AND", "conditions": [{"field": "aggregate.transaction_count", "operator": "greater_than", "value": 3, "time_window": "1h"}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "3+ consecutive failed PIN/OTP attempts"}}],
         "1h", None, 3),

        ("R-008", "Unusual Channel Switch - Card to UPI", "fraud", "channel_switch", "high",
         {"logic": "AND", "conditions": [{"field": "aggregate.unique_channels", "operator": "greater_than", "value": 1, "time_window": "1h"}, {"field": "transaction.amount", "operator": "greater_than", "value": 100000_00}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Channel switch: Card + UPI > INR 1L in 5 min"}}],
         "1h", 100000_00, None),

        ("R-009", "Round Amount Pattern in Short Window", "fraud", "round_amount", "medium",
         {"logic": "AND", "conditions": [{"field": "aggregate.round_amount_count", "operator": "greater_than", "value": 3, "time_window": "1h"}]},
         [{"action": "create_alert", "params": {"priority": "medium", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "3+ round-figure txns in 30 min"}}],
         "1h", None, 3),

        ("R-010", "International Card at Domestic POS", "fraud", "international_card", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "equals", "value": "card_payment"}, {"field": "transaction.location_country", "operator": "not_equals", "value": "IN"}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "International card at domestic POS without intimation"}}],
         None, None, None),

        ("R-011", "CBS Large Debit Without Mandate", "fraud", "cbs_debit", "critical",
         {"logic": "AND", "conditions": [{"field": "transaction.amount", "operator": "greater_than", "value": 1000000_00}, {"field": "transaction.transaction_type", "operator": "equals", "value": "debit"}, {"field": "transaction.channel", "operator": "equals", "value": "branch"}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "CBS debit > INR 10L without NEFT/RTGS mandate"}}],
         None, 1000000_00, None),

        ("R-012", "UPI Collect Request from Untrusted VPA", "fraud", "upi_collect", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "equals", "value": "upi"}, {"field": "transaction.amount", "operator": "greater_than", "value": 10000_00}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "UPI collect from unregistered VPA > INR 10,000"}}],
         None, 10000_00, None),

        ("R-013", "Daily Transfer Limit Breach", "fraud", "limit_breach", "critical",
         {"logic": "AND", "conditions": [{"field": "aggregate.transaction_sum", "operator": "greater_than", "value": 2000000_00, "time_window": "24h"}, {"field": "transaction.transaction_method", "operator": "in", "value": ["imps", "neft", "rtgs"]}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "IMPS/NEFT/RTGS daily limit breach"}}],
         "24h", 2000000_00, None),

        ("R-014", "Device Change Followed by Transfer", "fraud", "device_change", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.amount", "operator": "greater_than", "value": 50000_00}, {"field": "transaction.channel", "operator": "in", "value": ["mobile_banking", "internet_banking"]}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "New device login + fund transfer within 15 min"}}],
         None, 50000_00, None),

        # Compliance
        ("CMP-001", "Dormant Account Reactivation With Large Deposit", "compliance", "dormant", "high",
         {"logic": "AND", "conditions": [{"field": "account.status", "operator": "equals", "value": "dormant"}, {"field": "transaction.amount", "operator": "greater_than", "value": 500000_00}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "compliance"}}],
         None, 500000_00, None),

        ("CMP-002", "Unusual Number of New Beneficiaries", "compliance", "beneficiary", "medium",
         {"logic": "AND", "conditions": [{"field": "aggregate.unique_counterparties", "operator": "greater_than", "value": 10, "time_window": "30d"}]},
         [{"action": "create_alert", "params": {"priority": "medium", "alert_type": "compliance"}}],
         "30d", None, 10),

        # ── Internal Fraud Rules ──────────────────────────────────────────────

        ("INT-001", "Employee Self-Account Credit Without Approval", "internal_fraud", "employee", "critical",
         {"logic": "AND", "conditions": [{"field": "transaction.is_employee_account", "operator": "equals", "value": True}, {"field": "transaction.transaction_type", "operator": "equals", "value": "credit"}, {"field": "transaction.amount", "operator": "greater_than", "value": 100000_00}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "internal_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Employee self-credit > INR 1L without maker-checker"}}],
         None, 100000_00, None),

        ("INT-002", "Employee Accessing Unrelated Customer Records", "internal_fraud", "access_abuse", "high",
         {"logic": "AND", "conditions": [{"field": "audit.unique_customer_views", "operator": "greater_than", "value": 50, "time_window": "1h"}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "internal_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Employee browsing 50+ customer records in 1 hour — possible data theft"}}],
         "1h", None, 50),

        ("INT-003", "After-Hours CBS Override Transaction", "internal_fraud", "override", "critical",
         {"logic": "AND", "conditions": [{"field": "transaction.channel", "operator": "equals", "value": "branch"}, {"field": "transaction.amount", "operator": "greater_than", "value": 500000_00}, {"field": "transaction.is_after_hours", "operator": "equals", "value": True}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "internal_fraud"}}, {"action": "flag_transaction", "params": {"reason": "After-hours branch override > INR 5L"}}],
         None, 500000_00, None),

        ("INT-004", "Ghost Account Activity — No KYC on File", "internal_fraud", "ghost_account", "critical",
         {"logic": "AND", "conditions": [{"field": "customer.kyc_status", "operator": "equals", "value": "not_initiated"}, {"field": "transaction.amount", "operator": "greater_than", "value": 50000_00}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "internal_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Transaction on account with no KYC — possible ghost account"}}],
         None, 50000_00, None),

        ("INT-005", "Repeated Override of Transaction Limits", "internal_fraud", "override", "high",
         {"logic": "AND", "conditions": [{"field": "audit.override_count", "operator": "greater_than", "value": 3, "time_window": "24h"}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "internal_fraud"}}, {"action": "flag_transaction", "params": {"reason": "3+ limit overrides in 24h by same employee"}}],
         "24h", None, 3),

        ("INT-006", "Employee Reversals Above Threshold", "internal_fraud", "reversal", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_type", "operator": "equals", "value": "reversal"}, {"field": "audit.reversal_count", "operator": "greater_than", "value": 5, "time_window": "7d"}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "internal_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Excessive reversals by employee — possible skimming"}}],
         "7d", None, 5),

        ("INT-007", "Cash Vault Discrepancy Detection", "internal_fraud", "cash_vault", "critical",
         {"logic": "AND", "conditions": [{"field": "branch.cash_variance", "operator": "greater_than", "value": 50000_00}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "internal_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Cash vault variance > INR 50K detected at branch"}}],
         None, 50000_00, None),

        ("INT-008", "Loan Disbursement to Employee-Linked Account", "internal_fraud", "loan_fraud", "critical",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_type", "operator": "equals", "value": "loan_disbursement"}, {"field": "transaction.is_employee_linked", "operator": "equals", "value": True}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "internal_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Loan disbursed to employee-linked account without independent verification"}}],
         None, None, None),

        ("INT-009", "Dormant Account Withdrawal by Branch Staff", "internal_fraud", "dormant_abuse", "high",
         {"logic": "AND", "conditions": [{"field": "account.status", "operator": "equals", "value": "dormant"}, {"field": "transaction.channel", "operator": "equals", "value": "branch"}, {"field": "transaction.transaction_type", "operator": "equals", "value": "debit"}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "internal_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Withdrawal from dormant account via branch — verify customer presence"}}],
         None, None, None),

        ("INT-010", "Maker-Checker Bypass — Same User Approval", "internal_fraud", "maker_checker", "critical",
         {"logic": "AND", "conditions": [{"field": "audit.maker_id", "operator": "equals_field", "value": "audit.checker_id"}, {"field": "transaction.amount", "operator": "greater_than", "value": 200000_00}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "internal_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Same user as maker and checker for > INR 2L transaction"}}],
         None, 200000_00, None),

        # ── Cyber Fraud Rules ─────────────────────────────────────────────────

        ("CYB-001", "SIM Swap Followed by Fund Transfer", "cyber_fraud", "sim_swap", "critical",
         {"logic": "AND", "conditions": [{"field": "customer.sim_change_within_days", "operator": "less_than", "value": 3}, {"field": "transaction.amount", "operator": "greater_than", "value": 100000_00}, {"field": "transaction.channel", "operator": "in", "value": ["mobile_banking", "upi"]}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "cyber_fraud"}}, {"action": "flag_transaction", "params": {"reason": "SIM swap < 72h ago + mobile fund transfer > INR 1L"}}],
         None, 100000_00, None),

        ("CYB-002", "Phishing Link Click Followed by OTP Transaction", "cyber_fraud", "phishing", "critical",
         {"logic": "AND", "conditions": [{"field": "session.referrer_suspicious", "operator": "equals", "value": True}, {"field": "transaction.amount", "operator": "greater_than", "value": 50000_00}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "cyber_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Suspicious session referrer + high-value OTP transaction"}}],
         None, 50000_00, None),

        ("CYB-003", "Remote Desktop / AnyDesk Session During Transaction", "cyber_fraud", "remote_access", "critical",
         {"logic": "AND", "conditions": [{"field": "device.remote_access_active", "operator": "equals", "value": True}, {"field": "transaction.channel", "operator": "in", "value": ["internet_banking", "mobile_banking"]}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "cyber_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Remote desktop software active during banking session — possible RDP fraud"}}],
         None, None, None),

        ("CYB-004", "Credential Stuffing — Multiple Failed Logins Then Success", "cyber_fraud", "credential_stuffing", "high",
         {"logic": "AND", "conditions": [{"field": "auth.failed_attempts", "operator": "greater_than", "value": 5, "time_window": "30m"}, {"field": "auth.success_after_failures", "operator": "equals", "value": True}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "cyber_fraud"}}, {"action": "flag_transaction", "params": {"reason": "5+ failed logins then success — credential stuffing pattern"}}],
         "30m", None, 5),

        ("CYB-005", "VPN/Proxy/TOR Exit Node Login", "cyber_fraud", "anonymizer", "high",
         {"logic": "AND", "conditions": [{"field": "session.ip_type", "operator": "in", "value": ["vpn", "proxy", "tor"]}, {"field": "transaction.amount", "operator": "greater_than", "value": 25000_00}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "cyber_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Transaction from anonymized IP (VPN/Proxy/TOR)"}}],
         None, 25000_00, None),

        ("CYB-006", "UPI Fraud — Collect Request Spoofing", "cyber_fraud", "upi_fraud", "critical",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "equals", "value": "upi"}, {"field": "transaction.upi_type", "operator": "equals", "value": "collect"}, {"field": "aggregate.collect_request_count", "operator": "greater_than", "value": 5, "time_window": "1h"}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "cyber_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Multiple UPI collect requests — possible collect-request fraud"}}],
         "1h", None, 5),

        ("CYB-007", "QR Code Tampering — Merchant Override", "cyber_fraud", "qr_fraud", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "equals", "value": "upi"}, {"field": "transaction.merchant_mismatch", "operator": "equals", "value": True}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "cyber_fraud"}}, {"action": "flag_transaction", "params": {"reason": "UPI payment merchant ID mismatch — possible QR tampering"}}],
         None, None, None),

        ("CYB-008", "Vishing Pattern — Immediate Full Balance Transfer", "cyber_fraud", "vishing", "critical",
         {"logic": "AND", "conditions": [{"field": "transaction.amount_pct_of_balance", "operator": "greater_than", "value": 90}, {"field": "transaction.channel", "operator": "in", "value": ["mobile_banking", "upi"]}, {"field": "customer.last_call_center_contact_minutes", "operator": "less_than", "value": 30}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "cyber_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Near-full balance transfer within 30 min of call — vishing suspected"}}],
         None, None, None),

        ("CYB-009", "Malware-Driven Automated Transfers", "cyber_fraud", "malware", "critical",
         {"logic": "AND", "conditions": [{"field": "session.browser_automation", "operator": "equals", "value": True}, {"field": "aggregate.transaction_count", "operator": "greater_than", "value": 3, "time_window": "5m"}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "cyber_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Automated browser session with rapid transfers — malware pattern"}}],
         "5m", None, 3),

        ("CYB-010", "IMPS Instant Transfer to Newly Added VPA", "cyber_fraud", "instant_fraud", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "in", "value": ["imps", "upi"]}, {"field": "transaction.beneficiary_age_hours", "operator": "less_than", "value": 1}, {"field": "transaction.amount", "operator": "greater_than", "value": 50000_00}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "cyber_fraud"}}, {"action": "flag_transaction", "params": {"reason": "IMPS/UPI > INR 50K to beneficiary added < 1 hour ago"}}],
         None, 50000_00, None),

        # ── AI / Deepfake Fraud Rules ─────────────────────────────────────────

        ("AI-001", "Deepfake Video KYC Detection", "ai_fraud", "deepfake", "critical",
         {"logic": "AND", "conditions": [{"field": "kyc.video_liveness_score", "operator": "less_than", "value": 0.7}, {"field": "kyc.type", "operator": "equals", "value": "video_kyc"}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "ai_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Video KYC liveness score below threshold — possible deepfake"}}],
         None, None, None),

        ("AI-002", "Synthetic Identity — Document Anomaly", "ai_fraud", "synthetic_identity", "critical",
         {"logic": "AND", "conditions": [{"field": "kyc.document_fraud_score", "operator": "greater_than", "value": 0.6}, {"field": "customer.account_age_days", "operator": "less_than", "value": 90}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "ai_fraud"}}, {"action": "flag_transaction", "params": {"reason": "KYC document anomaly on new account — synthetic identity suspected"}}],
         None, None, None),

        ("AI-003", "Voice Cloning — IVR Authentication Bypass", "ai_fraud", "voice_clone", "critical",
         {"logic": "AND", "conditions": [{"field": "auth.voice_match_score", "operator": "less_than", "value": 0.65}, {"field": "auth.channel", "operator": "equals", "value": "ivr"}, {"field": "transaction.amount", "operator": "greater_than", "value": 100000_00}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "ai_fraud"}}, {"action": "flag_transaction", "params": {"reason": "IVR voice authentication anomaly — possible voice cloning"}}],
         None, 100000_00, None),

        ("AI-004", "AI-Generated Document for Loan Application", "ai_fraud", "document_fraud", "critical",
         {"logic": "AND", "conditions": [{"field": "document.ai_generated_score", "operator": "greater_than", "value": 0.75}, {"field": "document.type", "operator": "in", "value": ["salary_slip", "itr", "bank_statement"]}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "ai_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Loan document flagged as AI-generated — forgery suspected"}}],
         None, None, None),

        ("AI-005", "Behavioral Biometric Anomaly — Bot Transaction", "ai_fraud", "bot_detection", "high",
         {"logic": "AND", "conditions": [{"field": "session.keystroke_entropy", "operator": "less_than", "value": 0.3}, {"field": "session.mouse_linearity", "operator": "greater_than", "value": 0.95}, {"field": "transaction.amount", "operator": "greater_than", "value": 50000_00}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "ai_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Non-human interaction pattern — bot or scripted transaction"}}],
         None, 50000_00, None),

        ("AI-006", "ChatGPT Social Engineering — Customer Support Exploit", "ai_fraud", "social_engineering", "high",
         {"logic": "AND", "conditions": [{"field": "support.conversation_sentiment", "operator": "equals", "value": "manipulative"}, {"field": "support.action_requested", "operator": "in", "value": ["password_reset", "phone_change", "address_change", "beneficiary_add"]}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "ai_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Customer support conversation flagged as AI-generated social engineering"}}],
         None, None, None),

        ("AI-007", "Adversarial Attack on ML Scoring Model", "ai_fraud", "model_evasion", "critical",
         {"logic": "AND", "conditions": [{"field": "model.prediction_confidence", "operator": "less_than", "value": 0.4}, {"field": "model.feature_drift_score", "operator": "greater_than", "value": 0.8}, {"field": "transaction.amount", "operator": "greater_than", "value": 200000_00}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "ai_fraud"}}, {"action": "flag_transaction", "params": {"reason": "ML model feature drift detected — possible adversarial evasion attempt"}}],
         None, 200000_00, None),

        ("AI-008", "Deepfake Audio Call to Branch for Wire Transfer", "ai_fraud", "deepfake_audio", "critical",
         {"logic": "AND", "conditions": [{"field": "call.audio_deepfake_score", "operator": "greater_than", "value": 0.7}, {"field": "transaction.transaction_method", "operator": "in", "value": ["rtgs", "neft", "swift"]}, {"field": "transaction.amount", "operator": "greater_than", "value": 500000_00}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "ai_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Branch wire transfer request via call flagged as deepfake audio"}}],
         None, 500000_00, None),

        # ── Additional Fraud Rules — Real-Time & Behavioral ───────────────────

        ("FRD-BEH-001", "Sudden Spending Pattern Change — 10x Historical Average", "fraud", "behavioral", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.amount", "operator": "greater_than", "value": 200000_00}, {"field": "aggregate.avg_transaction_amount_ratio", "operator": "greater_than", "value": 10}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Transaction 10x higher than customer's average — behavioral anomaly"}}],
         None, 200000_00, None),

        ("FRD-BEH-002", "Night Owl Pattern — Transactions Between 1AM-5AM", "fraud", "behavioral", "medium",
         {"logic": "AND", "conditions": [{"field": "transaction.hour", "operator": "between", "value": [1, 5]}, {"field": "transaction.amount", "operator": "greater_than", "value": 50000_00}, {"field": "customer.normal_activity_hours", "operator": "not_in_range", "value": [1, 5]}]},
         [{"action": "create_alert", "params": {"priority": "medium", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Unusual early morning transaction outside customer's normal pattern"}}],
         None, 50000_00, None),

        ("FRD-BEH-003", "First-Time International Transaction > 5L", "fraud", "behavioral", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "equals", "value": "swift"}, {"field": "transaction.amount", "operator": "greater_than", "value": 500000_00}, {"field": "customer.international_txn_count", "operator": "equals", "value": 0}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "First ever international transfer exceeds INR 5L — verify with customer"}}],
         None, 500000_00, None),

        ("FRD-BEH-004", "Rapid Account Draining — 80%+ Balance in 24h", "fraud", "behavioral", "critical",
         {"logic": "AND", "conditions": [{"field": "aggregate.debit_sum_pct_balance", "operator": "greater_than", "value": 80, "time_window": "24h"}, {"field": "aggregate.debit_count", "operator": "greater_than", "value": 3, "time_window": "24h"}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Account draining: 80%+ balance withdrawn across multiple transactions in 24h"}}],
         "24h", None, 3),

        ("FRD-BEH-005", "Customer Age < 25 With High-Value Transactions", "fraud", "behavioral", "medium",
         {"logic": "AND", "conditions": [{"field": "customer.age", "operator": "less_than", "value": 25}, {"field": "transaction.amount", "operator": "greater_than", "value": 500000_00}]},
         [{"action": "create_alert", "params": {"priority": "medium", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Young customer (<25y) with high-value transaction — profile mismatch"}}],
         None, 500000_00, None),

        # ── Mule Account Detection ────────────────────────────────────────────

        ("FRD-MULE-001", "Mule Account Pattern — Rapid In-Out Same Day", "fraud", "mule_account", "critical",
         {"logic": "AND", "conditions": [{"field": "aggregate.credit_count", "operator": "greater_than", "value": 3, "time_window": "24h"}, {"field": "aggregate.debit_count", "operator": "greater_than", "value": 3, "time_window": "24h"}, {"field": "aggregate.credit_debit_ratio", "operator": "between", "value": [0.8, 1.2]}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Mule account pattern: rapid credit+debit with near-equal amounts"}}],
         "24h", None, 3),

        ("FRD-MULE-002", "New Account Sudden High Volume", "fraud", "mule_account", "high",
         {"logic": "AND", "conditions": [{"field": "customer.account_age_days", "operator": "less_than", "value": 30}, {"field": "aggregate.transaction_count", "operator": "greater_than", "value": 10, "time_window": "7d"}, {"field": "aggregate.transaction_sum", "operator": "greater_than", "value": 1000000_00, "time_window": "7d"}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "New account (<30d) with 10+ txns and > INR 10L in 7 days — mule suspected"}}],
         "7d", 1000000_00, 10),

        ("FRD-MULE-003", "Multiple Credits From Different Sources Then Single Withdrawal", "fraud", "mule_account", "critical",
         {"logic": "AND", "conditions": [{"field": "aggregate.unique_creditors", "operator": "greater_than", "value": 5, "time_window": "24h"}, {"field": "transaction.transaction_type", "operator": "equals", "value": "debit"}, {"field": "transaction.amount_pct_of_balance", "operator": "greater_than", "value": 70}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "5+ unique creditors in 24h followed by near-full balance withdrawal"}}],
         "24h", None, 5),

        # ── Loan & Insurance Fraud ────────────────────────────────────────────

        ("FRD-LOAN-001", "Multiple Loan Applications From Same Device", "fraud", "loan_fraud", "high",
         {"logic": "AND", "conditions": [{"field": "device.fingerprint_count", "operator": "greater_than", "value": 3, "time_window": "30d"}, {"field": "application.type", "operator": "equals", "value": "loan"}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "3+ loan applications from same device in 30 days — possible syndicate"}}],
         "30d", None, 3),

        ("FRD-LOAN-002", "Loan Diversion — Disbursement to Third Party", "fraud", "loan_fraud", "critical",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_type", "operator": "equals", "value": "loan_disbursement"}, {"field": "transaction.beneficiary_is_applicant", "operator": "equals", "value": False}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Loan disbursement credited to account other than applicant's"}}],
         None, None, None),

        ("FRD-LOAN-003", "Gold Loan — Valuation Anomaly", "fraud", "loan_fraud", "high",
         {"logic": "AND", "conditions": [{"field": "loan.type", "operator": "equals", "value": "gold_loan"}, {"field": "loan.ltv_ratio", "operator": "greater_than", "value": 0.85}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Gold loan LTV > 85% — possible overvaluation of collateral"}}],
         None, None, None),

        # ── Merchant & POS Fraud ──────────────────────────────────────────────

        ("FRD-MER-001", "Merchant Split Transaction — Avoiding Limit", "fraud", "merchant", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.merchant_id", "operator": "is_not_null"}, {"field": "aggregate.same_merchant_count", "operator": "greater_than", "value": 3, "time_window": "1h"}, {"field": "aggregate.same_merchant_sum", "operator": "greater_than", "value": 200000_00, "time_window": "1h"}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "3+ split transactions at same merchant in 1h totaling > INR 2L"}}],
         "1h", 200000_00, 3),

        ("FRD-MER-002", "POS Terminal Anomaly — After-Hours High Volume", "fraud", "merchant", "medium",
         {"logic": "AND", "conditions": [{"field": "transaction.channel", "operator": "equals", "value": "pos"}, {"field": "transaction.hour", "operator": "between", "value": [23, 5]}, {"field": "aggregate.transaction_count", "operator": "greater_than", "value": 5, "time_window": "2h"}]},
         [{"action": "create_alert", "params": {"priority": "medium", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "POS terminal active after hours with 5+ transactions — skimming risk"}}],
         "2h", None, 5),

        ("FRD-MER-003", "Refund Fraud — Excessive Refunds at Merchant", "fraud", "merchant", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_type", "operator": "equals", "value": "refund"}, {"field": "aggregate.refund_count", "operator": "greater_than", "value": 5, "time_window": "24h"}, {"field": "aggregate.refund_sum", "operator": "greater_than", "value": 100000_00, "time_window": "24h"}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Merchant issued 5+ refunds totaling > INR 1L in 24h — refund abuse"}}],
         "24h", 100000_00, 5),

        # ── Check / DD Fraud ──────────────────────────────────────────────────

        ("FRD-CHQ-001", "Cheque Kiting — Circular Deposits Between Accounts", "fraud", "cheque_fraud", "critical",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "equals", "value": "cheque"}, {"field": "aggregate.circular_transfer_detected", "operator": "equals", "value": True}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Cheque kiting detected — circular deposits between related accounts"}}],
         None, None, None),

        ("FRD-CHQ-002", "Altered Cheque — Amount Mismatch", "fraud", "cheque_fraud", "critical",
         {"logic": "AND", "conditions": [{"field": "cheque.ocr_amount", "operator": "not_equals_field", "value": "cheque.micr_amount"}, {"field": "transaction.amount", "operator": "greater_than", "value": 50000_00}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Cheque OCR and MICR amounts don't match — possible alteration"}}],
         None, 50000_00, None),

        ("FRD-DD-001", "Demand Draft Issued Without Corresponding Debit", "fraud", "cheque_fraud", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_type", "operator": "equals", "value": "dd_issue"}, {"field": "transaction.corresponding_debit", "operator": "equals", "value": False}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "DD issued without corresponding account debit — possible insider fraud"}}],
         None, None, None),

        # ── Cross-Border & SWIFT Fraud ────────────────────────────────────────

        ("FRD-SWIFT-001", "SWIFT Message Tampering — Unusual BIC Code", "fraud", "swift_fraud", "critical",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "equals", "value": "swift"}, {"field": "transaction.beneficiary_bic_suspicious", "operator": "equals", "value": True}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "SWIFT transfer to BIC code flagged as suspicious — possible message tampering"}}],
         None, None, None),

        ("FRD-SWIFT-002", "Trade-Based Money Laundering — Over/Under Invoicing", "fraud", "swift_fraud", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.transaction_method", "operator": "equals", "value": "swift"}, {"field": "transaction.trade_invoice_variance", "operator": "greater_than", "value": 30}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "Trade invoice variance > 30% — possible TBML over/under invoicing"}}],
         None, None, None),

        # ── ATM & Cash Fraud ──────────────────────────────────────────────────

        ("FRD-ATM-001", "ATM Cash-Out Attack — Rapid Sequential Withdrawals", "fraud", "atm_fraud", "critical",
         {"logic": "AND", "conditions": [{"field": "transaction.channel", "operator": "equals", "value": "atm"}, {"field": "aggregate.atm_withdrawal_count", "operator": "greater_than", "value": 5, "time_window": "30m"}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "5+ ATM withdrawals in 30 min — jackpotting or cloned card cash-out"}}],
         "30m", None, 5),

        ("FRD-ATM-002", "ATM Withdrawal in Foreign Country While Card Used Domestically", "fraud", "atm_fraud", "critical",
         {"logic": "AND", "conditions": [{"field": "transaction.channel", "operator": "equals", "value": "atm"}, {"field": "aggregate.concurrent_domestic_use", "operator": "equals", "value": True}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "ATM withdrawal abroad while card used domestically — cloned card"}}],
         None, None, None),

        # ── Insurance & Claim Fraud ───────────────────────────────────────────

        ("FRD-INS-001", "Multiple Insurance Claims From Same Hospital", "fraud", "insurance_fraud", "high",
         {"logic": "AND", "conditions": [{"field": "claim.hospital_id", "operator": "is_not_null"}, {"field": "aggregate.same_hospital_claims", "operator": "greater_than", "value": 3, "time_window": "30d"}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "fraud"}}, {"action": "flag_transaction", "params": {"reason": "3+ claims from same hospital in 30 days — possible collusion"}}],
         "30d", None, 3),

        # ── Crypto / Digital Asset Fraud ──────────────────────────────────────

        ("CYB-011", "Crypto Exchange Transfer Post Account Compromise", "cyber_fraud", "crypto_fraud", "critical",
         {"logic": "AND", "conditions": [{"field": "transaction.beneficiary_type", "operator": "equals", "value": "crypto_exchange"}, {"field": "customer.password_changed_hours", "operator": "less_than", "value": 24}, {"field": "transaction.amount", "operator": "greater_than", "value": 100000_00}]},
         [{"action": "create_alert", "params": {"priority": "critical", "alert_type": "cyber_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Transfer to crypto exchange within 24h of password change — account compromise cashout"}}],
         None, 100000_00, None),

        ("CYB-012", "Bulk Gift Card Purchase — Social Engineering Cashout", "cyber_fraud", "social_engineering", "high",
         {"logic": "AND", "conditions": [{"field": "transaction.merchant_category", "operator": "equals", "value": "gift_cards"}, {"field": "aggregate.gift_card_sum", "operator": "greater_than", "value": 50000_00, "time_window": "24h"}]},
         [{"action": "create_alert", "params": {"priority": "high", "alert_type": "cyber_fraud"}}, {"action": "flag_transaction", "params": {"reason": "Gift card purchases > INR 50K in 24h — social engineering cashout pattern"}}],
         "24h", 50000_00, None),
    ]

    for name, desc, cat, subcat, sev, conds, acts, tw, threshold_amt, threshold_cnt in rules_data:
        # Disable AML and KYC rules (they are not actively used in demo)
        is_enabled = cat not in ["aml", "kyc", "compliance"]

        r = Rule(
            id=_uid(), name=name, description=desc, category=cat, subcategory=subcat,
            severity=sev, is_enabled=is_enabled, priority=10 if sev == "critical" else 20 if sev == "high" else 30,
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
        ("Card Fraud Detection", "Real-time card transaction anomaly detection", "fraud",
         ["FRD-CRD-001", "FRD-CRD-002", "FRD-CRD-003"]),
        ("Account Takeover Prevention", "Detects unauthorized account access patterns", "fraud",
         ["FRD-ATO-001", "FRD-ATO-002", "FRD-ATO-003"]),
        ("Wire Fraud Prevention", "Monitors wire transfers for fraudulent patterns", "fraud",
         ["FRD-WIR-001", "FRD-WIR-002", "FRD-WIR-003"]),
        ("Dormant Account Monitoring", "Monitors reactivation of dormant accounts", "compliance",
         ["CMP-001"]),
        ("Beneficiary Risk Monitoring", "Tracks unusual beneficiary addition patterns", "compliance",
         ["CMP-002"]),
        ("Internal Fraud — Employee Abuse", "Detects insider threats including self-credit, override abuse, and ghost accounts", "internal_fraud",
         ["INT-001", "INT-003", "INT-004", "INT-005", "INT-007", "INT-008", "INT-010"]),
        ("Internal Fraud — Data Theft", "Monitors employee access patterns for potential data exfiltration", "internal_fraud",
         ["INT-002", "INT-006", "INT-009"]),
        ("Cyber Fraud — SIM Swap & Phishing", "Real-time detection of SIM swap attacks, phishing, and vishing", "cyber_fraud",
         ["CYB-001", "CYB-002", "CYB-008"]),
        ("Cyber Fraud — Digital Channel Attacks", "Monitors for remote access fraud, VPN abuse, credential stuffing, and malware", "cyber_fraud",
         ["CYB-003", "CYB-004", "CYB-005", "CYB-009"]),
        ("Cyber Fraud — UPI / Instant Payment", "UPI collect fraud, QR tampering, and instant transfer to new beneficiaries", "cyber_fraud",
         ["CYB-006", "CYB-007", "CYB-010"]),
        ("AI Fraud — Deepfake & Synthetic Identity", "Detects AI-generated KYC documents, deepfake video/audio, and synthetic identities", "ai_fraud",
         ["AI-001", "AI-002", "AI-003", "AI-004", "AI-008"]),
        ("AI Fraud — Bot & Evasion Detection", "Behavioral biometrics, bot detection, social engineering, and ML model evasion", "ai_fraud",
         ["AI-005", "AI-006", "AI-007"]),
        ("Behavioral Anomaly Detection", "Detects sudden changes in spending patterns, unusual timing, and profile mismatches", "fraud",
         ["FRD-BEH-001", "FRD-BEH-002", "FRD-BEH-003", "FRD-BEH-004", "FRD-BEH-005"]),
        ("Mule Account Detection", "Identifies money mule patterns — rapid in-out, new accounts with high volume", "fraud",
         ["FRD-MULE-001", "FRD-MULE-002", "FRD-MULE-003"]),
        ("Loan & Insurance Fraud", "Detects loan application fraud, diversion, and collateral overvaluation", "fraud",
         ["FRD-LOAN-001", "FRD-LOAN-002", "FRD-LOAN-003"]),
        ("Merchant & POS Fraud", "Split transactions, after-hours POS activity, and refund abuse", "fraud",
         ["FRD-MER-001", "FRD-MER-002", "FRD-MER-003"]),
        ("Cheque & DD Fraud", "Cheque kiting, altered cheques, and DD fraud detection", "fraud",
         ["FRD-CHQ-001", "FRD-CHQ-002", "FRD-DD-001"]),
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
        [("closed_true_positive", 40)] +   # raised: drives alert accuracy up to ~89%
        [("closed_false_positive", 5)] +   # lowered: fewer FP → high accuracy
        [("closed_inconclusive", 10)]
    )

    OPEN_STATUSES = {"new", "assigned", "under_review", "escalated"}

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
            if status in OPEN_STATUSES:
                # ~11% of open alerts are overdue → ~89% SLA compliance rate
                # Use large future windows (30-90 days) so seed stays valid for months
                if random.random() < 0.11:
                    sla_due = NOW - timedelta(hours=random.uniform(1, 36))
                    is_overdue = True
                else:
                    sla_due = NOW + timedelta(days=random.uniform(30, 90))
                    is_overdue = False
            else:
                sla_due = dt + timedelta(hours=sla_hours)
                is_overdue = False  # closed alerts don't count as overdue

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

    # (status, count, disposition_override)
    # "recovered" cases: status=closed_true_positive but money was clawed back
    case_configs = [
        ("open", 5, None),
        ("assigned", 4, None),
        ("under_investigation", 5, None),
        ("escalated", 3, None),
        ("pending_regulatory", 2, None),
        ("closed_true_positive", 5, "true_positive"),
        ("closed_true_positive", 3, "recovered"),   # confirmed fraud where funds recovered
        ("closed_false_positive", 2, "false_positive"),
    ]

    case_counter = 1
    for status, count, disposition_override in case_configs:
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

            # Open/active cases: SLA due in the future; ~15% breached for realism
            is_closed = status in ("closed_true_positive", "closed_false_positive", "closed_inconclusive")
            if is_closed:
                sla_due_at = dt + timedelta(days=30)
                is_overdue = False
            elif random.random() < 0.15:
                sla_due_at = NOW - timedelta(days=random.uniform(1, 10))
                is_overdue = True
            else:
                sla_due_at = NOW + timedelta(days=random.uniform(3, 25))
                is_overdue = False

            disposition = disposition_override

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
                sla_due_at=sla_due_at,
                is_overdue=is_overdue,
                disposition=disposition,
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
                act2 = CaseActivity(case_id=c.id, user_id=user_map["admin"].id, activity_type="assigned", description="Assigned to investigator", created_at=dt + timedelta(hours=2))
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
        ("CIF-1053", "CIF-1015", "business_partner", 0.4),
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

    # LVTR reports (Bhutan/RMA — Large Value Transaction Reports)
    for i in range(5):
        customer = random.choice(high_cash_customers)
        dt = _random_date(50, 0)
        lvtr = LVTRReport(
            id=_uid(),
            report_number=f"LVTR-{dt.strftime('%Y%m%d')}-{i+1:04d}",
            customer_id=customer.id,
            transaction_amount=random.randint(10000000, 50000000),  # Nu. 100,000 to Nu. 500,000 in paise
            transaction_date=dt,
            transaction_type=random.choice(["cash_deposit", "cash_withdrawal", "transfer", "remittance"]),
            reporting_threshold=10000000,  # Nu. 100,000 in paise
            filing_status=random.choice(["auto_generated", "pending_review", "filed"]),
            filed_by=filer.id if random.random() < 0.4 else None,
            filed_at=dt + timedelta(days=1) if random.random() < 0.4 else None,
        )
        db.add(lvtr)

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


def seed_employee_activities(db: Session):
    """Seed realistic internal fraud monitoring data — employee activities and insider threats."""
    employees = [
        ("EMP-3345", "Sanjay Iyer", "Branch Banking", "Relationship Manager"),
        ("EMP-0789", "Kavitha Menon", "Risk Management", "Risk Analyst"),
        ("EMP-5521", "Vikash Gupta", "IT Operations", "Database Administrator"),
        ("EMP-2234", "Deepak Rao", "ATM Operations", "ATM Support Engineer"),
        ("EMP-2847", "Rajesh Kumar", "Retail Banking Operations", "Branch Manager"),
        ("EMP-1234", "Sneha Patel", "Digital Banking Support", "Support Analyst"),
        ("EMP-0045", "Priya Nair", "Compliance", "Compliance Officer"),
        ("EMP-3891", "Amit Sharma", "Credit Operations", "Credit Officer"),
        ("EMP-4422", "Rohit Verma", "Treasury", "Treasury Analyst"),
        ("EMP-6677", "Meena Das", "HR", "HR Manager"),
        ("EMP-7890", "Suresh Reddy", "IT Security", "Security Engineer"),
        ("EMP-1122", "Anita Joshi", "Loan Operations", "Loan Officer"),
    ]

    workstations = [
        "WRK-BRANCH-01", "WRK-BRANCH-04", "WRK-BRANCH-11", "WRK-RISK-03",
        "WRK-IT-ADMIN-01", "WRK-ATM-05", "WRK-OPS-12", "WRK-COMP-02",
        "WRK-CREDIT-08", "WRK-TREASURY-01", "WRK-HR-02", "WRK-SEC-01",
    ]

    # Normal activities — routine day-to-day for each employee
    normal_activities = [
        (0, "Login", "Successful login from approved workstation during business hours — shift start."),
        (0, "Account Access", "Accessed VIP customer account to process service request TKT-48291."),
        (1, "Login", "Successful login from risk analytics workstation. Morning session."),
        (1, "Report Generation", "Generated weekly risk summary report for compliance review."),
        (2, "Login", "Successful login to IT admin console for routine maintenance."),
        (2, "Config Change", "Updated nightly backup schedule per approved change request CR-1124."),
        (3, "Login", "Successful login from ATM operations desk."),
        (3, "Account Access", "Checked ATM reconciliation for branch ATM-PUNE-005."),
        (4, "Login", "Branch manager login from operations terminal."),
        (4, "Report Generation", "Generated daily branch transaction summary — EOD processing."),
        (5, "Login", "Login to digital banking support portal for ticket queue."),
        (5, "Account Access", "Accessed customer account for dispute resolution TKT-51022."),
        (6, "Login", "Compliance officer morning login."),
        (6, "Report Generation", "Generated regulatory compliance checklist for RBI audit."),
        (7, "Login", "Credit officer session start."),
        (7, "Account Access", "Reviewed credit application CA-2026-0891 for processing."),
        (8, "Login", "Treasury analyst login from secure terminal."),
        (8, "Report Generation", "Generated daily treasury position report."),
        (9, "Login", "HR manager system access for attendance processing."),
        (9, "Report Generation", "Generated monthly headcount report for finance."),
        (10, "Login", "Security engineer login to monitoring console."),
        (10, "Report Generation", "Generated weekly access audit report for review."),
        (11, "Login", "Loan officer session start from branch terminal."),
        (11, "Account Access", "Reviewed loan disbursement schedule for batch processing."),
    ]

    for emp_idx, activity_type, desc in normal_activities:
        emp_id, name, dept, role = employees[emp_idx]
        days_ago = random.randint(0, 7)
        hours = random.randint(8, 17)
        dt = (NOW - timedelta(days=days_ago)).replace(hour=hours, minute=random.randint(0, 59))
        db.add(EmployeeActivity(
            id=_uid(),
            employee_id=emp_id,
            employee_name=name,
            department=dept,
            role=role,
            risk_level="low",
            status="normal",
            activity_type=activity_type,
            description=desc,
            workstation_id=workstations[emp_idx % len(workstations)],
            ip_address=f"10.0.{random.randint(0, 10)}.{random.randint(1, 254)}",
            after_hours=False,
            unauthorized_access=False,
            created_at=dt,
        ))

    # Suspicious / insider threat activities — the core of what makes this module valuable
    suspicious = [
        # EMP-5521: DBA accessed production PII directly (CRITICAL)
        (2, "critical", "under_review", "Privileged Action",
         "Accessed production database directly bypassing application layer. Queried customer PII tables (pan_number, aadhaar_hash). 14,200 rows exported to local session.",
         True, True),
        # EMP-2234: Accessed fraud case customer without assignment (MEDIUM)
        (3, "medium", "suspicious", "Account Access",
         "Accessed customer account CIF-1050 linked to ongoing fraud case CASE-2026-019. No investigative assignment on record. Duration: 14 minutes.",
         False, True),
        # EMP-2847: Mass account access at 2 AM (CRITICAL)
        (4, "critical", "under_review", "Account Access",
         "Accessed 847 customer accounts between 02:00-04:30 AM without documented business reason. Pattern: sequential CIF numbers suggesting enumeration.",
         True, True),
        # EMP-1234: USB data export (HIGH)
        (5, "high", "suspicious", "Data Export",
         "Exported 5,200 customer transaction records to personal USB drive (Device: SanDisk Ultra 64GB SN:4A2B). Export volume exceeds normal business need by 20x.",
         False, True),
        # EMP-0045: Modified detection threshold (HIGH — cleared after review)
        (6, "high", "cleared", "Config Change",
         "Modified velocity rule R-017 threshold from 5 to 50 transactions/hour during off-peak period. Approved by compliance head post-facto.",
         False, False),
        # EMP-3891: Fraud block override without approval (CRITICAL — confirmed)
        (7, "critical", "confirmed_fraud", "Override",
         "Manual override of fraud block on transaction TXN-2026-89421 for INR 8,50,000 without supervisor approval. Beneficiary account linked to employee's spouse.",
         False, True),
        # EMP-4422: Dormant account reactivation (HIGH)
        (8, "high", "under_review", "Account Access",
         "Accessed 12 dormant accounts (inactive >2 years) and initiated reactivation workflow. No customer requests on file. Accounts in Lucknow and Jaipur branches.",
         True, False),
        # EMP-6677: Cross-department salary access (MEDIUM)
        (9, "medium", "suspicious", "Report Generation",
         "Generated salary reports for IT Operations and Treasury departments — outside area of responsibility. Downloaded 3 reports in PDF format.",
         False, False),
        # EMP-1122: Loan amount modification after hours (HIGH)
        (11, "high", "under_review", "Customer Record Modification",
         "Modified loan approval amounts for 3 accounts (CA-2026-0712, CA-2026-0715, CA-2026-0718) after business hours without maker-checker approval. Total increase: INR 12,50,000.",
         True, True),
        # Additional activities for richer demo data
        # EMP-3345: Unusual branch transfer pattern (MEDIUM)
        (0, "medium", "suspicious", "Account Access",
         "Initiated 8 inter-branch transfers totalling INR 45,00,000 in 15 minutes. All transfers to same beneficiary account in different branch.",
         False, False),
        # EMP-7890: Security engineer accessed audit logs then deleted entries (CRITICAL)
        (10, "critical", "under_review", "Privileged Action",
         "Accessed security audit log table directly via admin console. 47 entries from previous week deleted. Deleted entries related to EMP-3891 override activity.",
         True, True),
    ]

    for emp_idx, risk, status, activity_type, desc, after_hrs, unauth in suspicious:
        emp_id, name, dept, role = employees[emp_idx]
        days_ago = random.randint(0, 30)
        hours = random.randint(0, 5) if after_hrs else random.randint(9, 18)
        dt = (NOW - timedelta(days=days_ago)).replace(hour=hours, minute=random.randint(0, 59))
        db.add(EmployeeActivity(
            id=_uid(),
            employee_id=emp_id,
            employee_name=name,
            department=dept,
            role=role,
            risk_level=risk,
            status=status,
            activity_type=activity_type,
            description=desc,
            workstation_id=workstations[emp_idx % len(workstations)],
            ip_address=f"10.0.{random.randint(0, 5)}.{random.randint(1, 254)}",
            after_hours=after_hrs,
            unauthorized_access=unauth,
            created_at=dt,
        ))

    db.flush()


# ─── Police FIRs ───────────────────────────────────────────────────────────

def seed_police_firs(db: Session, cases, user_map):
    """Seed police FIR records linked to fraud cases."""
    if not cases:
        return

    police_stations = [
        ("Cyber Crime PS, BKC", "Mumbai", "Maharashtra"),
        ("EOW, Mandir Marg", "Delhi", "Delhi"),
        ("Cyber Crime Cell, HAL", "Bangalore", "Karnataka"),
        ("Cyber Crime Wing, Egmore", "Chennai", "Tamil Nadu"),
        ("Lalbazar Cyber Crime", "Kolkata", "West Bengal"),
        ("Cyber Crime PS, Banjara Hills", "Hyderabad", "Telangana"),
    ]

    officers = [
        ("Inspector Rajendra Patil", "+91-22-2600-1234", "Inspector"),
        ("SI Kavitha Sharma", "+91-11-2301-5678", "Sub-Inspector"),
        ("Inspector M. Krishnamurthy", "+91-80-2294-9012", "Inspector"),
        ("DSP Arjun Reddy", "+91-40-2785-3456", "Dy. Superintendent"),
        ("Inspector Sourav Ghosh", "+91-33-2250-7890", "Inspector"),
    ]

    offense_map = {
        "fraud_investigation": ["cheating", "cyber_fraud", "card_fraud", "upi_fraud", "account_takeover"],
        "aml_investigation": ["money_laundering", "cheating"],
        "kyc_review": ["identity_theft", "forgery"],
        "compliance_review": ["cheating"],
    }

    ipc_map = {
        "cheating": "IPC 420",
        "cyber_fraud": "IT Act Sec 66C, 66D",
        "card_fraud": "IPC 420, IT Act Sec 66C",
        "upi_fraud": "IPC 420, IT Act Sec 66D",
        "account_takeover": "IPC 420, IT Act Sec 43",
        "money_laundering": "PMLA Sec 3, 4",
        "identity_theft": "IT Act Sec 66C",
        "forgery": "IPC 468, 471",
    }

    fir_statuses = ["draft", "filed", "acknowledged", "under_investigation", "charge_sheet_filed"]
    fir_data = []

    # Create FIRs for first 8 cases (confirmed fraud cases)
    fraud_cases = [c for c in cases if c.disposition in ("true_positive", "recovered") or c.status in ("under_investigation", "escalated")][:8]
    if not fraud_cases:
        fraud_cases = cases[:5]

    comp_user = user_map.get("compliance1") or list(user_map.values())[0]

    for i, case in enumerate(fraud_cases):
        ps = police_stations[i % len(police_stations)]
        off = officers[i % len(officers)]
        offenses = offense_map.get(case.case_type, ["cheating"])
        offense = random.choice(offenses)
        status = fir_statuses[min(i, len(fir_statuses) - 1)]
        days_ago = random.randint(5, 45)
        created = NOW - timedelta(days=days_ago)

        fir = PoliceFIR(
            id=str(uuid.uuid4()),
            fir_number=f"FIR-{(NOW - timedelta(days=days_ago)).strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}",
            case_id=case.id,
            customer_id=case.customer_id,
            police_station=ps[0],
            police_district=ps[1],
            police_state=ps[2],
            investigating_officer=off[0],
            officer_contact=off[1],
            officer_designation=off[2],
            offense_type=offense,
            ipc_sections=ipc_map.get(offense, "IPC 420"),
            fraud_amount=case.total_suspicious_amount or random.randint(500000, 50000000),
            offense_date=created - timedelta(days=random.randint(1, 10)),
            offense_description=f"Fraud detected in case {case.case_number}. {offense.replace('_', ' ').title()} involving customer account.",
            status=status,
            priority=case.priority,
            filed_by=comp_user.id if status != "draft" else None,
            filed_at=(created + timedelta(days=1)) if status != "draft" else None,
            acknowledged_at=(created + timedelta(days=3)) if status in ("acknowledged", "under_investigation", "charge_sheet_filed") else None,
            acknowledgment_number=f"ACK-{uuid.uuid4().hex[:8].upper()}" if status in ("acknowledged", "under_investigation", "charge_sheet_filed") else None,
            charge_sheet_date=(created + timedelta(days=20)) if status == "charge_sheet_filed" else None,
            charge_sheet_number=f"CS-{uuid.uuid4().hex[:6].upper()}" if status == "charge_sheet_filed" else None,
            court_name="Metropolitan Magistrate Court, Mumbai" if status == "charge_sheet_filed" else None,
            amount_recovered=int((case.total_suspicious_amount or 1000000) * random.uniform(0, 0.4)) if status in ("under_investigation", "charge_sheet_filed") else 0,
            assets_frozen=(status in ("under_investigation", "charge_sheet_filed") and random.random() > 0.5),
            rbi_fraud_reported=(random.random() > 0.3),
            rbi_report_date=(created + timedelta(days=2)) if random.random() > 0.3 else None,
            rbi_reference=f"FMR-{created.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}" if random.random() > 0.3 else None,
            cyber_cell_reported=(offense in ("cyber_fraud", "card_fraud", "upi_fraud", "account_takeover", "phishing")),
            cyber_complaint_number=f"CC-{uuid.uuid4().hex[:8].upper()}" if offense in ("cyber_fraud", "card_fraud", "upi_fraud", "account_takeover") else None,
            notes=f"Police case for {offense.replace('_', ' ')} detected via transaction monitoring.",
            created_by=comp_user.id,
            created_at=created,
        )
        db.add(fir)
        fir_data.append(fir)

        # Add activity trail
        db.add(FIRActivity(id=str(uuid.uuid4()), fir_id=fir.id, user_id=comp_user.id,
                           activity_type="created", description=f"FIR draft created for case {case.case_number}", created_at=created))
        if status != "draft":
            db.add(FIRActivity(id=str(uuid.uuid4()), fir_id=fir.id, user_id=comp_user.id,
                               activity_type="filed", description=f"FIR filed at {ps[0]}", created_at=created + timedelta(days=1)))
        if status in ("acknowledged", "under_investigation", "charge_sheet_filed"):
            db.add(FIRActivity(id=str(uuid.uuid4()), fir_id=fir.id, user_id=comp_user.id,
                               activity_type="acknowledged", description=f"FIR acknowledged by police", created_at=created + timedelta(days=3)))
        if fir.rbi_fraud_reported:
            db.add(FIRActivity(id=str(uuid.uuid4()), fir_id=fir.id, user_id=comp_user.id,
                               activity_type="rbi_reported", description=f"Fraud reported to RBI via FMR-1", created_at=created + timedelta(days=2)))

    db.flush()
    return fir_data


# ─── Notification Rules ────────────────────────────────────────────────────

def seed_notification_rules(db: Session):
    """Seed default notification rules — industry-standard alert routing."""
    rules = [
        # Critical alerts — immediate SMS + email to RM and risk manager
        NotificationRule(
            id=str(uuid.uuid4()), name="Critical Alert — SMS to Risk Manager",
            description="Immediately notify risk manager via SMS when a critical alert is created",
            trigger_event="alert_created", condition_priority="critical",
            recipient_type="risk_manager", channel_sms=True, channel_email=True, channel_in_app=True,
            message_template="CRITICAL ALERT {alert_number}: {customer_name} — {amount} INR. Priority: {priority}. Immediate review required.",
            is_active=True, cooldown_minutes=30, max_per_day=50, severity="critical",
        ),
        # High-value transaction — notify compliance
        NotificationRule(
            id=str(uuid.uuid4()), name="High-Value Transaction — Compliance Alert",
            description="Notify compliance officer for transactions above INR 10 lakh",
            trigger_event="high_risk_transaction", condition_amount_min=1000000_00,
            recipient_type="compliance_officer", channel_email=True, channel_in_app=True,
            message_template="HIGH VALUE: Transaction of {amount} INR detected for {customer_name}. CTR may be required.",
            is_active=True, cooldown_minutes=60, max_per_day=100, severity="high",
        ),
        # Alert escalation — notify branch head
        NotificationRule(
            id=str(uuid.uuid4()), name="Alert Escalated — Branch Head Notification",
            description="Notify branch head when an alert is escalated",
            trigger_event="alert_escalated",
            recipient_type="branch_head", channel_email=True, channel_in_app=True,
            message_template="ESCALATION: Alert {alert_number} has been escalated. Customer: {customer_name}. Please review.",
            is_active=True, cooldown_minutes=0, severity="high",
        ),
        # SLA breach — notify manager
        NotificationRule(
            id=str(uuid.uuid4()), name="Alert SLA Breach — Manager Alert",
            description="Notify risk manager when alert SLA is breached",
            trigger_event="alert_sla_breach",
            recipient_type="risk_manager", channel_sms=True, channel_email=True, channel_in_app=True,
            message_template="SLA BREACH: Alert {alert_number} has exceeded SLA deadline. Assigned to: {assignee}. Immediate action required.",
            is_active=True, cooldown_minutes=120, severity="critical",
        ),
        # Case SLA breach
        NotificationRule(
            id=str(uuid.uuid4()), name="Case SLA Breach — CRO Notification",
            description="Notify CRO when case investigation exceeds SLA",
            trigger_event="case_sla_breach",
            recipient_type="cro", channel_email=True, channel_in_app=True,
            message_template="CASE SLA BREACH: Case {case_number} investigation has exceeded SLA. Priority: {priority}.",
            is_active=True, cooldown_minutes=240, severity="critical",
        ),
        # SAR filing — notify principal officer
        NotificationRule(
            id=str(uuid.uuid4()), name="SAR Filed — Principal Officer Notification",
            description="Notify PMLA Principal Officer when SAR is filed",
            trigger_event="sar_filed",
            recipient_type="principal_officer", channel_email=True, channel_in_app=True,
            message_template="SAR FILED: Suspicious Activity Report filed for {customer_name}. Amount: {amount} INR. Reference: {report_number}.",
            is_active=True, severity="high",
        ),
        # FIR filed — notify CRO
        NotificationRule(
            id=str(uuid.uuid4()), name="FIR Filed — CRO Notification",
            description="Notify CRO when police FIR is filed",
            trigger_event="fir_filed",
            recipient_type="cro", channel_sms=True, channel_email=True, channel_in_app=True,
            message_template="FIR FILED: Police complaint {fir_number} filed at {police_station}. Fraud amount: {amount} INR.",
            is_active=True, severity="critical",
        ),
        # PEP transaction — enhanced monitoring
        NotificationRule(
            id=str(uuid.uuid4()), name="PEP Transaction — Enhanced Monitoring",
            description="Notify compliance when PEP customer conducts a transaction",
            trigger_event="pep_transaction",
            recipient_type="compliance_officer", channel_email=True, channel_in_app=True,
            message_template="PEP ALERT: Transaction by PEP customer {customer_name}. Amount: {amount} INR. Enhanced review required per RBI guidelines.",
            is_active=True, cooldown_minutes=60, severity="high",
        ),
        # Watchlist match
        NotificationRule(
            id=str(uuid.uuid4()), name="Watchlist Match — Immediate Freeze",
            description="Notify compliance and risk manager on watchlist match",
            trigger_event="watchlist_match",
            recipient_type="compliance_officer", channel_sms=True, channel_email=True, channel_in_app=True,
            message_template="WATCHLIST MATCH: {customer_name} matched against sanctions/watchlist. Immediate account review required.",
            is_active=True, cooldown_minutes=0, severity="critical",
        ),
        # KYC expiry
        NotificationRule(
            id=str(uuid.uuid4()), name="KYC Expired — RM Notification",
            description="Notify RM when customer KYC expires",
            trigger_event="kyc_expired",
            recipient_type="rm", channel_email=True, channel_in_app=True,
            message_template="KYC EXPIRED: Customer {customer_name} KYC has expired. Transactions restricted until renewal per RBI Direction.",
            is_active=True, cooldown_minutes=1440, severity="medium",
        ),
        # Case creation — notify investigator
        NotificationRule(
            id=str(uuid.uuid4()), name="New Case Created — Investigator Alert",
            description="Notify assigned investigator when new case is created",
            trigger_event="case_created",
            recipient_type="role", recipient_roles="investigator",
            channel_email=True, channel_in_app=True,
            message_template="NEW CASE: Case {case_number} created. Type: {case_type}. Priority: {priority}. Please begin investigation.",
            is_active=True, severity="medium",
        ),
        # Court hearing reminder
        NotificationRule(
            id=str(uuid.uuid4()), name="FIR Court Hearing Reminder",
            description="Remind compliance 3 days before court hearing",
            trigger_event="fir_hearing",
            recipient_type="compliance_officer", channel_sms=True, channel_email=True, channel_in_app=True,
            message_template="HEARING REMINDER: Court hearing for FIR {fir_number} in 3 days at {court_name}. Prepare case documents.",
            is_active=True, escalation_delay_minutes=0, severity="high",
        ),
        # All alerts — in-app for analysts
        NotificationRule(
            id=str(uuid.uuid4()), name="New Alert — Analyst In-App",
            description="In-app notification for all new alerts to analyst team",
            trigger_event="alert_created",
            recipient_type="role", recipient_roles="analyst",
            channel_in_app=True,
            message_template="New alert {alert_number}: {customer_name}. Priority: {priority}.",
            is_active=True, severity="low",
        ),
        # CTR auto-generated
        NotificationRule(
            id=str(uuid.uuid4()), name="CTR Auto-Generated — Review Required",
            description="Notify compliance when CTR is auto-generated for review",
            trigger_event="ctr_filed",
            recipient_type="compliance_officer", channel_email=True, channel_in_app=True,
            message_template="CTR GENERATED: Cash Transaction Report {report_number} auto-generated for {customer_name}. Amount: {amount} INR. Review and file with FIU-IND.",
            is_active=True, severity="medium",
        ),
        # ── Internal Fraud Notifications ──────────────────────────────────────
        NotificationRule(
            id=str(uuid.uuid4()), name="Internal Fraud — Immediate CVO Alert",
            description="Notify Chief Vigilance Officer on any internal fraud detection",
            trigger_event="internal_fraud_detected",
            recipient_type="cvo", channel_sms=True, channel_email=True, channel_in_app=True,
            message_template="INTERNAL FRAUD ALERT: {rule_name} triggered for employee {employee_name}. {description}. Immediate investigation required.",
            is_active=True, cooldown_minutes=0, severity="critical",
        ),
        NotificationRule(
            id=str(uuid.uuid4()), name="Employee Override — Branch Manager",
            description="Notify branch manager when employee overrides transaction limits",
            trigger_event="employee_override",
            recipient_type="branch_manager", channel_email=True, channel_in_app=True,
            message_template="OVERRIDE ALERT: Employee {employee_name} has overridden transaction limit. Amount: {amount} INR. Customer: {customer_name}. Please verify.",
            is_active=True, cooldown_minutes=30, severity="high",
        ),
        NotificationRule(
            id=str(uuid.uuid4()), name="Maker-Checker Violation — Audit Team",
            description="Alert audit team on maker-checker bypass attempts",
            trigger_event="maker_checker_violation",
            recipient_type="role", recipient_roles="auditor",
            channel_sms=True, channel_email=True, channel_in_app=True,
            message_template="MAKER-CHECKER VIOLATION: Same user ({employee_name}) attempted maker and checker for {amount} INR transaction. Auto-blocked.",
            is_active=True, cooldown_minutes=0, severity="critical",
        ),
        NotificationRule(
            id=str(uuid.uuid4()), name="Data Access Anomaly — CISO Alert",
            description="Notify CISO when employee accesses unusual volume of customer records",
            trigger_event="data_access_anomaly",
            recipient_type="ciso", channel_sms=True, channel_email=True, channel_in_app=True,
            message_template="DATA ACCESS ANOMALY: Employee {employee_name} accessed {record_count} customer records in {time_window}. Normal: {baseline_count}. Possible data theft.",
            is_active=True, cooldown_minutes=60, severity="critical",
        ),
        # ── Cyber Fraud Notifications ─────────────────────────────────────────
        NotificationRule(
            id=str(uuid.uuid4()), name="SIM Swap Fraud — Block + Notify Customer",
            description="Auto-block account and notify customer on SIM swap fraud detection",
            trigger_event="sim_swap_fraud",
            recipient_type="customer", channel_sms=True, channel_email=True, channel_in_app=True,
            message_template="SECURITY ALERT: Suspicious activity detected on your account after SIM change. Account temporarily frozen. Call 1800-XXX-XXXX immediately.",
            is_active=True, cooldown_minutes=0, severity="critical",
        ),
        NotificationRule(
            id=str(uuid.uuid4()), name="Remote Access Fraud — SOC Team",
            description="Notify Security Operations Center when remote desktop fraud is detected",
            trigger_event="remote_access_fraud",
            recipient_type="role", recipient_roles="soc_analyst",
            channel_sms=True, channel_email=True, channel_in_app=True,
            message_template="REMOTE ACCESS FRAUD: Customer {customer_name} session has active remote desktop (AnyDesk/TeamViewer). Transaction of {amount} INR blocked. IP: {ip_address}.",
            is_active=True, cooldown_minutes=0, severity="critical",
        ),
        NotificationRule(
            id=str(uuid.uuid4()), name="UPI Fraud — Auto-Hold + Notify",
            description="Hold UPI transaction and notify fraud ops on collect request fraud",
            trigger_event="upi_collect_fraud",
            recipient_type="fraud_ops", channel_email=True, channel_in_app=True,
            message_template="UPI FRAUD DETECTED: {collect_count} collect requests to {customer_name} from VPA {vpa}. Total: {amount} INR. Transactions held for review.",
            is_active=True, cooldown_minutes=15, severity="high",
        ),
        NotificationRule(
            id=str(uuid.uuid4()), name="Credential Stuffing — IT Security",
            description="Notify IT security on credential stuffing attack detection",
            trigger_event="credential_stuffing",
            recipient_type="role", recipient_roles="it_security",
            channel_email=True, channel_in_app=True,
            message_template="CREDENTIAL STUFFING: {failed_count} failed login attempts from IP {ip_address} in {time_window}. Account {username} successfully accessed after failures. Force password reset initiated.",
            is_active=True, cooldown_minutes=5, severity="high",
        ),
        NotificationRule(
            id=str(uuid.uuid4()), name="Vishing Alert — Contact Center Lead",
            description="Alert contact center lead when vishing pattern detected post-call",
            trigger_event="vishing_detected",
            recipient_type="contact_center_lead", channel_sms=True, channel_email=True, channel_in_app=True,
            message_template="VISHING ALERT: Customer {customer_name} transferred {amount} INR ({pct_balance}% of balance) within {minutes}min of call. Transaction held. Callback required.",
            is_active=True, cooldown_minutes=0, severity="critical",
        ),
        # ── AI Fraud Notifications ────────────────────────────────────────────
        NotificationRule(
            id=str(uuid.uuid4()), name="Deepfake KYC — Compliance + IT",
            description="Notify compliance and IT when deepfake detected in video KYC",
            trigger_event="deepfake_detected",
            recipient_type="compliance_officer", channel_sms=True, channel_email=True, channel_in_app=True,
            message_template="DEEPFAKE DETECTED: Video KYC for {customer_name} flagged (liveness score: {score}). Application ID: {app_id}. KYC rejected. Manual verification required.",
            is_active=True, cooldown_minutes=0, severity="critical",
        ),
        NotificationRule(
            id=str(uuid.uuid4()), name="Synthetic Identity — Fraud Investigation",
            description="Route synthetic identity alerts to fraud investigation team",
            trigger_event="synthetic_identity",
            recipient_type="role", recipient_roles="investigator",
            channel_email=True, channel_in_app=True,
            message_template="SYNTHETIC IDENTITY: Account {account_number} opened with suspected AI-generated documents. Document fraud score: {score}. Account frozen pending investigation.",
            is_active=True, cooldown_minutes=0, severity="critical",
        ),
        NotificationRule(
            id=str(uuid.uuid4()), name="AI Document Forgery — Loan Team",
            description="Notify loan processing team on AI-generated document detection",
            trigger_event="ai_document_fraud",
            recipient_type="role", recipient_roles="loan_officer",
            channel_email=True, channel_in_app=True,
            message_template="AI DOCUMENT FRAUD: Loan application {app_id} flagged — {document_type} appears AI-generated (score: {score}). Application auto-rejected. Forward to fraud team.",
            is_active=True, cooldown_minutes=0, severity="critical",
        ),
        NotificationRule(
            id=str(uuid.uuid4()), name="ML Model Drift — Data Science Team",
            description="Alert data science team when adversarial drift detected in fraud models",
            trigger_event="model_drift",
            recipient_type="role", recipient_roles="data_science",
            channel_email=True, channel_in_app=True,
            message_template="MODEL DRIFT ALERT: Fraud scoring model showing {drift_pct}% feature drift. {anomaly_count} transactions with low-confidence scores in last {time_window}. Model retraining may be needed.",
            is_active=True, cooldown_minutes=360, severity="high",
        ),
        NotificationRule(
            id=str(uuid.uuid4()), name="Bot Detection — Auto-Block + SOC",
            description="Auto-block bot sessions and notify SOC team",
            trigger_event="bot_detected",
            recipient_type="role", recipient_roles="soc_analyst",
            channel_email=True, channel_in_app=True,
            message_template="BOT DETECTED: Non-human session on account {customer_name}. Keystroke entropy: {entropy}, mouse linearity: {linearity}. Session terminated. {txn_count} transactions blocked.",
            is_active=True, cooldown_minutes=5, severity="high",
        ),
    ]

    for r in rules:
        db.add(r)
    db.flush()  # Flush rules before adding logs that reference them

    # Seed some notification logs for demo
    demo_logs = [
        NotificationLog(
            id=str(uuid.uuid4()), notification_rule_id=rules[0].id,
            trigger_event="alert_created", resource_type="alert", resource_id="demo",
            channel="sms", status="delivered", subject="Critical Alert",
            message="CRITICAL ALERT ALT-20260405-AB12: Rajesh Mehta — 15,00,000 INR",
            sent_at=NOW - timedelta(hours=6), delivered_at=NOW - timedelta(hours=6),
            created_at=NOW - timedelta(hours=6),
        ),
        NotificationLog(
            id=str(uuid.uuid4()), notification_rule_id=rules[0].id,
            trigger_event="alert_created", resource_type="alert", resource_id="demo",
            channel="email", status="delivered", subject="Critical Alert Notification",
            message="CRITICAL ALERT ALT-20260405-AB12: Rajesh Mehta — 15,00,000 INR. Immediate review required.",
            sent_at=NOW - timedelta(hours=6), delivered_at=NOW - timedelta(hours=5, minutes=59),
            created_at=NOW - timedelta(hours=6),
        ),
        NotificationLog(
            id=str(uuid.uuid4()), notification_rule_id=rules[1].id,
            trigger_event="high_risk_transaction", resource_type="transaction", resource_id="demo",
            channel="email", status="sent", subject="High Value Transaction Alert",
            message="HIGH VALUE: Transaction of 25,00,000 INR detected for Hassan Trading LLC.",
            sent_at=NOW - timedelta(hours=3), created_at=NOW - timedelta(hours=3),
        ),
        NotificationLog(
            id=str(uuid.uuid4()), notification_rule_id=rules[3].id,
            trigger_event="alert_sla_breach", resource_type="alert", resource_id="demo",
            channel="sms", status="delivered", subject="SLA Breach",
            message="SLA BREACH: Alert ALT-20260408-CD34 has exceeded SLA deadline.",
            sent_at=NOW - timedelta(hours=1), delivered_at=NOW - timedelta(minutes=59),
            created_at=NOW - timedelta(hours=1),
        ),
        NotificationLog(
            id=str(uuid.uuid4()), notification_rule_id=rules[8].id,
            trigger_event="watchlist_match", resource_type="customer", resource_id="demo",
            channel="sms", status="failed", subject="Watchlist Match",
            message="WATCHLIST MATCH: K. Dhanabalan matched against PEP list.",
            failure_reason="SMS gateway timeout — retry scheduled",
            created_at=NOW - timedelta(hours=2),
        ),
        # Internal fraud notifications
        NotificationLog(
            id=str(uuid.uuid4()), notification_rule_id=rules[14].id,
            trigger_event="internal_fraud_detected", resource_type="alert", resource_id="demo",
            channel="sms", status="delivered", subject="Internal Fraud Alert",
            message="INTERNAL FRAUD: Employee override of INR 8,50,000 transaction at Andheri branch. CVO notified.",
            sent_at=NOW - timedelta(hours=4), delivered_at=NOW - timedelta(hours=4),
            created_at=NOW - timedelta(hours=4),
        ),
        NotificationLog(
            id=str(uuid.uuid4()), notification_rule_id=rules[17].id,
            trigger_event="data_access_anomaly", resource_type="audit", resource_id="demo",
            channel="email", status="delivered", subject="Data Access Anomaly",
            message="DATA ACCESS ANOMALY: Employee Rakesh Gupta accessed 127 customer records in 45 min. Normal baseline: 15.",
            sent_at=NOW - timedelta(hours=8), delivered_at=NOW - timedelta(hours=8),
            created_at=NOW - timedelta(hours=8),
        ),
        # Cyber fraud notifications
        NotificationLog(
            id=str(uuid.uuid4()), notification_rule_id=rules[18].id,
            trigger_event="sim_swap_fraud", resource_type="transaction", resource_id="demo",
            channel="sms", status="delivered", subject="SIM Swap Fraud",
            message="SECURITY ALERT: SIM swap detected for Ananya Sharma. Account frozen. INR 2,50,000 transfer blocked.",
            sent_at=NOW - timedelta(hours=2), delivered_at=NOW - timedelta(hours=2),
            created_at=NOW - timedelta(hours=2),
        ),
        NotificationLog(
            id=str(uuid.uuid4()), notification_rule_id=rules[19].id,
            trigger_event="remote_access_fraud", resource_type="session", resource_id="demo",
            channel="email", status="delivered", subject="Remote Access Fraud Detected",
            message="REMOTE ACCESS: AnyDesk session detected on Vikram Patel's account. INR 4,75,000 NEFT blocked. IP: 103.21.XX.XX.",
            sent_at=NOW - timedelta(minutes=90), delivered_at=NOW - timedelta(minutes=89),
            created_at=NOW - timedelta(minutes=90),
        ),
        NotificationLog(
            id=str(uuid.uuid4()), notification_rule_id=rules[22].id,
            trigger_event="vishing_detected", resource_type="transaction", resource_id="demo",
            channel="sms", status="delivered", subject="Vishing Alert",
            message="VISHING: Priya Nair transferred INR 3,20,000 (92% balance) within 12 min of inbound call. Transaction held.",
            sent_at=NOW - timedelta(minutes=45), delivered_at=NOW - timedelta(minutes=44),
            created_at=NOW - timedelta(minutes=45),
        ),
        # AI fraud notifications
        NotificationLog(
            id=str(uuid.uuid4()), notification_rule_id=rules[23].id,
            trigger_event="deepfake_detected", resource_type="kyc", resource_id="demo",
            channel="email", status="delivered", subject="Deepfake KYC Rejected",
            message="DEEPFAKE: Video KYC for applicant flagged — liveness score 0.31. Application auto-rejected. Evidence preserved for investigation.",
            sent_at=NOW - timedelta(hours=12), delivered_at=NOW - timedelta(hours=12),
            created_at=NOW - timedelta(hours=12),
        ),
        NotificationLog(
            id=str(uuid.uuid4()), notification_rule_id=rules[25].id,
            trigger_event="ai_document_fraud", resource_type="loan", resource_id="demo",
            channel="email", status="sent", subject="AI Document Fraud — Loan Application",
            message="AI FRAUD: Loan application LN-20260407-X9 salary slip flagged as AI-generated (score: 0.89). Auto-rejected.",
            sent_at=NOW - timedelta(hours=18), created_at=NOW - timedelta(hours=18),
        ),
    ]
    for log in demo_logs:
        db.add(log)

    db.flush()


def seed_sms_approvals(db: Session, customers: list, acct_map: dict, user_map: dict):
    """Seed SMS approval records for high-value transfer OTP flows."""
    import hashlib

    analysts = [u for u in user_map.values() if u.username not in ("admin", "cro")]
    reviewer = user_map.get("analyst1") or analysts[0]

    # High-value transfer scenarios — realistic Indian banking amounts (in paise)
    scenarios = [
        # (amount_paise, label, transfer_type)
        (500_000_00, "₹5,00,000 RTGS transfer to vendor account", "RTGS"),
        (1_000_000_00, "₹10,00,000 NEFT bulk payment", "NEFT"),
        (250_000_00, "₹2,50,000 IMPS corporate payout", "IMPS"),
        (750_000_00, "₹7,50,000 SWIFT outward remittance", "SWIFT"),
        (200_000_00, "₹2,00,000 online fund transfer", "NEFT"),
        (3_000_000_00, "₹30,00,000 real estate payment", "RTGS"),
        (150_000_00, "₹1,50,000 tax payment", "NEFT"),
        (450_000_00, "₹4,50,000 international wire", "SWIFT"),
        (100_000_00, "₹1,00,000 supplier payment", "IMPS"),
        (600_000_00, "₹6,00,000 loan repayment", "NEFT"),
        (800_000_00, "₹8,00,000 investment transfer", "RTGS"),
        (175_000_00, "₹1,75,000 trade settlement", "NEFT"),
        (2_500_000_00, "₹25,00,000 property advance", "RTGS"),
        (350_000_00, "₹3,50,000 overseas education fee", "SWIFT"),
        (125_000_00, "₹1,25,000 insurance premium", "NEFT"),
        (950_000_00, "₹9,50,000 share purchase transfer", "RTGS"),
        (220_000_00, "₹2,20,000 bulk salary disbursement", "NEFT"),
        (480_000_00, "₹4,80,000 FD premature closure", "NEFT"),
        (1_500_000_00, "₹15,00,000 capital investment", "RTGS"),
        (300_000_00, "₹3,00,000 consultant fee payment", "IMPS"),
    ]

    # Use high/medium risk customers for more interesting data
    priority_customers = [c for c in customers if c.risk_category in ("high", "very_high", "medium")]
    other_customers = [c for c in customers if c.risk_category == "low"]
    pool = (priority_customers * 2 + other_customers)[:len(scenarios)]
    random.shuffle(pool)

    # Second-level FRIMS approval threshold: INR 10 lakh (1_000_000_00 paise)
    FRIMS_THRESHOLD = 1_000_000_00

    # Status distribution: 40% pending, 30% approved, 20% rejected, 10% expired
    status_weights = (
        ["pending"] * 8 +
        ["approved"] * 6 +
        ["rejected"] * 4 +
        ["expired"] * 2
    )

    # FRIMS approval distribution for very-high-value approved records:
    # some already FRIMS-approved, some still pending FRIMS, one rejected by FRIMS
    frims_status_cycle = ["pending", "pending", "approved", "approved", "approved", "rejected"]

    frims_idx = 0
    created = []
    for i, (amount, label, txn_type) in enumerate(scenarios):
        cust = pool[i % len(pool)]
        accts = acct_map.get(cust.id, [])
        if not accts:
            continue
        acct = accts[0]

        status = status_weights[i % len(status_weights)]
        otp_value = f"{random.randint(100000, 999999)}"
        otp_hash = hashlib.sha256(otp_value.encode()).hexdigest()

        # Created between 1 and 45 days ago
        created_at = NOW - timedelta(days=random.uniform(0.5, 45), hours=random.uniform(0, 23))

        if status == "pending":
            otp_expires = NOW + timedelta(minutes=random.randint(2, 10))
            resolved_at = None
            resolved_by = None
            rejection_reason = None
            attempts = random.randint(0, 2)
        elif status == "approved":
            otp_expires = created_at + timedelta(minutes=10)
            resolved_at = created_at + timedelta(minutes=random.uniform(1, 8))
            resolved_by = "customer"   # OTP verified by customer on their device
            rejection_reason = None
            attempts = 1
        elif status == "rejected":
            otp_expires = created_at + timedelta(minutes=10)
            resolved_at = created_at + timedelta(minutes=random.uniform(0.5, 9))
            resolved_by = "customer"   # customer declined on their device
            rejection_reason = random.choice([
                "Customer cancelled transfer",
                "Unrecognised beneficiary — declined by customer",
                "Amount does not match customer expectation",
                "Customer requested cancellation",
                "Transaction not initiated by customer",
            ])
            attempts = random.randint(1, 3)
        else:  # expired
            otp_expires = created_at + timedelta(minutes=10)
            resolved_at = None
            resolved_by = None
            rejection_reason = None
            attempts = random.randint(0, 3)

        # FRIMS second-level approval — only for very high value
        frims_required = amount >= FRIMS_THRESHOLD
        frims_status = None
        frims_approved_by = None
        frims_approved_at = None
        frims_rejection_reason = None

        if frims_required and status == "approved":
            # Rotate through: pending FRIMS, FRIMS approved, FRIMS rejected
            fs = frims_status_cycle[frims_idx % len(frims_status_cycle)]
            frims_idx += 1
            frims_status = fs
            if fs == "approved":
                frims_approved_by = reviewer.username
                frims_approved_at = resolved_at + timedelta(hours=random.uniform(0.5, 4))
            elif fs == "rejected":
                frims_approved_by = reviewer.username
                frims_approved_at = resolved_at + timedelta(hours=random.uniform(0.5, 2))
                frims_rejection_reason = random.choice([
                    "Beneficiary flagged in internal watchlist",
                    "Transaction pattern inconsistent with customer profile",
                    "Destination jurisdiction under enhanced monitoring",
                    "AML alert triggered — manual review required",
                ])
        elif frims_required and status in ("pending", "expired"):
            # Customer hasn't approved yet — FRIMS action not yet applicable
            frims_status = None

        txn_ref = f"TXN{random.randint(10000000, 99999999)}"
        first_name = (cust.first_name or cust.last_name or "Customer").split()[0]
        amount_inr = amount / 100
        sms_text = (
            f"Dear {first_name}, OTP for {txn_type} of "
            f"INR {amount_inr:,.2f} to account ending "
            f"XXXX{random.randint(1000, 9999)} is {otp_value}. "
            f"Valid 10 mins. Do NOT share. -FinsurgeFRIMS"
        )

        sms = SMSApproval(
            id=_uid(),
            transaction_id=None,
            transaction_ref=txn_ref,
            account_id=acct.id,
            customer_id=cust.id,
            phone_number=cust.phone,
            amount=amount,
            otp_hash=otp_hash,
            otp_expires_at=otp_expires,
            status=status,
            attempts=attempts,
            sms_content=sms_text,
            sms_sent_at=created_at,
            resolved_at=resolved_at,
            resolved_by=resolved_by,
            rejection_reason=rejection_reason,
            otp_demo=otp_value,
            created_at=created_at,
            frims_approval_required=frims_required,
            frims_approval_status=frims_status,
            frims_approved_by=frims_approved_by,
            frims_approved_at=frims_approved_at,
            frims_rejection_reason=frims_rejection_reason,
        )
        db.add(sms)
        created.append(sms)

    # ── Explicit FRIMS demo records (fixed, easy to spot in UI) ──────────────
    # Pick named customers: Rajesh Mehta (high-risk), Hassan Trading (layering)
    rajesh = next((c for c in customers if "Rajesh" in (c.full_name or "")), pool[0])
    hassan = next((c for c in customers if "Hassan" in (c.full_name or "")), pool[1])
    ananya = next((c for c in customers if "Ananya" in (c.full_name or "")), pool[2] if len(pool) > 2 else pool[0])
    frims_officer = user_map.get("compliance_officer") or reviewer

    def _acct(c):
        a = acct_map.get(c.id, [])
        return a[0] if a else accts[0]

    frims_demos = [
        # 1. Awaiting FRIMS — customer OTP still pending, FRIMS can act now
        dict(
            customer=rajesh, amount=1_500_000_00,
            label="₹15,00,000 RTGS — Rajesh Mehta → Offshore vendor",
            txn_type="RTGS",
            cust_status="pending",
            otp_expires=NOW + timedelta(minutes=7),
            resolved_at=None, resolved_by=None, rejection_reason=None, attempts=1,
            frims_status=None, frims_by=None, frims_at=None, frims_reason=None,
            created_ago=timedelta(minutes=12),
        ),
        # 2. Awaiting FRIMS — customer approved OTP, FRIMS yet to act
        dict(
            customer=hassan, amount=2_500_000_00,
            label="₹25,00,000 SWIFT — Hassan Trading → Dubai entity",
            txn_type="SWIFT",
            cust_status="approved",
            otp_expires=NOW - timedelta(minutes=5),
            resolved_at=NOW - timedelta(hours=1, minutes=20),
            resolved_by="customer", rejection_reason=None, attempts=1,
            frims_status=None, frims_by=None, frims_at=None, frims_reason=None,
            created_ago=timedelta(hours=2),
        ),
        # 3. FRIMS Approved — customer OTP approved, FRIMS cleared it
        dict(
            customer=ananya, amount=1_200_000_00,
            label="₹12,00,000 NEFT — Ananya Sharma → Property developer",
            txn_type="NEFT",
            cust_status="approved",
            otp_expires=NOW - timedelta(hours=3),
            resolved_at=NOW - timedelta(hours=4),
            resolved_by="customer", rejection_reason=None, attempts=1,
            frims_status="approved", frims_by=frims_officer.username,
            frims_at=NOW - timedelta(hours=3, minutes=30), frims_reason=None,
            created_ago=timedelta(hours=5),
        ),
        # 4. FRIMS Approved — high corporate RTGS, cleared by FRIMS
        dict(
            customer=rajesh, amount=5_000_000_00,
            label="₹50,00,000 RTGS — Rajesh Mehta → Equity fund",
            txn_type="RTGS",
            cust_status="approved",
            otp_expires=NOW - timedelta(days=2),
            resolved_at=NOW - timedelta(days=2, hours=1),
            resolved_by="customer", rejection_reason=None, attempts=1,
            frims_status="approved", frims_by=frims_officer.username,
            frims_at=NOW - timedelta(days=2), frims_reason=None,
            created_ago=timedelta(days=2, hours=3),
        ),
        # 5. FRIMS Rejected — watchlist hit, FRIMS overruled customer OTP
        dict(
            customer=hassan, amount=3_000_000_00,
            label="₹30,00,000 SWIFT — Hassan Trading → Shell entity (flagged)",
            txn_type="SWIFT",
            cust_status="rejected",
            otp_expires=NOW - timedelta(hours=6),
            resolved_at=NOW - timedelta(hours=5, minutes=40),
            resolved_by=frims_officer.username,
            rejection_reason="Beneficiary flagged in OFAC SDN list — FRIMS rejected",
            attempts=1,
            frims_status="rejected", frims_by=frims_officer.username,
            frims_at=NOW - timedelta(hours=5, minutes=40),
            frims_reason="Beneficiary flagged in OFAC SDN list — transaction reversed",
            created_ago=timedelta(hours=7),
        ),
        # 6. FRIMS Rejected — AML alert, amount pattern suspicious
        dict(
            customer=ananya, amount=1_800_000_00,
            label="₹18,00,000 NEFT — Ananya Sharma → Unverified account",
            txn_type="NEFT",
            cust_status="rejected",
            otp_expires=NOW - timedelta(days=1),
            resolved_at=NOW - timedelta(days=1, hours=1),
            resolved_by=frims_officer.username,
            rejection_reason="Transaction pattern inconsistent with customer profile — AML hold",
            attempts=2,
            frims_status="rejected", frims_by=frims_officer.username,
            frims_at=NOW - timedelta(days=1),
            frims_reason="Transaction pattern inconsistent with customer profile — AML hold",
            created_ago=timedelta(days=1, hours=2),
        ),
    ]

    for d in frims_demos:
        cust = d["customer"]
        acct = _acct(cust)
        otp_val = f"{random.randint(100000, 999999)}"
        otp_hash = hashlib.sha256(otp_val.encode()).hexdigest()
        created_at = NOW - d["created_ago"]
        first_name = (cust.first_name or cust.full_name or "Customer").split()[0]
        amount_inr = d["amount"] / 100
        sms_text = (
            f"Dear {first_name}, OTP for {d['txn_type']} of "
            f"INR {amount_inr:,.2f} is {otp_val}. "
            f"Valid 10 mins. Do NOT share. -FinsurgeFRIMS"
        )
        sms = SMSApproval(
            id=_uid(),
            transaction_id=None,
            transaction_ref=f"TXN{random.randint(10000000, 99999999)}",
            account_id=acct.id,
            customer_id=cust.id,
            phone_number=cust.phone,
            amount=d["amount"],
            otp_hash=otp_hash,
            otp_expires_at=d["otp_expires"],
            status=d["cust_status"],
            attempts=d["attempts"],
            sms_content=sms_text,
            sms_sent_at=created_at,
            resolved_at=d["resolved_at"],
            resolved_by=d["resolved_by"],
            rejection_reason=d["rejection_reason"],
            otp_demo=otp_val,
            created_at=created_at,
            frims_approval_required=True,
            frims_approval_status=d["frims_status"],
            frims_approved_by=d["frims_by"],
            frims_approved_at=d["frims_at"],
            frims_rejection_reason=d["frims_reason"],
        )
        db.add(sms)
        created.append(sms)

    db.flush()
    return created


def seed_audit_trail(db: Session, customers: list, alerts: list, cases: list, user_map: dict):
    """Seed audit trail entries for customers, alerts, and cases."""
    NOW = datetime.utcnow()
    users_list = list(user_map.values()) if user_map else []
    if not users_list:
        return

    # ─── Customer Audit Entries ───
    for i, customer in enumerate(customers[:20]):
        user = random.choice(users_list)
        base_time = NOW - timedelta(days=random.randint(1, 30))

        db.add(AuditLog(
            id=str(uuid.uuid4()),
            resource_type='customer',
            resource_id=customer.id,
            action='kyc_approved',
            user_id=user.id,
            details=json.dumps({'msg': f'KYC review completed for {customer.full_name}', 'status': 'approved'}),
            created_at=base_time,
            ip_address='192.168.1.100'
        ))

        if i % 3 == 0:
            db.add(AuditLog(
                id=str(uuid.uuid4()),
                resource_type='customer',
                resource_id=customer.id,
                action='risk_updated',
                user_id=user.id,
                details=json.dumps({'msg': f'Risk category updated to {customer.risk_category}', 'new': customer.risk_category}),
                created_at=base_time + timedelta(days=5),
                ip_address='192.168.1.100'
            ))

    # ─── Alert Audit Entries ───
    for alert in alerts[:30]:
        user = random.choice(users_list)
        base_time = NOW - timedelta(days=random.randint(1, 20))

        db.add(AuditLog(
            id=str(uuid.uuid4()),
            resource_type='alert',
            resource_id=alert.id,
            action='created',
            user_id=user.id,
            details=json.dumps({'msg': f'Alert created: {alert.title}', 'priority': alert.priority}),
            created_at=base_time,
            ip_address='192.168.1.101'
        ))

        if random.random() > 0.5:
            db.add(AuditLog(
                id=str(uuid.uuid4()),
                resource_type='alert',
                resource_id=alert.id,
                action='status_changed',
                user_id=user.id,
                details=json.dumps({'msg': f'Status changed to {alert.status}', 'status': alert.status}),
                created_at=base_time + timedelta(hours=2),
                ip_address='192.168.1.101'
            ))

    # ─── Case Audit Entries ───
    for case in cases[:15]:
        user = random.choice(users_list)
        base_time = NOW - timedelta(days=random.randint(1, 15))

        db.add(AuditLog(
            id=str(uuid.uuid4()),
            resource_type='case',
            resource_id=case.id,
            action='created',
            user_id=user.id,
            details=json.dumps({'msg': f'Case created: {case.title}', 'type': case.case_type}),
            created_at=base_time,
            ip_address='192.168.1.102'
        ))

        if random.random() > 0.6:
            db.add(AuditLog(
                id=str(uuid.uuid4()),
                resource_type='case',
                resource_id=case.id,
                action='status_changed',
                user_id=user.id,
                details=json.dumps({'msg': f'Status changed to {case.status}', 'status': case.status}),
                created_at=base_time + timedelta(days=2),
                ip_address='192.168.1.102'
            ))

    print(f"    Created audit entries for {len(customers[:20])} customers, {len(alerts[:30])} alerts, {len(cases[:15])} cases")
    db.flush()


def seed_corporate_group(db: Session, user_map: dict):
    """Create sophisticated corporate group with parent, subsidiaries, UBOs, directors, and relationships."""

    # Parent holding company
    parent = Customer(
        id=_uid(),
        customer_number="CIF-8000",
        customer_type="corporate",
        company_name="Zenith Capital Holdings Ltd.",
        email="contact@zenithcapital.in",
        phone="+91-11-40123400",
        city="Delhi",
        state="Delhi",
        country="India",
        nationality="IN",
        risk_category="high",
        risk_score=62,
        kyc_status="approved",
        kyc_expiry_date=NOW.date() + timedelta(days=365),
        onboarding_date=NOW - timedelta(days=365),
        is_active=True,
    )
    db.add(parent)
    db.flush()

    # Subsidiary 1: Manufacturing company
    sub1 = Customer(
        id=_uid(),
        customer_number="CIF-8001",
        customer_type="corporate",
        company_name="Zenith Manufacturing Private Ltd.",
        email="info@zenithmfg.in",
        phone="+91-80-22445566",
        city="Bangalore",
        state="Karnataka",
        country="India",
        nationality="IN",
        risk_category="medium",
        risk_score=35,
        kyc_status="approved",
        kyc_expiry_date=NOW.date() + timedelta(days=365),
        onboarding_date=NOW - timedelta(days=300),
        is_active=True,
    )
    db.add(sub1)
    db.flush()

    # Subsidiary 2: Real estate company
    sub2 = Customer(
        id=_uid(),
        customer_number="CIF-8002",
        customer_type="corporate",
        company_name="Zenith Properties & Developments Ltd.",
        email="sales@zenithprop.in",
        phone="+91-22-67890123",
        city="Mumbai",
        state="Maharashtra",
        country="India",
        nationality="IN",
        risk_category="medium",
        risk_score=32,
        kyc_status="approved",
        kyc_expiry_date=NOW.date() + timedelta(days=365),
        onboarding_date=NOW - timedelta(days=280),
        is_active=True,
    )
    db.add(sub2)
    db.flush()

    # Ultimate Beneficial Owner (UBO) - Individual
    ubo = Customer(
        id=_uid(),
        customer_number="CIF-8010",
        customer_type="individual",
        first_name="Vikram",
        last_name="Patel",
        date_of_birth=date(1972, 5, 15),
        gender="M",
        nationality="IN",
        pan_number="ABCDE1234F",
        email="vikram.patel@zenithcapital.in",
        phone="+91-9876543210",
        city="Delhi",
        state="Delhi",
        country="India",
        occupation="Business Owner",
        annual_income=5000000000,  # 50 crores
        source_of_funds="Self-made businessman in real estate and manufacturing",
        risk_category="high",
        risk_score=58,
        pep_status=True,  # Politically Exposed Person
        kyc_status="approved",
        kyc_expiry_date=NOW.date() + timedelta(days=365),
        onboarding_date=NOW - timedelta(days=400),
        is_active=True,
    )
    db.add(ubo)
    db.flush()

    # Director 1 - Manufacturing subsidiary
    dir1 = Customer(
        id=_uid(),
        customer_number="CIF-8011",
        customer_type="individual",
        first_name="Rajesh",
        last_name="Kumar",
        date_of_birth=date(1965, 8, 22),
        gender="M",
        nationality="IN",
        pan_number="FGHIJ5678K",
        email="rajesh.kumar@zenithmfg.in",
        phone="+91-9876543211",
        city="Bangalore",
        state="Karnataka",
        country="India",
        occupation="Managing Director",
        annual_income=2500000000,  # 25 crores
        risk_category="low",
        risk_score=18,
        kyc_status="approved",
        kyc_expiry_date=NOW.date() + timedelta(days=365),
        onboarding_date=NOW - timedelta(days=300),
        is_active=True,
    )
    db.add(dir1)
    db.flush()

    # Director 2 - Real estate subsidiary
    dir2 = Customer(
        id=_uid(),
        customer_number="CIF-8012",
        customer_type="individual",
        first_name="Priya",
        last_name="Sharma",
        date_of_birth=date(1978, 3, 10),
        gender="F",
        nationality="IN",
        pan_number="KLMNO9012P",
        email="priya.sharma@zenithprop.in",
        phone="+91-9876543212",
        city="Mumbai",
        state="Maharashtra",
        country="India",
        occupation="Director",
        annual_income=2000000000,  # 20 crores
        risk_category="low",
        risk_score=15,
        kyc_status="approved",
        kyc_expiry_date=NOW.date() + timedelta(days=365),
        onboarding_date=NOW - timedelta(days=280),
        is_active=True,
    )
    db.add(dir2)
    db.flush()

    # Shareholder - Family member
    shareholder = Customer(
        id=_uid(),
        customer_number="CIF-8013",
        customer_type="individual",
        first_name="Neha",
        last_name="Patel",
        date_of_birth=date(1980, 6, 5),
        gender="F",
        nationality="IN",
        pan_number="QRSTU3456V",
        email="neha.patel@zenithcapital.in",
        phone="+91-9876543213",
        city="Delhi",
        state="Delhi",
        country="India",
        occupation="Businesswoman",
        annual_income=1500000000,  # 15 crores
        risk_category="low",
        risk_score=12,
        kyc_status="approved",
        kyc_expiry_date=NOW.date() + timedelta(days=365),
        onboarding_date=NOW - timedelta(days=350),
        is_active=True,
    )
    db.add(shareholder)
    db.flush()

    # Create relationships
    relationships = [
        # Parent to subsidiaries
        CustomerRelationship(
            id=_uid(),
            customer_id_1=parent.id,
            customer_id_2=sub1.id,
            relationship_type="parent_subsidiary",
            created_at=NOW - timedelta(days=300),
        ),
        CustomerRelationship(
            id=_uid(),
            customer_id_1=parent.id,
            customer_id_2=sub2.id,
            relationship_type="parent_subsidiary",
            created_at=NOW - timedelta(days=280),
        ),
        # UBO relationships
        CustomerRelationship(
            id=_uid(),
            customer_id_1=parent.id,
            customer_id_2=ubo.id,
            relationship_type="ultimate_beneficial_owner",
            created_at=NOW - timedelta(days=400),
        ),
        CustomerRelationship(
            id=_uid(),
            customer_id_1=sub1.id,
            customer_id_2=ubo.id,
            relationship_type="ultimate_beneficial_owner",
            created_at=NOW - timedelta(days=300),
        ),
        CustomerRelationship(
            id=_uid(),
            customer_id_1=sub2.id,
            customer_id_2=ubo.id,
            relationship_type="ultimate_beneficial_owner",
            created_at=NOW - timedelta(days=280),
        ),
        # Directors
        CustomerRelationship(
            id=_uid(),
            customer_id_1=sub1.id,
            customer_id_2=dir1.id,
            relationship_type="director",
            created_at=NOW - timedelta(days=300),
        ),
        CustomerRelationship(
            id=_uid(),
            customer_id_1=sub2.id,
            customer_id_2=dir2.id,
            relationship_type="director",
            created_at=NOW - timedelta(days=280),
        ),
        # Shareholders
        CustomerRelationship(
            id=_uid(),
            customer_id_1=parent.id,
            customer_id_2=shareholder.id,
            relationship_type="shareholder",
            created_at=NOW - timedelta(days=350),
        ),
        # Inter-subsidiary relationship
        CustomerLink(
            id=_uid(),
            customer_id_1=sub1.id,
            customer_id_2=sub2.id,
            link_type="sibling_subsidiary",
            detected_at=NOW - timedelta(days=250),
        ),
    ]

    for rel in relationships:
        db.add(rel)

    db.flush()


def seed_ubo_records(db: Session, customers: list):
    """Seed UBO records for corporate customers (FATF R.24 / RBI KYC Master Direction 2023)."""
    corporate_customers = [c for c in customers if c.customer_type == "corporate"]

    # Also pick up corporate customers added by seed_corporate_group (CIF-8000/8001/8002)
    from app.models import Customer as CustomerModel
    db_corporates = db.query(CustomerModel).filter(CustomerModel.customer_type == "corporate").all()
    seen_ids = {c.id for c in corporate_customers}
    for c in db_corporates:
        if c.id not in seen_ids:
            corporate_customers.append(c)
            seen_ids.add(c.id)

    # UBO data keyed by company name pattern (partial match)
    ubo_templates = {
        "Vikram Enterprises": [
            {"ubo_name": "Vikram Malhotra", "ownership_percentage": 51.0, "nationality": "IN",
             "date_of_birth": date(1968, 3, 22), "id_type": "pan", "id_number": "ABCVM1234K",
             "relationship_type": "promoter", "verified": True},
            {"ubo_name": "Sunita Malhotra", "ownership_percentage": 26.0, "nationality": "IN",
             "date_of_birth": date(1971, 8, 14), "id_type": "pan", "id_number": "ABCSM5678L",
             "relationship_type": "director", "verified": True},
            {"ubo_name": "Rahul Malhotra", "ownership_percentage": 23.0, "nationality": "IN",
             "date_of_birth": date(1995, 11, 5), "id_type": "pan", "id_number": "ABCRM9012M",
             "relationship_type": "shareholder", "verified": False},
        ],
        "Diamond Star Jewellers": [
            {"ubo_name": "Hasmukh Mehta", "ownership_percentage": 60.0, "nationality": "IN",
             "date_of_birth": date(1955, 6, 1), "id_type": "pan", "id_number": "AAAHM4321Z",
             "relationship_type": "promoter", "verified": True},
            {"ubo_name": "Kokila Mehta", "ownership_percentage": 25.0, "nationality": "IN",
             "date_of_birth": date(1960, 12, 19), "id_type": "pan", "id_number": "AAAKM8765Y",
             "relationship_type": "director", "verified": True},
            {"ubo_name": "Nirav Mehta", "ownership_percentage": 15.0, "nationality": "IN",
             "date_of_birth": date(1988, 4, 30), "id_type": "passport", "id_number": "J8801234",
             "relationship_type": "shareholder", "verified": False},
        ],
        "Zenith Capital Holdings": [
            {"ubo_name": "Vikram Patel", "ownership_percentage": 55.0, "nationality": "IN",
             "date_of_birth": date(1972, 5, 15), "id_type": "pan", "id_number": "ABCDE1234F",
             "relationship_type": "promoter", "verified": True},
            {"ubo_name": "Meenakshi Patel", "ownership_percentage": 30.0, "nationality": "IN",
             "date_of_birth": date(1975, 9, 28), "id_type": "pan", "id_number": "ABCMP4321G",
             "relationship_type": "director", "verified": True},
            {"ubo_name": "Aryan Ventures LLP", "ownership_percentage": 15.0, "nationality": "IN",
             "date_of_birth": None, "id_type": "cin", "id_number": "AAA-1234",
             "relationship_type": "shareholder", "verified": False},
        ],
        "Zenith Manufacturing": [
            {"ubo_name": "Vikram Patel", "ownership_percentage": 55.0, "nationality": "IN",
             "date_of_birth": date(1972, 5, 15), "id_type": "pan", "id_number": "ABCDE1234F",
             "relationship_type": "promoter", "verified": True},
            {"ubo_name": "Rajesh Iyer", "ownership_percentage": 30.0, "nationality": "IN",
             "date_of_birth": date(1969, 7, 11), "id_type": "pan", "id_number": "AACRI7654H",
             "relationship_type": "director", "verified": True},
            {"ubo_name": "Global Funds Mauritius", "ownership_percentage": 15.0, "nationality": "MU",
             "date_of_birth": None, "id_type": "cin", "id_number": "GFM-20190023",
             "relationship_type": "shareholder", "verified": False},
        ],
        "Zenith Properties": [
            {"ubo_name": "Vikram Patel", "ownership_percentage": 51.0, "nationality": "IN",
             "date_of_birth": date(1972, 5, 15), "id_type": "pan", "id_number": "ABCDE1234F",
             "relationship_type": "promoter", "verified": True},
            {"ubo_name": "Sushma Rao", "ownership_percentage": 26.0, "nationality": "IN",
             "date_of_birth": date(1978, 2, 17), "id_type": "pan", "id_number": "AACSR3210J",
             "relationship_type": "director", "verified": True},
            {"ubo_name": "Zenith Capital Holdings Ltd.", "ownership_percentage": 23.0, "nationality": "IN",
             "date_of_birth": None, "id_type": "cin", "id_number": "L65100MH2010PLC201234",
             "relationship_type": "shareholder", "verified": True},
        ],
    }

    # Default template for any corporate not matched above
    default_template = [
        {"ubo_name": "Suresh Agarwal", "ownership_percentage": 51.0, "nationality": "IN",
         "date_of_birth": date(1965, 4, 10), "id_type": "pan", "id_number": "AACSA1111B",
         "relationship_type": "promoter", "verified": True},
        {"ubo_name": "Priya Agarwal", "ownership_percentage": 26.0, "nationality": "IN",
         "date_of_birth": date(1968, 10, 25), "id_type": "pan", "id_number": "AACPA2222C",
         "relationship_type": "director", "verified": False},
        {"ubo_name": "SBF Investments Pvt Ltd", "ownership_percentage": 23.0, "nationality": "IN",
         "date_of_birth": None, "id_type": "cin", "id_number": "U65100KA2015PTC080123",
         "relationship_type": "shareholder", "verified": False},
    ]

    count = 0
    for customer in corporate_customers:
        company = customer.company_name or customer.full_name or ""
        template = default_template
        for key, tmpl in ubo_templates.items():
            if key.lower() in company.lower():
                template = tmpl
                break

        for t in template:
            verified_at = NOW - timedelta(days=random.randint(30, 180)) if t["verified"] else None
            record = UBORecord(
                customer_id=customer.id,
                ubo_name=t["ubo_name"],
                ownership_percentage=t["ownership_percentage"],
                nationality=t["nationality"],
                date_of_birth=t["date_of_birth"],
                id_type=t["id_type"],
                id_number=t["id_number"],
                relationship_type=t["relationship_type"],
                verified=t["verified"],
                verified_at=verified_at,
                created_at=NOW - timedelta(days=random.randint(60, 365)),
            )
            db.add(record)
            count += 1

    db.flush()
    print(f"    Created {count} UBO records for {len(corporate_customers)} corporate customers")


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

    print("  Seeding network relationships...")
    seed_network(db, customers)
    db.commit()

    print("  Seeding reports...")
    seed_reports(db, customers, cases, user_map)

    print("  Seeding system config...")
    seed_system_config(db)

    print("  Seeding employee activities...")
    seed_employee_activities(db)

    print("  Seeding police FIRs...")
    seed_police_firs(db, cases, user_map)

    print("  Seeding notification rules...")
    seed_notification_rules(db)

    print("  Seeding corporate group structure...")
    seed_corporate_group(db, user_map)
    db.commit()

    print("  Seeding UBO records...")
    seed_ubo_records(db, customers)
    db.commit()

    print("  Seeding SMS approvals...")
    sms_approvals = seed_sms_approvals(db, customers, acct_map, user_map)
    print(f"    Created {len(sms_approvals)} SMS approval records")
    db.commit()

    print("  Seeding audit trail...")
    seed_audit_trail(db, customers, alerts, cases, user_map)

    db.commit()
    print("  All seed data committed!")
