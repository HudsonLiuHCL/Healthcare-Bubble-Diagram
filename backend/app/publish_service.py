"""Write a project's export into the shared ``published_projects`` handoff table.

Pure data logic, deliberately free of the PostGIS models and the request layer so
it stays unit-testable on SQLite: it takes an already-built export dict plus the
owner's identity and upserts one row, keyed by (google_sub, project_id) so a
re-publish updates in place rather than piling up versions.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.orm import Session

from .published_model import PublishedProject


def upsert_published(
    db: Session,
    *,
    google_sub: str,
    email: str | None,
    project_id: str,
    project_name: str,
    export: dict,
) -> PublishedProject:
    site = export.get("site") or {}
    if not isinstance(site, dict):
        site = {}
    coords = site.get("coordinates") or {}
    if not isinstance(coords, dict):
        coords = {}

    row = (
        db.query(PublishedProject)
        .filter(
            PublishedProject.google_sub == google_sub,
            PublishedProject.project_id == project_id,
        )
        .first()
    )
    now = datetime.now(timezone.utc)
    if row is None:
        row = PublishedProject(
            id=uuid4().hex,
            google_sub=google_sub,
            project_id=project_id,
            created_at=now,
        )
        db.add(row)

    row.email = email
    row.name = project_name
    row.status = "published"
    row.address = site.get("address")
    row.lat = coords.get("lat")
    row.lng = coords.get("lng")
    row.lot_area_sqm = site.get("lot_area_sqm")
    row.site_analysis = export.get("site_intelligence")
    row.bubble_diagram = export.get("bubble_diagram")
    row.export_json = export
    row.updated_at = now

    db.flush()
    return row
