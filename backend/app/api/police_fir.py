"""
Police FIR Management — File FIRs, track investigations, court proceedings,
recovery, and RBI fraud reporting (FMR-1/FMR-2).
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, Customer, Case
from app.models.police_fir import PoliceFIR, FIRActivity

router = APIRouter(prefix="/police-fir", tags=["Police & FIR"])

OFFENSE_TYPES = [
    {"code": "cheating", "label": "Cheating (IPC 420)", "ipc": "420"},
    {"code": "forgery", "label": "Forgery (IPC 468, 471)", "ipc": "468, 471"},
    {"code": "cyber_fraud", "label": "Cyber Fraud (IT Act 66C, 66D)", "ipc": "IT Act Sec 66C, 66D"},
    {"code": "money_laundering", "label": "Money Laundering (PMLA Sec 3, 4)", "ipc": "PMLA Sec 3, 4"},
    {"code": "identity_theft", "label": "Identity Theft (IT Act 66C)", "ipc": "IT Act Sec 66C"},
    {"code": "card_fraud", "label": "Card Fraud (IPC 420, IT Act 66C)", "ipc": "420, IT Act Sec 66C"},
    {"code": "upi_fraud", "label": "UPI Fraud (IPC 420, IT Act 66D)", "ipc": "420, IT Act Sec 66D"},
    {"code": "loan_fraud", "label": "Loan Fraud (IPC 420, 467)", "ipc": "420, 467"},
    {"code": "insider_fraud", "label": "Insider Fraud (IPC 408, 409)", "ipc": "408, 409"},
    {"code": "phishing", "label": "Phishing (IT Act 66D)", "ipc": "IT Act Sec 66D"},
    {"code": "sim_swap", "label": "SIM Swap Fraud (IPC 420, IT Act 66)", "ipc": "420, IT Act Sec 66"},
    {"code": "account_takeover", "label": "Account Takeover (IPC 420, IT Act 43)", "ipc": "420, IT Act Sec 43"},
]

FIR_STATUSES = [
    {"code": "draft", "label": "Draft", "color": "gray"},
    {"code": "filed", "label": "Filed with Police", "color": "blue"},
    {"code": "acknowledged", "label": "Acknowledged", "color": "indigo"},
    {"code": "under_investigation", "label": "Under Investigation", "color": "amber"},
    {"code": "charge_sheet_filed", "label": "Charge Sheet Filed", "color": "orange"},
    {"code": "court_proceedings", "label": "Court Proceedings", "color": "purple"},
    {"code": "convicted", "label": "Convicted", "color": "green"},
    {"code": "acquitted", "label": "Acquitted", "color": "red"},
    {"code": "closed", "label": "Closed", "color": "slate"},
    {"code": "withdrawn", "label": "Withdrawn", "color": "slate"},
]

VALID_TRANSITIONS = {
    "draft": ["filed", "withdrawn"],
    "filed": ["acknowledged", "withdrawn"],
    "acknowledged": ["under_investigation"],
    "under_investigation": ["charge_sheet_filed", "closed"],
    "charge_sheet_filed": ["court_proceedings"],
    "court_proceedings": ["convicted", "acquitted"],
    "convicted": ["closed"],
    "acquitted": ["closed"],
    "closed": [],
    "withdrawn": [],
}


class FIRCreate(BaseModel):
    case_id: str
    police_station: str
    police_district: Optional[str] = None
    police_state: Optional[str] = None
    offense_type: str
    offense_description: Optional[str] = None
    fraud_amount: Optional[int] = 0
    offense_date: Optional[str] = None
    priority: Optional[str] = "medium"
    notes: Optional[str] = None


class FIRUpdate(BaseModel):
    status: Optional[str] = None
    investigating_officer: Optional[str] = None
    officer_contact: Optional[str] = None
    officer_designation: Optional[str] = None
    acknowledgment_number: Optional[str] = None
    charge_sheet_number: Optional[str] = None
    court_name: Optional[str] = None
    court_case_number: Optional[str] = None
    next_hearing_date: Optional[str] = None
    hearing_notes: Optional[str] = None
    amount_recovered: Optional[int] = None
    recovery_details: Optional[str] = None
    assets_frozen: Optional[bool] = None
    freeze_order_details: Optional[str] = None
    notes: Optional[str] = None


def _gen_fir_number():
    d = datetime.utcnow().strftime("%Y%m%d")
    return f"FIR-{d}-{uuid.uuid4().hex[:4].upper()}"


@router.get("/{fir_id}/download", response_class=PlainTextResponse)
def download_fir(
    fir_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download Police FIR document with all details."""
    fir = db.query(PoliceFIR).filter(PoliceFIR.id == fir_id).first()
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")

    case = db.query(Case).filter(Case.id == fir.case_id).first() if fir.case_id else None
    customer = db.query(Customer).filter(Customer.id == fir.customer_id).first() if fir.customer_id else None
    creator = db.query(User).filter(User.id == fir.created_by).first() if fir.created_by else None
    filer = db.query(User).filter(User.id == fir.filed_by).first() if fir.filed_by else None

    fraud_amount_inr = (fir.fraud_amount or 0) / 100
    recovered_amount_inr = (fir.amount_recovered or 0) / 100

    document = f"""FIRST INFORMATION REPORT (FIR)
================================================================
FIR Number:          {fir.fir_number}
Status:              {(fir.status or 'DRAFT').upper()}
Priority:            {(fir.priority or 'MEDIUM').upper()}
Bank Case Number:    {case.case_number if case else '-'}

REPORTED AGAINST (SUBJECT / CUSTOMER)
================================================================
Name:                {customer.full_name if customer else '-'}
Customer ID:         {customer.customer_number if customer else '-'}
PAN:                 {customer.pan_number if customer and customer.pan_number else 'Not on file'}
Address:             {(customer.city if customer else '-')}, {(customer.state if customer else '-')}, INDIA

POLICE STATION & OFFICER DETAILS
================================================================
Police Station:      {fir.police_station}
District:            {fir.police_district or '-'}
State:               {fir.police_state or '-'}
Investigating Off.   {fir.investigating_officer or 'To be assigned'}

OFFENSE DETAILS
================================================================
Offense Type:        {fir.offense_type}
IPC / Legal Sections: {fir.ipc_sections or '-'}
Fraud Amount:        INR {fraud_amount_inr:,.2f}

FIR FILING TIMELINE
================================================================
Draft Created:       {fir.created_at.strftime('%d-%b-%Y %H:%M UTC') if fir.created_at else '-'}
Filed Date:          {fir.filed_at.strftime('%d-%b-%Y %H:%M UTC') if fir.filed_at else 'PENDING'}
Acknowledged Date:   {fir.acknowledged_at.strftime('%d-%b-%Y') if fir.acknowledged_at else 'Pending'}

INVESTIGATION STATUS
================================================================
Charge Sheet Filed:  {fir.charge_sheet_date.strftime('%d-%b-%Y') if fir.charge_sheet_date else 'Not yet filed'}
Court Name:          {fir.court_name or '-'}
Next Hearing Date:   {fir.next_hearing_date.strftime('%d-%b-%Y') if fir.next_hearing_date else 'Not scheduled'}

RECOVERY & ASSET FREEZING
================================================================
Fraud Amount:        INR {fraud_amount_inr:,.2f}
Amount Recovered:    INR {recovered_amount_inr:,.2f}
Recovery Rate:       {round((recovered_amount_inr/fraud_amount_inr*100) if fraud_amount_inr > 0 else 0, 1)}%
Assets Frozen:       {'YES' if fir.assets_frozen else 'No'}

REGULATORY REPORTING
================================================================
RBI Fraud Reported:  {'YES - FMR-1 filed' if fir.rbi_fraud_reported else 'No'}
Cyber Cell Report:   {'YES' if fir.cyber_cell_reported else 'No'}

Generated:           {datetime.utcnow().strftime('%d-%b-%Y %H:%M UTC')}
Downloaded by:       {current_user.full_name}
================================================================
"""

    return PlainTextResponse(
        content=document,
        headers={
            "Content-Disposition": f"attachment; filename=FIR-{fir.fir_number}.txt"
        }
    )


@router.get("/reference-data")
def fir_reference_data(current_user: User = Depends(get_current_user)):
    """Static reference data for FIR forms."""
    return {
        "offense_types": OFFENSE_TYPES,
        "statuses": FIR_STATUSES,
        "valid_transitions": VALID_TRANSITIONS,
    }


@router.get("/list")
def list_firs(
    status: str = None,
    priority: str = None,
    offset: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all FIRs with optional filtering."""
    q = db.query(PoliceFIR)
    if status:
        q = q.filter(PoliceFIR.status == status)
    if priority:
        q = q.filter(PoliceFIR.priority == priority)
    total = q.count()
    firs = q.order_by(desc(PoliceFIR.created_at)).offset(offset).limit(limit).all()

    items = []
    for f in firs:
        case = db.query(Case).filter(Case.id == f.case_id).first()
        customer = db.query(Customer).filter(Customer.id == f.customer_id).first() if f.customer_id else None
        items.append({
            "id": f.id,
            "fir_number": f.fir_number,
            "case_number": case.case_number if case else "-",
            "case_id": f.case_id,
            "customer_name": customer.full_name if customer else (customer.company_name if customer and customer.company_name else "-"),
            "customer_id": f.customer_id,
            "police_station": f.police_station,
            "police_district": f.police_district,
            "offense_type": f.offense_type,
            "fraud_amount": f.fraud_amount or 0,
            "amount_recovered": f.amount_recovered or 0,
            "status": f.status,
            "priority": f.priority,
            "filed_at": f.filed_at.isoformat() if f.filed_at else None,
            "next_hearing_date": f.next_hearing_date.isoformat() if f.next_hearing_date else None,
            "rbi_fraud_reported": f.rbi_fraud_reported,
            "cyber_cell_reported": f.cyber_cell_reported,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        })

    # Summary counts
    all_firs = db.query(PoliceFIR).all()
    summary = {
        "total": total,
        "draft": sum(1 for x in all_firs if x.status == "draft"),
        "filed": sum(1 for x in all_firs if x.status == "filed"),
        "under_investigation": sum(1 for x in all_firs if x.status == "under_investigation"),
        "charge_sheet_filed": sum(1 for x in all_firs if x.status == "charge_sheet_filed"),
        "court_proceedings": sum(1 for x in all_firs if x.status == "court_proceedings"),
        "convicted": sum(1 for x in all_firs if x.status == "convicted"),
        "closed": sum(1 for x in all_firs if x.status in ("closed", "acquitted", "withdrawn")),
        "total_fraud_amount": sum(x.fraud_amount or 0 for x in all_firs),
        "total_recovered": sum(x.amount_recovered or 0 for x in all_firs),
        "rbi_reported_count": sum(1 for x in all_firs if x.rbi_fraud_reported),
    }

    return {"firs": items, "summary": summary, "total": total}


@router.get("/{fir_id}")
def get_fir(fir_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get FIR detail with timeline."""
    f = db.query(PoliceFIR).filter(PoliceFIR.id == fir_id).first()
    if not f:
        raise HTTPException(404, "FIR not found")

    case = db.query(Case).filter(Case.id == f.case_id).first()
    customer = db.query(Customer).filter(Customer.id == f.customer_id).first() if f.customer_id else None
    filer = db.query(User).filter(User.id == f.filed_by).first() if f.filed_by else None
    creator = db.query(User).filter(User.id == f.created_by).first() if f.created_by else None

    activities = db.query(FIRActivity).filter(FIRActivity.fir_id == fir_id).order_by(desc(FIRActivity.created_at)).all()
    timeline = []
    for a in activities:
        u = db.query(User).filter(User.id == a.user_id).first() if a.user_id else None
        timeline.append({
            "id": a.id,
            "activity_type": a.activity_type,
            "description": a.description,
            "old_value": a.old_value,
            "new_value": a.new_value,
            "user_name": u.full_name if u else "System",
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    return {
        "id": f.id,
        "fir_number": f.fir_number,
        "case_id": f.case_id,
        "case_number": case.case_number if case else None,
        "customer_id": f.customer_id,
        "customer_name": customer.full_name if customer else None,
        "police_station": f.police_station,
        "police_district": f.police_district,
        "police_state": f.police_state,
        "investigating_officer": f.investigating_officer,
        "officer_contact": f.officer_contact,
        "officer_designation": f.officer_designation,
        "offense_type": f.offense_type,
        "ipc_sections": f.ipc_sections,
        "fraud_amount": f.fraud_amount or 0,
        "offense_date": f.offense_date.isoformat() if f.offense_date else None,
        "offense_description": f.offense_description,
        "status": f.status,
        "priority": f.priority,
        "filed_by_name": filer.full_name if filer else None,
        "filed_at": f.filed_at.isoformat() if f.filed_at else None,
        "acknowledged_at": f.acknowledged_at.isoformat() if f.acknowledged_at else None,
        "acknowledgment_number": f.acknowledgment_number,
        "charge_sheet_date": f.charge_sheet_date.isoformat() if f.charge_sheet_date else None,
        "charge_sheet_number": f.charge_sheet_number,
        "court_name": f.court_name,
        "court_case_number": f.court_case_number,
        "next_hearing_date": f.next_hearing_date.isoformat() if f.next_hearing_date else None,
        "hearing_notes": f.hearing_notes,
        "amount_recovered": f.amount_recovered or 0,
        "recovery_details": f.recovery_details,
        "assets_frozen": f.assets_frozen,
        "freeze_order_details": f.freeze_order_details,
        "rbi_fraud_reported": f.rbi_fraud_reported,
        "rbi_report_date": f.rbi_report_date.isoformat() if f.rbi_report_date else None,
        "rbi_reference": f.rbi_reference,
        "cyber_cell_reported": f.cyber_cell_reported,
        "cyber_complaint_number": f.cyber_complaint_number,
        "notes": f.notes,
        "created_by_name": creator.full_name if creator else None,
        "created_at": f.created_at.isoformat() if f.created_at else None,
        "updated_at": f.updated_at.isoformat() if f.updated_at else None,
        "timeline": timeline,
        "valid_transitions": VALID_TRANSITIONS.get(f.status, []),
    }


@router.post("/create")
def create_fir(body: FIRCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create a new FIR from a case."""
    case = db.query(Case).filter(Case.id == body.case_id).first()
    if not case:
        raise HTTPException(404, "Case not found")

    # Find IPC sections for offense type
    ipc = next((o["ipc"] for o in OFFENSE_TYPES if o["code"] == body.offense_type), "")

    fir = PoliceFIR(
        id=str(uuid.uuid4()),
        fir_number=_gen_fir_number(),
        case_id=body.case_id,
        customer_id=case.customer_id,
        police_station=body.police_station,
        police_district=body.police_district,
        police_state=body.police_state,
        offense_type=body.offense_type,
        ipc_sections=ipc,
        fraud_amount=body.fraud_amount or case.total_suspicious_amount or 0,
        offense_date=datetime.fromisoformat(body.offense_date) if body.offense_date else None,
        offense_description=body.offense_description,
        status="draft",
        priority=body.priority or case.priority,
        notes=body.notes,
        created_by=current_user.id,
    )
    db.add(fir)

    activity = FIRActivity(
        id=str(uuid.uuid4()),
        fir_id=fir.id,
        user_id=current_user.id,
        activity_type="created",
        description=f"FIR draft created for case {case.case_number}",
    )
    db.add(activity)
    db.commit()

    return {"id": fir.id, "fir_number": fir.fir_number, "status": "draft"}


@router.put("/{fir_id}/update")
def update_fir(fir_id: str, body: FIRUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update FIR details and status transitions."""
    fir = db.query(PoliceFIR).filter(PoliceFIR.id == fir_id).first()
    if not fir:
        raise HTTPException(404, "FIR not found")

    # Status transition
    if body.status and body.status != fir.status:
        valid = VALID_TRANSITIONS.get(fir.status, [])
        if body.status not in valid:
            raise HTTPException(400, f"Cannot transition from '{fir.status}' to '{body.status}'. Valid: {valid}")

        old_status = fir.status
        fir.status = body.status

        # Auto-set timestamps
        if body.status == "filed":
            fir.filed_at = datetime.utcnow()
            fir.filed_by = current_user.id
        elif body.status == "acknowledged":
            fir.acknowledged_at = datetime.utcnow()
        elif body.status == "charge_sheet_filed":
            fir.charge_sheet_date = datetime.utcnow()

        db.add(FIRActivity(
            id=str(uuid.uuid4()), fir_id=fir.id, user_id=current_user.id,
            activity_type="status_changed",
            description=f"Status changed from {old_status} to {body.status}",
            old_value=old_status, new_value=body.status,
        ))

    # Update fields
    for field in ["investigating_officer", "officer_contact", "officer_designation",
                  "acknowledgment_number", "charge_sheet_number", "court_name",
                  "court_case_number", "hearing_notes", "recovery_details",
                  "freeze_order_details", "notes"]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(fir, field, val)

    if body.next_hearing_date:
        fir.next_hearing_date = datetime.fromisoformat(body.next_hearing_date)
        db.add(FIRActivity(
            id=str(uuid.uuid4()), fir_id=fir.id, user_id=current_user.id,
            activity_type="hearing_scheduled",
            description=f"Next hearing scheduled: {body.next_hearing_date}",
        ))

    if body.amount_recovered is not None:
        old = fir.amount_recovered or 0
        fir.amount_recovered = body.amount_recovered
        if body.amount_recovered != old:
            db.add(FIRActivity(
                id=str(uuid.uuid4()), fir_id=fir.id, user_id=current_user.id,
                activity_type="recovery",
                description=f"Recovery updated: {old/100:.0f} → {body.amount_recovered/100:.0f} INR",
                old_value=str(old), new_value=str(body.amount_recovered),
            ))

    if body.assets_frozen is not None:
        fir.assets_frozen = body.assets_frozen

    fir.updated_at = datetime.utcnow()
    db.commit()
    return {"id": fir.id, "status": fir.status}


@router.post("/{fir_id}/report-rbi")
def report_to_rbi(fir_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Mark FIR as reported to RBI (FMR-1 filing)."""
    fir = db.query(PoliceFIR).filter(PoliceFIR.id == fir_id).first()
    if not fir:
        raise HTTPException(404, "FIR not found")

    fir.rbi_fraud_reported = True
    fir.rbi_report_date = datetime.utcnow()
    fir.rbi_reference = f"FMR-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    db.add(FIRActivity(
        id=str(uuid.uuid4()), fir_id=fir.id, user_id=current_user.id,
        activity_type="rbi_reported",
        description=f"Fraud reported to RBI via FMR-1. Reference: {fir.rbi_reference}",
    ))
    db.commit()
    return {"rbi_reference": fir.rbi_reference}


@router.post("/{fir_id}/report-cyber-cell")
def report_to_cyber_cell(fir_id: str, complaint_number: str = "", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Mark FIR as reported to Cyber Crime Cell (cybercrime.gov.in)."""
    fir = db.query(PoliceFIR).filter(PoliceFIR.id == fir_id).first()
    if not fir:
        raise HTTPException(404, "FIR not found")

    fir.cyber_cell_reported = True
    fir.cyber_complaint_number = complaint_number or f"CC-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    db.add(FIRActivity(
        id=str(uuid.uuid4()), fir_id=fir.id, user_id=current_user.id,
        activity_type="status_changed",
        description=f"Reported to Cyber Crime Cell. Complaint: {fir.cyber_complaint_number}",
    ))
    db.commit()
    return {"cyber_complaint_number": fir.cyber_complaint_number}


@router.get("/dashboard/summary")
def fir_dashboard(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """FIR dashboard with summary stats and upcoming hearings."""
    all_firs = db.query(PoliceFIR).all()
    now = datetime.utcnow()

    # Upcoming hearings
    upcoming_hearings = [
        {
            "fir_number": f.fir_number,
            "fir_id": f.id,
            "court_name": f.court_name,
            "next_hearing_date": f.next_hearing_date.isoformat() if f.next_hearing_date else None,
            "offense_type": f.offense_type,
            "status": f.status,
        }
        for f in all_firs
        if f.next_hearing_date and f.next_hearing_date > now
    ]
    upcoming_hearings.sort(key=lambda x: x["next_hearing_date"])

    # By offense type
    offense_breakdown = {}
    for f in all_firs:
        key = f.offense_type or "unknown"
        if key not in offense_breakdown:
            offense_breakdown[key] = {"count": 0, "fraud_amount": 0, "recovered": 0}
        offense_breakdown[key]["count"] += 1
        offense_breakdown[key]["fraud_amount"] += f.fraud_amount or 0
        offense_breakdown[key]["recovered"] += f.amount_recovered or 0

    total_fraud = sum(f.fraud_amount or 0 for f in all_firs)
    total_recovered = sum(f.amount_recovered or 0 for f in all_firs)

    return {
        "total_firs": len(all_firs),
        "active": sum(1 for f in all_firs if f.status not in ("closed", "withdrawn", "convicted", "acquitted")),
        "pending_filing": sum(1 for f in all_firs if f.status == "draft"),
        "under_investigation": sum(1 for f in all_firs if f.status == "under_investigation"),
        "court_proceedings": sum(1 for f in all_firs if f.status == "court_proceedings"),
        "convictions": sum(1 for f in all_firs if f.status == "convicted"),
        "total_fraud_amount": total_fraud,
        "total_recovered": total_recovered,
        "recovery_rate": round((total_recovered / total_fraud * 100) if total_fraud > 0 else 0, 1),
        "rbi_reported": sum(1 for f in all_firs if f.rbi_fraud_reported),
        "cyber_reported": sum(1 for f in all_firs if f.cyber_cell_reported),
        "upcoming_hearings": upcoming_hearings[:10],
        "offense_breakdown": [
            {"offense_type": k, **v} for k, v in offense_breakdown.items()
        ],
    }
