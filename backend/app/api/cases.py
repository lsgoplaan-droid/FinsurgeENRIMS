import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Case, CaseActivity, CaseEvidence as CaseEvidenceModel, Customer, User, Alert, case_alerts
from app.schemas.case import CaseResponse, CaseCreate, CaseAssign, CaseEscalate, CaseDisposition, CaseStatusUpdate, CaseUpdate, CaseStats

router = APIRouter(prefix="/cases", tags=["Cases"])


def _case_response(c: Case, db: Session) -> CaseResponse:
    customer = db.query(Customer).filter(Customer.id == c.customer_id).first()
    assignee = db.query(User).filter(User.id == c.assigned_to).first() if c.assigned_to else None
    alert_count = db.query(func.count(case_alerts.c.alert_id)).filter(case_alerts.c.case_id == c.id).scalar() or 0
    evidence_count = db.query(func.count(CaseEvidenceModel.id)).filter(CaseEvidenceModel.case_id == c.id).scalar() or 0

    return CaseResponse(
        id=c.id,
        case_number=c.case_number,
        title=c.title,
        description=c.description,
        case_type=c.case_type,
        priority=c.priority,
        status=c.status,
        customer_id=c.customer_id,
        customer_name=customer.full_name if customer else "",
        assigned_to=c.assigned_to,
        assignee_name=assignee.full_name if assignee else None,
        assigned_at=c.assigned_at,
        escalated_to=c.escalated_to,
        escalation_reason=c.escalation_reason,
        sla_due_at=c.sla_due_at,
        is_overdue=c.is_overdue or False,
        disposition=c.disposition,
        disposition_notes=c.disposition_notes,
        total_suspicious_amount=c.total_suspicious_amount or 0,
        regulatory_filed=c.regulatory_filed or False,
        alert_count=alert_count,
        evidence_count=evidence_count,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


@router.get("")
def list_cases(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    priority: str = Query(None),
    case_type: str = Query(None),
    assigned_to: str = Query(None),
    customer_id: str = Query(None),
    search: str = Query(None),
    date: str = Query(None, description="today | yesterday | week | YYYY-MM-DD"),
    min_amount: float = Query(None, description="Minimum suspicious amount in paise"),
    max_amount: float = Query(None, description="Maximum suspicious amount in paise"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Case)

    if status:
        if status == "closed":
            query = query.filter(Case.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]))
        elif status == "open":
            # All non-closed statuses — matches the dashboard "open" count semantics
            query = query.filter(~Case.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]))
        elif "," in status:
            statuses = [s.strip() for s in status.split(",") if s.strip()]
            query = query.filter(Case.status.in_(statuses))
        else:
            query = query.filter(Case.status == status)
    if priority:
        query = query.filter(Case.priority == priority)
    if case_type:
        query = query.filter(Case.case_type == case_type)
    if assigned_to:
        if assigned_to == "me":
            query = query.filter(Case.assigned_to == current_user.id)
        else:
            query = query.filter(Case.assigned_to == assigned_to)
    if customer_id:
        query = query.filter(Case.customer_id == customer_id)
    if search:
        # Search by title, case_number, or customer name (first/last/company/cif)
        cust_ids_subq = db.query(Customer.id).filter(or_(
            Customer.first_name.ilike(f"%{search}%"),
            Customer.last_name.ilike(f"%{search}%"),
            Customer.company_name.ilike(f"%{search}%"),
            Customer.customer_number.ilike(f"%{search}%"),
        ))
        query = query.filter(or_(
            Case.title.ilike(f"%{search}%"),
            Case.case_number.ilike(f"%{search}%"),
            Case.customer_id.in_(cust_ids_subq),
        ))

    # Date filter — semantic values + ISO date
    if date:
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        if date == "today":
            query = query.filter(Case.created_at >= today_start)
        elif date == "yesterday":
            y_start = today_start - timedelta(days=1)
            query = query.filter(Case.created_at >= y_start, Case.created_at < today_start)
        elif date == "week":
            query = query.filter(Case.created_at >= today_start - timedelta(days=7))
        else:
            try:
                d = datetime.fromisoformat(date)
                query = query.filter(Case.created_at >= d, Case.created_at < d + timedelta(days=1))
            except ValueError:
                pass

    if min_amount is not None:
        query = query.filter(Case.total_suspicious_amount >= min_amount)
    if max_amount is not None:
        query = query.filter(Case.total_suspicious_amount <= max_amount)

    total = query.count()
    cases = query.order_by(Case.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [_case_response(c, db) for c in cases],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/stats")
def get_case_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    total = db.query(func.count(Case.id)).scalar() or 0
    open_count = db.query(func.count(Case.id)).filter(Case.status == "open").scalar() or 0
    investigating = db.query(func.count(Case.id)).filter(Case.status == "under_investigation").scalar() or 0
    escalated = db.query(func.count(Case.id)).filter(Case.status == "escalated").scalar() or 0
    pending_reg = db.query(func.count(Case.id)).filter(Case.status == "pending_regulatory").scalar() or 0
    closed = db.query(func.count(Case.id)).filter(Case.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"])).scalar() or 0
    overdue = db.query(func.count(Case.id)).filter(Case.is_overdue == True).scalar() or 0

    by_type = dict(db.query(Case.case_type, func.count(Case.id)).group_by(Case.case_type).all())
    by_priority = dict(db.query(Case.priority, func.count(Case.id)).group_by(Case.priority).all())

    return CaseStats(total=total, open=open_count, under_investigation=investigating, escalated=escalated, pending_regulatory=pending_reg, closed=closed, by_type=by_type, by_priority=by_priority, overdue=overdue)


@router.post("", response_model=CaseResponse)
def create_case(body: CaseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    case_num = f"CSE-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}"
    case = Case(
        case_number=case_num,
        title=body.title,
        description=body.description,
        case_type=body.case_type,
        priority=body.priority,
        customer_id=body.customer_id,
    )
    db.add(case)
    db.flush()

    for alert_id in body.alert_ids:
        db.execute(case_alerts.insert().values(case_id=case.id, alert_id=alert_id))
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        if alert:
            alert.case_id = case.id

    activity = CaseActivity(case_id=case.id, user_id=current_user.id, activity_type="created", description=f"Case created: {body.title}")
    db.add(activity)
    db.commit()
    db.refresh(case)

    return _case_response(case, db)


@router.get("/{case_id}")
def get_case(case_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    return _case_response(c, db)


@router.get("/{case_id}/timeline")
def get_case_timeline(case_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    activities = db.query(CaseActivity).filter(CaseActivity.case_id == case_id).order_by(CaseActivity.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "activity_type": a.activity_type,
            "description": a.description,
            "user_name": db.query(User).filter(User.id == a.user_id).first().full_name if a.user_id else "System",
            "old_value": a.old_value,
            "new_value": a.new_value,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in activities
    ]


@router.get("/{case_id}/alerts")
def get_case_alerts(case_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    alert_ids = [row.alert_id for row in db.query(case_alerts.c.alert_id).filter(case_alerts.c.case_id == case_id).all()]
    alerts = db.query(Alert).filter(Alert.id.in_(alert_ids)).all()
    customer_cache = {}
    result = []
    for a in alerts:
        if a.customer_id not in customer_cache:
            customer_cache[a.customer_id] = db.query(Customer).filter(Customer.id == a.customer_id).first()
        c = customer_cache[a.customer_id]
        result.append({
            "id": a.id, "alert_number": a.alert_number, "title": a.title,
            "alert_type": a.alert_type, "priority": a.priority, "status": a.status,
            "risk_score": a.risk_score, "customer_name": c.full_name if c else "",
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    return result


VALID_STATUS_TRANSITIONS = {
    "open": ["under_investigation", "assigned", "escalated"],
    "assigned": ["under_investigation", "escalated"],
    "under_investigation": ["pending_regulatory", "escalated", "closed_true_positive", "closed_false_positive", "closed_inconclusive"],
    "escalated": ["under_investigation", "pending_regulatory"],
    "pending_regulatory": ["under_investigation", "closed_true_positive", "closed_false_positive", "closed_inconclusive"],
}


@router.patch("/{case_id}/status")
def update_case_status(case_id: str, body: CaseStatusUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    allowed = VALID_STATUS_TRANSITIONS.get(c.status, [])
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Cannot transition from '{c.status}' to '{body.status}'")
    old_status = c.status
    c.status = body.status
    activity = CaseActivity(case_id=case_id, user_id=current_user.id, activity_type="status_changed", description=body.notes or f"Status changed to {body.status}", old_value=old_status, new_value=body.status)
    db.add(activity)
    db.commit()
    db.refresh(c)
    return _case_response(c, db)


@router.put("/{case_id}")
def update_case(case_id: str, body: CaseUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    changes = []
    for field in ["title", "description", "priority", "findings", "recommendation"]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(c, field, val)
            changes.append(field)
    if changes:
        activity = CaseActivity(case_id=case_id, user_id=current_user.id, activity_type="updated", description=f"Updated: {', '.join(changes)}")
        db.add(activity)
    db.commit()
    db.refresh(c)
    return _case_response(c, db)


@router.post("/{case_id}/assign")
def assign_case(case_id: str, body: CaseAssign, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    old = c.assigned_to
    c.assigned_to = body.assigned_to
    c.assigned_at = datetime.utcnow()
    c.status = "assigned"
    activity = CaseActivity(case_id=case_id, user_id=current_user.id, activity_type="assigned", description="Case assigned", old_value=old, new_value=body.assigned_to)
    db.add(activity)
    db.commit()
    db.refresh(c)
    return _case_response(c, db)


@router.post("/{case_id}/escalate")
def escalate_case(case_id: str, body: CaseEscalate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    c.escalated_to = body.escalated_to
    c.escalated_at = datetime.utcnow()
    c.escalation_reason = body.reason
    c.status = "escalated"
    activity = CaseActivity(case_id=case_id, user_id=current_user.id, activity_type="escalated", description=f"Case escalated: {body.reason}")
    db.add(activity)
    db.commit()
    db.refresh(c)
    return _case_response(c, db)


@router.post("/{case_id}/disposition")
def set_disposition(case_id: str, body: CaseDisposition, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    c = db.query(Case).filter(Case.id == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    c.disposition = body.disposition
    c.disposition_notes = body.notes
    status_map = {"true_positive": "closed_true_positive", "false_positive": "closed_false_positive", "inconclusive": "closed_inconclusive"}
    c.status = status_map.get(body.disposition, "closed_inconclusive")
    c.closed_by = current_user.id
    c.closed_at = datetime.utcnow()
    activity = CaseActivity(case_id=case_id, user_id=current_user.id, activity_type="disposition_set", description=f"Disposition: {body.disposition}", new_value=body.disposition)
    db.add(activity)
    db.commit()
    db.refresh(c)
    return _case_response(c, db)
