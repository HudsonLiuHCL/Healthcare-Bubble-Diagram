"""Publish a project to the Revit handoff store.

``POST /projects/{id}/publish`` (Google-authenticated) builds the same export the
/export endpoint returns and writes it into ``published_projects``, stamped with
the caller's Google identity. A Revit user signed into the same Google account
then sees it via the agent's list/fetch/create-from-preliminary tools.
"""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import Identity, get_current_user
from ..database import get_db
from ..models.models import Project
from ..publish_service import upsert_published
from .projects import build_export

router = APIRouter(prefix="/projects", tags=["publish"])


@router.post("/{project_id}/publish")
def publish_project(
    project_id: UUID,
    user: Identity = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    export = build_export(db, project)
    row = upsert_published(
        db,
        google_sub=user.sub,
        email=user.email,
        project_id=str(project_id),
        project_name=project.name,
        export=export,
    )
    db.commit()
    return {
        "ok": True,
        "published_id": row.id,
        "project_id": str(project_id),
        "name": project.name,
        "owner": user.email,
    }
