from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from uuid import UUID

from ..database import get_db, SessionLocal
from ..models.models import Project, Site, SiteIntelligence, IntelligenceStatus, ProjectStatus
from ..schemas.schemas import SiteCreate, SiteOut
from ..services.intelligence import trigger_intelligence

router = APIRouter(prefix="/projects/{project_id}/site", tags=["sites"])


def _site_to_out(site: Site) -> SiteOut:
    geojson = None
    if site.parcel_polygon is not None:
        try:
            from geoalchemy2.shape import to_shape
            geojson = to_shape(site.parcel_polygon).__geo_interface__
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


@router.get("/", response_model=SiteOut)
def get_site(project_id: UUID, db: Session = Depends(get_db)):
    site = db.query(Site).filter(Site.project_id == project_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return _site_to_out(site)


@router.post("/confirm", response_model=SiteOut)
def confirm_site(project_id: UUID, data: SiteCreate, db: Session = Depends(get_db)):
    """Save site and trigger background intelligence analysis."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Upsert site
    site = db.query(Site).filter(Site.project_id == project_id).first()
    if not site:
        site = Site(project_id=project_id)
        db.add(site)

    site.address = data.address
    site.lat = data.lat
    site.lng = data.lng
    site.lot_area_sqm = data.lot_area_sqm
    site.updated_at = datetime.utcnow()

    if data.parcel_geojson:
        try:
            from geoalchemy2.shape import from_shape
            from shapely.geometry import shape as shapely_shape
            geom = shapely_shape(data.parcel_geojson)
            site.parcel_polygon = from_shape(geom, srid=4326)
        except Exception as e:
            pass

    # Advance project status
    project.status = ProjectStatus.starting_path
    project.updated_at = datetime.utcnow()

    # Create intelligence record
    intel = db.query(SiteIntelligence).filter(SiteIntelligence.project_id == project_id).first()
    if not intel:
        intel = SiteIntelligence(project_id=project_id, status=IntelligenceStatus.pending)
        db.add(intel)

    db.commit()
    db.refresh(site)

    # Fire background analysis
    trigger_intelligence(
        str(project_id),
        data.address or "",
        data.lat or 0.0,
        data.lng or 0.0,
        data.lot_area_sqm or 0.0,
        SessionLocal,
    )

    return _site_to_out(site)
