from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from datetime import datetime
from uuid import UUID


class ProjectCreate(BaseModel):
    name: str


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    starting_mode: Optional[str] = None


class ProjectOut(BaseModel):
    id: UUID
    name: str
    status: str
    starting_mode: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SiteCreate(BaseModel):
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    parcel_geojson: Optional[Dict[str, Any]] = None
    lot_area_sqm: Optional[float] = None


class SiteOut(BaseModel):
    id: UUID
    project_id: UUID
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    parcel_geojson: Optional[Dict[str, Any]] = None
    lot_area_sqm: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class IntelligenceOut(BaseModel):
    id: UUID
    project_id: UUID
    status: str
    # AI-synthesized
    zoning: Optional[Dict[str, Any]] = None
    building_restrictions: Optional[Dict[str, Any]] = None
    building_codes: Optional[Dict[str, Any]] = None
    environmental: Optional[Dict[str, Any]] = None
    healthcare_constraints: Optional[Dict[str, Any]] = None
    planning_summary: Optional[str] = None
    raw_analysis: Optional[str] = None
    # Real data from APIs
    address_details: Optional[Dict[str, Any]] = None
    elevation_data: Optional[Dict[str, Any]] = None
    sun_data: Optional[Dict[str, Any]] = None
    climate_data: Optional[Dict[str, Any]] = None
    air_quality_data: Optional[Dict[str, Any]] = None
    flood_data: Optional[Dict[str, Any]] = None
    nearby_infrastructure: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BubbleDiagramCreate(BaseModel):
    requirements_text: str


class BubbleDiagramUpdate(BaseModel):
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None
    status: Optional[str] = None


class BubbleRefineRequest(BaseModel):
    refinement_text: str
    current_nodes: List[Dict[str, Any]]
    current_program: Dict[str, Any]


class BubbleDiagramOut(BaseModel):
    id: UUID
    project_id: UUID
    version: int
    nodes: Optional[List[Dict[str, Any]]] = None
    edges: Optional[List[Dict[str, Any]]] = None
    requirements_text: Optional[str] = None
    program_data: Optional[Dict[str, Any]] = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BubbleRefineOut(BubbleDiagramOut):
    changes_summary: Optional[str] = None


class UploadedFileOut(BaseModel):
    id: UUID
    project_id: UUID
    filename: str
    original_name: str
    file_type: str
    file_size: Optional[int] = None
    parsed_data: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectExport(BaseModel):
    project: ProjectOut
    site: Optional[SiteOut] = None
    intelligence: Optional[IntelligenceOut] = None
    bubble_diagram: Optional[BubbleDiagramOut] = None
    uploaded_files: List[UploadedFileOut] = []
    exported_at: datetime
