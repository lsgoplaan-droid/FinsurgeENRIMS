"""Evidence and document upload API — attach PDFs, images, documents to alerts/cases."""
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from sqlalchemy.orm import Session
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Alert, Case, User
from app.models.evidence import Evidence, EvidenceType

router = APIRouter(prefix="/evidence", tags=["Evidence"])

# File upload configuration
UPLOAD_DIR = "uploads/evidence"
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png", "gif", "doc", "docx", "xls", "xlsx", "csv", "txt"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/jpeg", "image/png", "image/gif",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv", "text/plain"
}

# Create upload directory if it doesn't exist
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _get_evidence_type(mime_type: str) -> EvidenceType:
    """Determine evidence type from MIME type."""
    if mime_type.startswith("image/"):
        return EvidenceType.IMAGE
    elif mime_type == "application/pdf":
        return EvidenceType.DOCUMENT
    elif "word" in mime_type or "document" in mime_type:
        return EvidenceType.DOCUMENT
    elif "sheet" in mime_type or "excel" in mime_type or "csv" in mime_type:
        return EvidenceType.SPREADSHEET
    elif mime_type.startswith("audio/"):
        return EvidenceType.AUDIO
    elif mime_type.startswith("video/"):
        return EvidenceType.VIDEO
    return EvidenceType.OTHER


@router.post("/upload/alert/{alert_id}")
async def upload_evidence_for_alert(
    alert_id: str,
    file: UploadFile = File(...),
    description: str = Form(default=""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload evidence file for an alert."""
    # Validate alert exists
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Validate file
    if file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_FILE_SIZE / 1024 / 1024}MB")

    file_ext = file.filename.split(".")[-1].lower() if file.filename else ""
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"MIME type not allowed: {file.content_type}")

    # Save file
    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, f"alert_{alert_id}", safe_filename)
    os.makedirs(os.path.dirname(file_path), exist_ok=True)

    # Write file
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    # Create evidence record
    evidence = Evidence(
        id=file_id,
        alert_id=alert_id,
        file_name=file.filename,
        file_type=_get_evidence_type(file.content_type),
        mime_type=file.content_type,
        file_size=len(contents),
        file_path=file_path,
        description=description,
        uploaded_by=current_user.id,
        uploaded_by_name=current_user.full_name,
        ip_address=None,  # Could capture from request if needed
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    return {
        "id": evidence.id,
        "file_name": evidence.file_name,
        "file_type": evidence.file_type,
        "file_size": evidence.file_size,
        "uploaded_by": evidence.uploaded_by_name,
        "uploaded_at": evidence.uploaded_at.isoformat(),
        "description": evidence.description,
    }


@router.post("/upload/case/{case_id}")
async def upload_evidence_for_case(
    case_id: str,
    file: UploadFile = File(...),
    description: str = Form(default=""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload evidence file for a case."""
    # Validate case exists
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    # Validate file (same as alert)
    if file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Max {MAX_FILE_SIZE / 1024 / 1024}MB")

    file_ext = file.filename.split(".")[-1].lower() if file.filename else ""
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"MIME type not allowed: {file.content_type}")

    # Save file
    file_id = str(uuid.uuid4())
    safe_filename = f"{file_id}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, f"case_{case_id}", safe_filename)
    os.makedirs(os.path.dirname(file_path), exist_ok=True)

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    # Create evidence record
    evidence = Evidence(
        id=file_id,
        case_id=case_id,
        file_name=file.filename,
        file_type=_get_evidence_type(file.content_type),
        mime_type=file.content_type,
        file_size=len(contents),
        file_path=file_path,
        description=description,
        uploaded_by=current_user.id,
        uploaded_by_name=current_user.full_name,
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    return {
        "id": evidence.id,
        "file_name": evidence.file_name,
        "file_type": evidence.file_type,
        "file_size": evidence.file_size,
        "uploaded_by": evidence.uploaded_by_name,
        "uploaded_at": evidence.uploaded_at.isoformat(),
        "description": evidence.description,
    }


@router.get("/alert/{alert_id}")
def get_alert_evidence(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all evidence files for an alert."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    evidence_list = db.query(Evidence).filter(Evidence.alert_id == alert_id).all()
    return {
        "alert_id": alert_id,
        "total": len(evidence_list),
        "evidence": [
            {
                "id": e.id,
                "file_name": e.file_name,
                "file_type": e.file_type,
                "file_size": e.file_size,
                "description": e.description,
                "uploaded_by": e.uploaded_by_name,
                "uploaded_at": e.uploaded_at.isoformat(),
            }
            for e in evidence_list
        ],
    }


@router.get("/case/{case_id}")
def get_case_evidence(
    case_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all evidence files for a case."""
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    evidence_list = db.query(Evidence).filter(Evidence.case_id == case_id).all()
    return {
        "case_id": case_id,
        "total": len(evidence_list),
        "evidence": [
            {
                "id": e.id,
                "file_name": e.file_name,
                "file_type": e.file_type,
                "file_size": e.file_size,
                "description": e.description,
                "uploaded_by": e.uploaded_by_name,
                "uploaded_at": e.uploaded_at.isoformat(),
            }
            for e in evidence_list
        ],
    }


@router.delete("/evidence/{evidence_id}")
def delete_evidence(
    evidence_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an evidence file."""
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    # Delete file from disk
    if os.path.exists(evidence.file_path):
        os.remove(evidence.file_path)

    # Delete database record
    db.delete(evidence)
    db.commit()

    return {"status": "deleted", "evidence_id": evidence_id}
