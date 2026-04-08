import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Date, Text
from app.database import Base


class WatchlistEntry(Base):
    __tablename__ = "watchlist_entries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    list_source = Column(String, nullable=False, index=True)  # ofac_sdn, un_consolidated, eu_sanctions, india_mha, internal_blacklist, pep_list
    entry_type = Column(String, nullable=False)  # individual, entity, vessel
    full_name = Column(String, nullable=False, index=True)
    aliases = Column(Text)  # JSON array
    date_of_birth = Column(Date)
    nationality = Column(String)
    country = Column(String)
    identification_numbers = Column(Text)  # JSON
    reason = Column(String)
    listed_date = Column(Date)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
