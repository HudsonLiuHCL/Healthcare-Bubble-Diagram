from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from uuid import UUID

from ..database import get_db
from ..models.models import Project, Site, SiteIntelligence, BubbleDiagram, UploadedFile
from ..schemas.schemas import ProjectCreate, ProjectUpdate, ProjectOut, ProjectExport, SiteOut, IntelligenceOut, BubbleDiagramOut, UploadedFileOut

router = APIRouter(prefix="/projects", tags=["projects"])


def site_to_out(site) -> "Optional[SiteOut]":
    if not site:
        return None
    geojson = None
    if site.parcel_polygon is not None:
        try:
            from geoalchemy2.shape import to_shape
            shape = to_shape(site.parcel_polygon)
            geojson = shape.__geo_interface__
        except Exception:
            pass
    return SiteOut(
        id=site.id,
        project_id=site.project_id,
        address=site.address,
        lat=site.lat,
        lng=site.lng,
        parcel_geojson=geojson,
        lot_area_sqm=site.lot_area_sqm,
        created_at=site.created_at,
    )


@router.get("/", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.created_at.desc()).all()


@router.post("/", response_model=ProjectOut)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(name=data.name)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: UUID, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: UUID, data: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    project.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}")
def delete_project(project_id: UUID, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"ok": True}


@router.get("/{project_id}/export")
def export_project(project_id: UUID, db: Session = Depends(get_db)):
    """Export full project data as JSON for Revit integration."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    site = db.query(Site).filter(Site.project_id == project_id).first()
    intel = db.query(SiteIntelligence).filter(SiteIntelligence.project_id == project_id).first()
    bubble = (
        db.query(BubbleDiagram)
        .filter(BubbleDiagram.project_id == project_id, BubbleDiagram.status == "approved")
        .order_by(BubbleDiagram.version.desc())
        .first()
    )
    files = db.query(UploadedFile).filter(UploadedFile.project_id == project_id).all()

    export = {
        "healtharch_version": "1.0",
        "exported_at": datetime.utcnow().isoformat(),
        "project": {
            "id": str(project.id),
            "name": project.name,
            "status": project.status,
            "starting_mode": project.starting_mode,
            "created_at": project.created_at.isoformat(),
        },
        "site": None,
        "site_intelligence": None,
        "bubble_diagram": None,
        "uploaded_files": [],
    }

    if site:
        geojson = None
        if site.parcel_polygon is not None:
            try:
                from geoalchemy2.shape import to_shape
                shape = to_shape(site.parcel_polygon)
                geojson = shape.__geo_interface__
            except Exception:
                pass
        export["site"] = {
            "address": site.address,
            "coordinates": {"lat": site.lat, "lng": site.lng},
            "parcel_geojson": geojson,
            "lot_area_sqm": site.lot_area_sqm,
        }

    if intel and intel.status == "completed":
        export["site_intelligence"] = {
            "zoning": intel.zoning,
            "building_restrictions": intel.building_restrictions,
            "environmental": intel.environmental,
            "healthcare_constraints": intel.healthcare_constraints,
        }

    if bubble:
        export["bubble_diagram"] = {
            "version": bubble.version,
            "program": bubble.program_data,
            "nodes": bubble.nodes,
            "edges": bubble.edges,
            "requirements": bubble.requirements_text,
        }

    for f in files:
        export["uploaded_files"].append({
            "filename": f.original_name,
            "type": f.file_type,
            "parsed_data": f.parsed_data,
        })

    return JSONResponse(content=export)
