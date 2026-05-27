"""The ``published_projects`` handoff table (writer side).

When a user publishes a project for Revit, this app writes one row here; the
Revit AI agent (separate repo: HealthcareArchitecture/agent) reads it. It is the
SAME physical table in the SAME Postgres instance — the agent defines a matching
read model in ``agent/app/handoff_db.py``. Keep the two column lists in lockstep.

Kept at the app top level (not under app/models/) on purpose: app/models/__init__
imports the PostGIS models, and this table must stay importable — e.g. from the
test suite — without dragging GeoAlchemy2/PostGIS in. Columns are deliberately
portable (no PostGIS): location is plain address/lat/lng, rich data is JSON.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Column, DateTime, Float, String, UniqueConstraint

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PublishedProject(Base):
    __tablename__ = "published_projects"
    __table_args__ = (
        UniqueConstraint("google_sub", "project_id", name="uq_published_user_project"),
    )

    id = Column(String, primary_key=True)                     # handoff row id (uuid hex)
    google_sub = Column(String, index=True, nullable=False)   # owner (Google `sub`)
    email = Column(String, nullable=True)                     # owner email, for display
    project_id = Column(String, index=True, nullable=False)   # source project id
    name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="published")

    address = Column(String, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    lot_area_sqm = Column(Float, nullable=True)

    site_analysis = Column(JSON, nullable=True)    # = export["site_intelligence"]
    bubble_diagram = Column(JSON, nullable=True)   # = export["bubble_diagram"] {nodes, edges, program}
    export_json = Column(JSON, nullable=False)     # the full export document

    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)
