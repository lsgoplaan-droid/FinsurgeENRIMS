from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Alert, AlertNote as AlertNoteModel, Customer, User, Case, case_alerts
from app.schemas.alert import AlertResponse, AlertAssign, AlertClose, AlertNote as AlertNoteSchema, AlertStats

router = APIRouter(prefix="/alerts", tags=["Alerts"])


def _alert_response(a: Alert, db: Session) -> AlertResponse:
    customer = db.query(Customer).filter(Customer.id == a.customer_id).first()
    assignee = db.query(User).filter(User.id == a.assigned_to).first() if a.assigned_to else None
    notes = [
        {"id": n.id, "note": n.note, "user_name": db.query(User).filter(User.id == n.user_id).first().full_name if n.user_id else "", "created_at": n.created_at.isoformat() if n.created_at else None}
        for n in (a.notes or [])
    ]
    rule_name = a.rule.name if a.rule else None
    return AlertResponse(
        id=a.id,
        alert_number=a.alert_number,
        rule_id=a.rule_id,
        rule_name=rule_name,
        customer_id=a.customer_id,
        customer_name=customer.full_name if customer else "",
        account_id=a.account_id,
        transaction_id=a.transaction_id,
        alert_type=a.alert_type,
        priority=a.priority,
        risk_score=a.risk_score or 0,
        status=a.status,
        title=a.title,
        description=a.description,
        details=a.details,
        assigned_to=a.assigned_to,
        assignee_name=assignee.full_name if assignee else None,
        assigned_at=a.assigned_at,
        sla_due_at=a.sla_due_at,
        is_overdue=a.is_overdue or False,
        case_id=a.case_id,
        closure_reason=a.closure_reason,
        closed_at=a.closed_at,
        notes=notes,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )


@router.get("")
def list_alerts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str = Query(None),
    priority: str = Query(None),
    alert_type: str = Query(None),
    assigned_to: str = Query(None),
    customer_id: str = Query(None),
    is_overdue: bool = Query(None),
    search: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Alert)

    if status:
        if status == "closed":
            query = query.filter(Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"]))
        elif "," in status:
            statuses = [s.strip() for s in status.split(",") if s.strip()]
            query = query.filter(Alert.status.in_(statuses))
        else:
            query = query.filter(Alert.status == status)
    if priority:
        query = query.filter(Alert.priority == priority)
    if alert_type:
        query = query.filter(Alert.alert_type == alert_type)
    if assigned_to:
        if assigned_to == "me":
            query = query.filter(Alert.assigned_to == current_user.id)
        else:
            query = query.filter(Alert.assigned_to == assigned_to)
    if customer_id:
        query = query.filter(Alert.customer_id == customer_id)
    if is_overdue is not None:
        query = query.filter(Alert.is_overdue == is_overdue)
    if search:
        query = query.filter(Alert.title.ilike(f"%{search}%"))

    total = query.count()
    alerts = query.order_by(Alert.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [_alert_response(a, db) for a in alerts],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/stats")
def get_alert_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    total = db.query(func.count(Alert.id)).scalar() or 0
    new = db.query(func.count(Alert.id)).filter(Alert.status == "new").scalar() or 0
    assigned = db.query(func.count(Alert.id)).filter(Alert.status == "assigned").scalar() or 0
    under_review = db.query(func.count(Alert.id)).filter(Alert.status == "under_review").scalar() or 0
    escalated = db.query(func.count(Alert.id)).filter(Alert.status == "escalated").scalar() or 0
    closed = db.query(func.count(Alert.id)).filter(Alert.status.in_(["closed_true_positive", "closed_false_positive", "closed_inconclusive"])).scalar() or 0
    overdue = db.query(func.count(Alert.id)).filter(Alert.is_overdue == True).scalar() or 0

    by_priority = dict(db.query(Alert.priority, func.count(Alert.id)).group_by(Alert.priority).all())
    by_type = dict(db.query(Alert.alert_type, func.count(Alert.id)).group_by(Alert.alert_type).all())

    return AlertStats(total=total, new=new, assigned=assigned, under_review=under_review, escalated=escalated, closed=closed, by_priority=by_priority, by_type=by_type, overdue=overdue)


@router.get("/{alert_id}")
def get_alert(alert_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")
    return _alert_response(a, db)


@router.post("/{alert_id}/assign")
def assign_alert(alert_id: str, body: AlertAssign, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")
    a.assigned_to = body.assigned_to
    a.assigned_at = datetime.utcnow()
    a.status = "assigned"
    db.commit()
    db.refresh(a)
    return _alert_response(a, db)


@router.post("/{alert_id}/escalate")
def escalate_alert(alert_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")
    a.status = "escalated"
    db.commit()
    db.refresh(a)
    return _alert_response(a, db)


@router.post("/{alert_id}/close")
def close_alert(alert_id: str, body: AlertClose, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")
    status_map = {"true_positive": "closed_true_positive", "false_positive": "closed_false_positive", "inconclusive": "closed_inconclusive"}
    a.status = status_map.get(body.disposition, "closed_inconclusive")
    a.closure_reason = body.reason
    a.closed_by = current_user.id
    a.closed_at = datetime.utcnow()
    db.commit()
    db.refresh(a)
    return _alert_response(a, db)


@router.post("/{alert_id}/add-note")
def add_note(alert_id: str, body: AlertNoteSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")
    note = AlertNoteModel(alert_id=alert_id, user_id=current_user.id, note=body.note)
    db.add(note)
    db.commit()
    db.refresh(a)
    return _alert_response(a, db)


@router.post("/{alert_id}/promote-to-case")
def promote_to_case(alert_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found")

    import uuid
    case_num = f"CSE-{datetime.utcnow().strftime('%Y%m%d')}-{str(uuid.uuid4())[:4].upper()}"
    case = Case(
        case_number=case_num,
        title=f"Investigation: {a.title}",
        description=a.description,
        case_type=f"{a.alert_type}_investigation",
        priority=a.priority,
        customer_id=a.customer_id,
        assigned_to=a.assigned_to,
        total_suspicious_amount=0,
    )
    db.add(case)
    db.flush()

    a.case_id = case.id
    a.status = "under_review"
    db.execute(case_alerts.insert().values(case_id=case.id, alert_id=a.id))
    db.commit()

    return {"case_id": case.id, "case_number": case.case_number}
