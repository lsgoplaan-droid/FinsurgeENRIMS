from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Customer, CustomerRelationship, CustomerLink, Transaction, User

router = APIRouter(prefix="/network", tags=["Network Analysis"])


@router.get("/{customer_id}/graph")
def get_network_graph(
    customer_id: str,
    depth: int = Query(1, ge=1, le=3),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    visited = set()
    nodes = []
    edges = []
    center_id = customer_id

    def explore(cid: str, current_depth: int):
        if cid in visited or current_depth > depth + 1:
            return
        visited.add(cid)

        customer = db.query(Customer).filter(Customer.id == cid).first()
        if not customer:
            return

        nodes.append({
            "id": customer.id,
            "name": customer.full_name,
            "label": customer.full_name,
            "customer_number": customer.customer_number,
            "risk_category": customer.risk_category,
            "risk_score": customer.risk_score or 0,
            "customer_type": customer.customer_type,
            "pep_status": customer.pep_status or False,
            "is_center": cid == center_id,
        })

        relationships = db.query(CustomerRelationship).filter(
            or_(CustomerRelationship.customer_id_1 == cid, CustomerRelationship.customer_id_2 == cid)
        ).all()

        for rel in relationships:
            other_id = rel.customer_id_2 if rel.customer_id_1 == cid else rel.customer_id_1
            edges.append({
                "source": cid,
                "target": other_id,
                "type": "relationship",
                "relationship": rel.relationship_type,
                "label": rel.relationship_type,
                "strength": rel.strength or 0.5,
            })
            explore(other_id, current_depth + 1)

        links = db.query(CustomerLink).filter(
            or_(CustomerLink.customer_id_1 == cid, CustomerLink.customer_id_2 == cid)
        ).all()

        for link in links:
            other_id = link.customer_id_2 if link.customer_id_1 == cid else link.customer_id_1
            edges.append({
                "source": cid,
                "target": other_id,
                "type": "link",
                "relationship": link.link_type,
                "label": link.link_type,
                "detail": link.link_detail,
            })
            if other_id not in visited:
                explore(other_id, current_depth + 1)

    explore(customer_id, 0)

    center = next((n for n in nodes if n["id"] == customer_id), None)
    return {"nodes": nodes, "edges": edges, "center": center}


@router.get("/{customer_id}/fund-flow")
def get_fund_flow(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    outgoing = (
        db.query(
            Transaction.counterparty_name,
            Transaction.counterparty_account,
            func.count(Transaction.id).label("count"),
            func.sum(Transaction.amount).label("total"),
        )
        .filter(Transaction.customer_id == customer_id, Transaction.transaction_type == "debit")
        .filter(Transaction.counterparty_name.isnot(None))
        .group_by(Transaction.counterparty_name, Transaction.counterparty_account)
        .all()
    )

    incoming = (
        db.query(
            Transaction.counterparty_name,
            Transaction.counterparty_account,
            func.count(Transaction.id).label("count"),
            func.sum(Transaction.amount).label("total"),
        )
        .filter(Transaction.customer_id == customer_id, Transaction.transaction_type == "credit")
        .filter(Transaction.counterparty_name.isnot(None))
        .group_by(Transaction.counterparty_name, Transaction.counterparty_account)
        .all()
    )

    return {
        "outgoing": [
            {"name": o[0], "account": o[1], "transaction_count": o[2], "total_amount": o[3]}
            for o in outgoing
        ],
        "incoming": [
            {"name": i[0], "account": i[1], "transaction_count": i[2], "total_amount": i[3]}
            for i in incoming
        ],
    }
