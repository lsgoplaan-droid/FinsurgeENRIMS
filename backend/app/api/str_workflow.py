"""
PMLA Section 12 — Suspicious Transaction Report (STR) Workflow.
Full lifecycle: detection → analyst escalation → Principal Officer review → FIU-IND filing.
Covers R3 from production roadmap.
"""
import uuid
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models import SARReport, Alert, Case, Customer, User, AuditLog

router = APIRouter(prefix="/str-workflow", tags=["STR Workflow (PMLA)"])


# ── Schemas ────────────────────────────────────────────────────────────────

class STRCreateRequest(BaseModel):
    """Escalate an alert/case to STR — analyst initiates."""
    case_id: Optional[str] = None
    alert_id: Optional[str] = None
    customer_id: str
    suspicious_activity_type: str  # structuring, layering, round_tripping, shell_company, terror_financing, etc.
    narrative: str
    total_amount: int  # paise
    date_range_start: str  # YYYY-MM-DD
    date_range_end: str    # YYYY-MM-DD
    urgency: str = "normal"  # normal, urgent (for terror financing / large fraud)


class POReviewRequest(BaseModel):
    """Principal Officer review decision."""
    decision: str  # approve, reject, return_for_revision
    po_remarks: str
    po_risk_assessment: Optional[str] = None  # low, medium, high, critical


class FIUFilingRequest(BaseModel):
    """Mark STR as filed with FIU-IND."""
    fiu_acknowledgement_number: Optional[str] = None
    filing_remarks: Optional[str] = None


class STRAmendRequest(BaseModel):
    """Amend a filed STR (within 7 days per PMLA Rules)."""
    amendment_reason: str
    updated_narrative: Optional[str] = None
    updated_amount: Optional[int] = None


# ── STR Lifecycle States ───────────────────────────────────────────────────
# draft → escalated_to_po → po_approved → filed_with_fiu → fiu_acknowledged
#                          → po_rejected (can be re-escalated)
#                          → returned_for_revision (analyst updates and re-escalates)
# filed_with_fiu → amended (within 7 days)

VALID_TRANSITIONS = {
    "draft": ["escalated_to_po"],
    "escalated_to_po": ["po_approved", "po_rejected", "returned_for_revision"],
    "po_approved": ["filed_with_fiu"],
    "po_rejected": ["draft"],  # analyst can revise and re-escalate
    "returned_for_revision": ["escalated_to_po"],  # re-escalate after revision
    "filed_with_fiu": ["fiu_acknowledged", "amended"],
    "fiu_acknowledged": ["amended"],
    "amended": ["filed_with_fiu"],  # re-file after amendment
}


def _log_str_activity(db: Session, str_id: str, user_id: str, action: str, details: str):
    """Append audit trail entry for STR lifecycle event."""
    log = AuditLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        action=action,
        resource_type="str_report",
        resource_id=str_id,
        details=details,
        created_at=datetime.utcnow(),
    )
    db.add(log)


# ── Endpoints ──────────────────────────────────────────────────────────────

@router.get("/dashboard")
def str_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """STR workflow dashboard — counts by status, SLA compliance, aging."""
    total = db.query(func.count(SARReport.id)).scalar() or 0
    by_status = {}
    for status in ["draft", "escalated_to_po", "po_approved", "po_rejected",
                    "returned_for_revision", "filed_with_fiu", "fiu_acknowledged", "amended"]:
        count = db.query(func.count(SARReport.id)).filter(SARReport.filing_status == status).scalar() or 0
        by_status[status] = count

    # Pending PO review (SLA: 48 hours from escalation)
    pending_po = db.query(SARReport).filter(SARReport.filing_status == "escalated_to_po").all()
    po_overdue = 0
    for s in pending_po:
        if s.updated_at:
            hours_since = (datetime.utcnow() - s.updated_at).total_seconds() / 3600
            if hours_since > 48:
                po_overdue += 1

    # Pending FIU filing (SLA: 7 days from PO approval per PMLA Rules 2005)
    pending_filing = db.query(SARReport).filter(SARReport.filing_status == "po_approved").all()
    filing_overdue = 0
    for s in pending_filing:
        if s.updated_at:
            days_since = (datetime.utcnow() - s.updated_at).days
            if days_since > 7:
                filing_overdue += 1

    # Filed this month
    first_of_month = date.today().replace(day=1)
    filed_this_month = db.query(func.count(SARReport.id)).filter(
        SARReport.filing_status.in_(["filed_with_fiu", "fiu_acknowledged"]),
        SARReport.filed_at >= datetime.combine(first_of_month, datetime.min.time()),
    ).scalar() or 0

    return {
        "total_strs": total,
        "by_status": by_status,
        "pending_po_review": by_status.get("escalated_to_po", 0),
        "po_review_overdue": po_overdue,
        "pending_fiu_filing": by_status.get("po_approved", 0),
        "fiu_filing_overdue": filing_overdue,
        "filed_this_month": filed_this_month,
        "sla": {
            "po_review_hours": 48,
            "fiu_filing_days": 7,
            "amendment_window_days": 7,
        },
    }


@router.get("/list")
def list_strs(
    status: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all STRs with optional status filter."""
    query = db.query(SARReport)
    if status:
        query = query.filter(SARReport.filing_status == status)
    total = query.count()
    strs = query.order_by(SARReport.updated_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for s in strs:
        customer = db.query(Customer).filter(Customer.id == s.customer_id).first()
        items.append({
            "id": s.id,
            "report_number": s.report_number,
            "customer_id": s.customer_id,
            "customer_name": customer.full_name if customer else "-",
            "case_id": s.case_id,
            "suspicious_activity_type": s.suspicious_activity_type,
            "total_amount": s.total_amount or 0,
            "filing_status": s.filing_status,
            "date_range_start": s.date_range_start.isoformat() if s.date_range_start else None,
            "date_range_end": s.date_range_end.isoformat() if s.date_range_end else None,
            "regulatory_reference": s.regulatory_reference,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            "filed_at": s.filed_at.isoformat() if s.filed_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/create")
def create_str(
    body: STRCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Step 1: Analyst creates STR from suspicious activity detection."""
    customer = db.query(Customer).filter(Customer.id == body.customer_id).first()
    if not customer:
        raise HTTPException(404, "Customer not found")

    report_number = f"STR-{datetime.utcnow().strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"

    sar = SARReport(
        id=str(uuid.uuid4()),
        report_number=report_number,
        case_id=body.case_id,
        customer_id=body.customer_id,
        suspicious_activity_type=body.suspicious_activity_type,
        narrative=body.narrative,
        total_amount=body.total_amount,
        date_range_start=date.fromisoformat(body.date_range_start),
        date_range_end=date.fromisoformat(body.date_range_end),
        filing_status="draft",
        regulatory_reference=f"PMLA Section 12; Rules 2005 Rule 7; Urgency: {body.urgency}",
    )
    db.add(sar)

    _log_str_activity(db, sar.id, current_user.id, "str_created",
                      f"STR {report_number} created for {customer.full_name} — {body.suspicious_activity_type}")
    db.commit()

    return {
        "id": sar.id,
        "report_number": report_number,
        "filing_status": "draft",
        "message": "STR created. Escalate to Principal Officer for review.",
    }


@router.post("/{str_id}/escalate-to-po")
def escalate_to_po(
    str_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Step 2: Analyst escalates STR to Principal Officer for review (PMLA Section 12(1))."""
    sar = db.query(SARReport).filter(SARReport.id == str_id).first()
    if not sar:
        raise HTTPException(404, "STR not found")

    valid_from = ["draft", "returned_for_revision"]
    if sar.filing_status not in valid_from:
        raise HTTPException(400, f"Cannot escalate from status '{sar.filing_status}'. Must be: {valid_from}")

    sar.filing_status = "escalated_to_po"
    sar.updated_at = datetime.utcnow()

    _log_str_activity(db, sar.id, current_user.id, "str_escalated_to_po",
                      f"STR {sar.report_number} escalated to Principal Officer by {current_user.full_name}")
    db.commit()

    return {"id": sar.id, "filing_status": "escalated_to_po", "message": "Escalated to Principal Officer. SLA: 48 hours for review."}


@router.post("/{str_id}/po-review")
def po_review(
    str_id: str,
    body: POReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Step 3: Principal Officer reviews and approves/rejects STR (PMLA Section 12(1)(a))."""
    sar = db.query(SARReport).filter(SARReport.id == str_id).first()
    if not sar:
        raise HTTPException(404, "STR not found")
    if sar.filing_status != "escalated_to_po":
        raise HTTPException(400, f"STR must be in 'escalated_to_po' status, currently '{sar.filing_status}'")

    if body.decision == "approve":
        sar.filing_status = "po_approved"
        msg = "Principal Officer approved. File with FIU-IND within 7 days (PMLA Rules 2005)."
    elif body.decision == "reject":
        sar.filing_status = "po_rejected"
        msg = "Principal Officer rejected STR. Analyst may revise and re-escalate."
    elif body.decision == "return_for_revision":
        sar.filing_status = "returned_for_revision"
        msg = "Returned to analyst for revision."
    else:
        raise HTTPException(400, "Decision must be: approve, reject, or return_for_revision")

    sar.updated_at = datetime.utcnow()

    _log_str_activity(db, sar.id, current_user.id, f"po_{body.decision}",
                      f"PO {body.decision}: {body.po_remarks} | Risk: {body.po_risk_assessment or 'N/A'}")
    db.commit()

    return {"id": sar.id, "filing_status": sar.filing_status, "message": msg}


@router.post("/{str_id}/file-with-fiu")
def file_with_fiu(
    str_id: str,
    body: FIUFilingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Step 4: File approved STR with FIU-IND (PMLA Rules 2005 Rule 7)."""
    sar = db.query(SARReport).filter(SARReport.id == str_id).first()
    if not sar:
        raise HTTPException(404, "STR not found")

    valid_from = ["po_approved", "amended"]
    if sar.filing_status not in valid_from:
        raise HTTPException(400, f"STR must be PO-approved or amended to file. Currently: '{sar.filing_status}'")

    sar.filing_status = "filed_with_fiu"
    sar.filed_by = current_user.id
    sar.filed_at = datetime.utcnow()
    sar.updated_at = datetime.utcnow()

    if body.fiu_acknowledgement_number:
        sar.filing_status = "fiu_acknowledged"
        sar.regulatory_reference = (sar.regulatory_reference or "") + f"; FIU Ack: {body.fiu_acknowledgement_number}"

    _log_str_activity(db, sar.id, current_user.id, "str_filed_fiu",
                      f"STR {sar.report_number} filed with FIU-IND. Ack: {body.fiu_acknowledgement_number or 'pending'}")
    db.commit()

    return {
        "id": sar.id,
        "filing_status": sar.filing_status,
        "filed_at": sar.filed_at.isoformat(),
        "message": "STR filed with FIU-IND successfully.",
    }


@router.post("/{str_id}/amend")
def amend_str(
    str_id: str,
    body: STRAmendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Amend a filed STR (within 7-day window per PMLA Rules)."""
    sar = db.query(SARReport).filter(SARReport.id == str_id).first()
    if not sar:
        raise HTTPException(404, "STR not found")

    if sar.filing_status not in ["filed_with_fiu", "fiu_acknowledged"]:
        raise HTTPException(400, "Only filed STRs can be amended")

    if sar.filed_at:
        days_since_filing = (datetime.utcnow() - sar.filed_at).days
        if days_since_filing > 7:
            raise HTTPException(400, f"Amendment window expired ({days_since_filing} days since filing). Max: 7 days per PMLA Rules.")

    if body.updated_narrative:
        sar.narrative = body.updated_narrative
    if body.updated_amount is not None:
        sar.total_amount = body.updated_amount

    sar.filing_status = "amended"
    sar.updated_at = datetime.utcnow()

    _log_str_activity(db, sar.id, current_user.id, "str_amended",
                      f"STR amended: {body.amendment_reason}")
    db.commit()

    return {"id": sar.id, "filing_status": "amended", "message": "STR amended. Re-file with FIU-IND."}


@router.get("/{str_id}")
def get_str_detail(
    str_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full STR detail with audit trail."""
    sar = db.query(SARReport).filter(SARReport.id == str_id).first()
    if not sar:
        raise HTTPException(404, "STR not found")

    customer = db.query(Customer).filter(Customer.id == sar.customer_id).first()

    # Audit trail for this STR
    audit_entries = (
        db.query(AuditLog)
        .filter(AuditLog.resource_type == "str_report", AuditLog.resource_id == sar.id)
        .order_by(AuditLog.created_at.desc())
        .all()
    )

    trail = []
    for entry in audit_entries:
        actor = db.query(User).filter(User.id == entry.user_id).first()
        trail.append({
            "action": entry.action,
            "details": entry.details,
            "actor": actor.full_name if actor else entry.user_id,
            "timestamp": entry.created_at.isoformat() if entry.created_at else None,
        })

    return {
        "id": sar.id,
        "report_number": sar.report_number,
        "customer_id": sar.customer_id,
        "customer_name": customer.full_name if customer else "-",
        "customer_risk_category": customer.risk_category if customer else None,
        "case_id": sar.case_id,
        "suspicious_activity_type": sar.suspicious_activity_type,
        "narrative": sar.narrative,
        "total_amount": sar.total_amount or 0,
        "date_range_start": sar.date_range_start.isoformat() if sar.date_range_start else None,
        "date_range_end": sar.date_range_end.isoformat() if sar.date_range_end else None,
        "filing_status": sar.filing_status,
        "regulatory_reference": sar.regulatory_reference,
        "filed_by": sar.filed_by,
        "filed_at": sar.filed_at.isoformat() if sar.filed_at else None,
        "created_at": sar.created_at.isoformat() if sar.created_at else None,
        "updated_at": sar.updated_at.isoformat() if sar.updated_at else None,
        "valid_transitions": VALID_TRANSITIONS.get(sar.filing_status, []),
        "audit_trail": trail,
        "pmla_references": {
            "section_12": "Obligation to furnish information of suspicious transactions",
            "section_12_1_a": "Principal Officer must furnish information to FIU Director",
            "rule_7": "STR must be filed within 7 days of suspicion being formed",
            "rule_8": "Records must be maintained for 5 years from date of transaction",
        },
    }


@router.get("/{str_id}/audit-trail")
def get_str_audit_trail(
    str_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Immutable audit trail for a specific STR — PMLA Section 12 compliance."""
    sar = db.query(SARReport).filter(SARReport.id == str_id).first()
    if not sar:
        raise HTTPException(404, "STR not found")

    entries = (
        db.query(AuditLog)
        .filter(AuditLog.resource_type == "str_report", AuditLog.resource_id == sar.id)
        .order_by(AuditLog.created_at.asc())
        .all()
    )

    trail = []
    for e in entries:
        actor = db.query(User).filter(User.id == e.user_id).first()
        trail.append({
            "action": e.action,
            "details": e.details,
            "actor": actor.full_name if actor else e.user_id,
            "timestamp": e.created_at.isoformat() if e.created_at else None,
            "ip_address": e.ip_address,
        })

    return {
        "str_id": sar.id,
        "report_number": sar.report_number,
        "entries": trail,
        "total": len(trail),
        "retention_policy": "5 years from transaction date per PMLA Rule 8",
    }
