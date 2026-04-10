"""Evidence and investigation assets — documents, screenshots, PDFs linked to alerts/cases."""
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Float, Enum as SQLEnum
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class EvidenceType(str, enum.Enum):
    """Supported evidence file types."""
    DOCUMENT = "document"      # PDF, Word, Excel
    IMAGE = "image"            # JPG, PNG, screenshot
    VIDEO = "video"            # MP4, MOV
    AUDIO = "audio"            # MP3, WAV
    SPREADSHEET = "spreadsheet"  # CSV, Excel
    OTHER = "other"


class Evidence(Base):
    """File evidence attached to alerts or cases."""
    __tablename__ = "evidence"

    id = Column(String, primary_key=True)
    alert_id = Column(String, nullable=True)  # FK to Alert.id (optional, if for alert)
    case_id = Column(String, nullable=True)   # FK to Case.id (optional, if for case)

    # File metadata
    file_name = Column(String, nullable=False)  # Original filename: "Screenshot_2026-04-10.jpg"
    file_type = Column(SQLEnum(EvidenceType), default=EvidenceType.DOCUMENT)
    mime_type = Column(String)  # "image/jpeg", "application/pdf", etc.
    file_size = Column(Integer)  # Size in bytes

    # Storage location
    file_path = Column(String, nullable=False)  # Server path or S3 key: "alerts/alert_123/evidence_abc.jpg"
    file_url = Column(String)  # Publicly accessible URL for download

    # Description and classification
    description = Column(String)  # "Bank statement showing irregular deposits"
    uploaded_by = Column(String)  # User ID who uploaded
    uploaded_by_name = Column(String)  # User full name

    # Timestamps
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Audit
    ip_address = Column(String)  # IP of uploader for audit trail

    def __repr__(self):
        return f"<Evidence {self.id}: {self.file_name} for {'alert' if self.alert_id else 'case'} {self.alert_id or self.case_id}>"
