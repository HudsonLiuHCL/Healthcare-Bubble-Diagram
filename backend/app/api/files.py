import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime
from uuid import UUID
from typing import List
from pathlib import Path

from ..database import get_db
from ..config import settings
from ..models.models import Project, UploadedFile, ProjectStatus
from ..schemas.schemas import UploadedFileOut

router = APIRouter(prefix="/projects/{project_id}/files", tags=["files"])

ALLOWED_TYPES = {
    ".dxf": "dxf",
    ".pdf": "pdf",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".xlsx": "spreadsheet",
    ".xls": "spreadsheet",
    ".csv": "spreadsheet",
    ".txt": "text",
    ".docx": "document",
}


@router.get("/", response_model=List[UploadedFileOut])
def list_files(project_id: UUID, db: Session = Depends(get_db)):
    return db.query(UploadedFile).filter(UploadedFile.project_id == project_id).all()


@router.post("/", response_model=UploadedFileOut)
async def upload_file(project_id: UUID, file: UploadFile = File(...), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"File type {ext} not supported")

    file_type = ALLOWED_TYPES[ext]
    stored_name = f"{uuid.uuid4()}{ext}"
    project_dir = Path(settings.upload_dir) / str(project_id)
    project_dir.mkdir(parents=True, exist_ok=True)
    file_path = project_dir / stored_name

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    parsed_data = _parse_file(file_path, file_type, content)

    record = UploadedFile(
        project_id=project_id,
        filename=stored_name,
        original_name=file.filename or stored_name,
        file_type=file_type,
        file_path=str(file_path),
        file_size=len(content),
        parsed_data=parsed_data,
    )
    db.add(record)

    if project.status == ProjectStatus.starting_path:
        project.status = ProjectStatus.upload_design
        project.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(record)
    return record


def _parse_file(file_path: Path, file_type: str, content: bytes) -> dict:
    """Best-effort parsing for each file type."""
    try:
        if file_type == "text":
            text = content.decode("utf-8", errors="ignore")
            return {"text": text[:5000], "char_count": len(text)}

        if file_type == "spreadsheet" and str(file_path).endswith(".csv"):
            text = content.decode("utf-8", errors="ignore")
            lines = text.strip().split("\n")
            return {"rows": len(lines), "preview": lines[:5], "raw": text[:3000]}

        if file_type == "dxf":
            try:
                import ezdxf
                doc = ezdxf.read(str(file_path))
                msp = doc.modelspace()
                entities = [e.dxftype() for e in msp]
                from collections import Counter
                counts = dict(Counter(entities))
                return {"entity_types": counts, "layer_count": len(doc.layers), "status": "parsed"}
            except Exception as e:
                return {"status": "stored", "note": f"DXF parse skipped: {str(e)[:100]}"}

        if file_type == "pdf":
            try:
                import pdfplumber
                with pdfplumber.open(str(file_path)) as pdf:
                    text = ""
                    for page in pdf.pages[:5]:
                        text += page.extract_text() or ""
                return {"page_count": len(pdf.pages), "text_preview": text[:3000]}
            except Exception as e:
                return {"status": "stored", "note": f"PDF parse skipped: {str(e)[:100]}"}

    except Exception:
        pass

    return {"status": "stored"}
