import json
from difflib import SequenceMatcher
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.dependencies import get_current_user
from app.models import WatchlistEntry, User

router = APIRouter(prefix="/watchlists", tags=["Watchlists"])


@router.get("")
def list_watchlist(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source: str = Query(None),
    entry_type: str = Query(None),
    search: str = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(WatchlistEntry).filter(WatchlistEntry.is_active == True)
    if source:
        query = query.filter(WatchlistEntry.list_source == source)
    if entry_type:
        query = query.filter(WatchlistEntry.entry_type == entry_type)
    if search:
        query = query.filter(WatchlistEntry.full_name.ilike(f"%{search}%"))

    total = query.count()
    entries = query.order_by(WatchlistEntry.full_name).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "items": [
            {
                "id": e.id,
                "list_source": e.list_source,
                "entry_type": e.entry_type,
                "full_name": e.full_name,
                "aliases": json.loads(e.aliases) if e.aliases else [],
                "nationality": e.nationality,
                "country": e.country,
                "reason": e.reason,
                "listed_date": str(e.listed_date) if e.listed_date else None,
                "is_active": e.is_active,
            }
            for e in entries
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/search")
def search_watchlist(
    name: str = Query(...),
    threshold: float = Query(0.75),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entries = db.query(WatchlistEntry).filter(WatchlistEntry.is_active == True).all()
    matches = []
    name_lower = name.lower()

    for e in entries:
        score = SequenceMatcher(None, name_lower, e.full_name.lower()).ratio()
        if score >= threshold:
            matches.append({
                "id": e.id,
                "full_name": e.full_name,
                "list_source": e.list_source,
                "match_score": round(score * 100, 1),
                "nationality": e.nationality,
                "reason": e.reason,
            })

        if e.aliases:
            for alias in json.loads(e.aliases):
                alias_score = SequenceMatcher(None, name_lower, alias.lower()).ratio()
                if alias_score >= threshold:
                    matches.append({
                        "id": e.id,
                        "full_name": e.full_name,
                        "matched_alias": alias,
                        "list_source": e.list_source,
                        "match_score": round(alias_score * 100, 1),
                        "nationality": e.nationality,
                        "reason": e.reason,
                    })

    matches.sort(key=lambda x: x["match_score"], reverse=True)
    return {"query": name, "matches": matches[:20], "total_matches": len(matches)}


@router.get("/stats")
def watchlist_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    by_source = dict(
        db.query(WatchlistEntry.list_source, func.count(WatchlistEntry.id))
        .filter(WatchlistEntry.is_active == True)
        .group_by(WatchlistEntry.list_source)
        .all()
    )
    total = db.query(func.count(WatchlistEntry.id)).filter(WatchlistEntry.is_active == True).scalar() or 0
    return {"total": total, "by_source": by_source}
