from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from ..database import get_db
from ..models.models import SiteIntelligence
from ..schemas.schemas import IntelligenceOut

router = APIRouter(prefix="/projects/{project_id}/intelligence", tags=["intelligence"])


@router.get("/", response_model=IntelligenceOut)
def get_intelligence(project_id: UUID, db: Session = Depends(get_db)):
    intel = db.query(SiteIntelligence).filter(SiteIntelligence.project_id == project_id).first()
    if not intel:
        raise HTTPException(status_code=404, detail="Intelligence not found")
    return intel
