from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from uuid import UUID
from typing import List

from ..database import get_db
from ..models.models import Project, BubbleDiagram, SiteIntelligence, BubbleStatus, ProjectStatus
from ..schemas.schemas import BubbleDiagramCreate, BubbleDiagramUpdate, BubbleDiagramOut
from ..services.bubble_ai import generate_bubble_diagram

router = APIRouter(prefix="/projects/{project_id}/bubble", tags=["bubble"])


@router.get("/", response_model=List[BubbleDiagramOut])
def list_bubbles(project_id: UUID, db: Session = Depends(get_db)):
    return (
        db.query(BubbleDiagram)
        .filter(BubbleDiagram.project_id == project_id)
        .order_by(BubbleDiagram.version.desc())
        .all()
    )


@router.post("/generate", response_model=BubbleDiagramOut)
def generate(project_id: UUID, data: BubbleDiagramCreate, db: Session = Depends(get_db)):
    """Generate a new bubble diagram from requirements text using AI."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Gather site context if available
    intel = db.query(SiteIntelligence).filter(SiteIntelligence.project_id == project_id).first()
    site_context = None
    if intel and intel.status == "completed":
        site_context = {
            "zoning": intel.zoning,
            "building_restrictions": intel.building_restrictions,
            "healthcare_constraints": intel.healthcare_constraints,
        }

    result = generate_bubble_diagram(data.requirements_text, site_context)

    # Increment version
    latest = (
        db.query(BubbleDiagram)
        .filter(BubbleDiagram.project_id == project_id)
        .order_by(BubbleDiagram.version.desc())
        .first()
    )
    version = (latest.version + 1) if latest else 1

    bubble = BubbleDiagram(
        project_id=project_id,
        version=version,
        nodes=result["nodes"],
        edges=result["edges"],
        requirements_text=data.requirements_text,
        program_data=result["program"],
        status=BubbleStatus.draft,
    )
    db.add(bubble)

    project.status = ProjectStatus.bubble_diagram
    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(bubble)
    return bubble


@router.patch("/{bubble_id}", response_model=BubbleDiagramOut)
def update_bubble(project_id: UUID, bubble_id: UUID, data: BubbleDiagramUpdate, db: Session = Depends(get_db)):
    bubble = db.query(BubbleDiagram).filter(
        BubbleDiagram.id == bubble_id,
        BubbleDiagram.project_id == project_id,
    ).first()
    if not bubble:
        raise HTTPException(status_code=404, detail="Bubble diagram not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(bubble, field, value)
    bubble.updated_at = datetime.utcnow()

    if data.status == "approved":
        db.query(Project).filter(Project.id == project_id).update(
            {"status": ProjectStatus.design_editor, "updated_at": datetime.utcnow()}
        )

    db.commit()
    db.refresh(bubble)
    return bubble
