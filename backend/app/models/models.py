import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON, Integer, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
import enum

from ..database import Base


class ProjectStatus(str, enum.Enum):
    site_selection = "site_selection"
    starting_path = "starting_path"
    bubble_diagram = "bubble_diagram"
    upload_design = "upload_design"
    design_editor = "design_editor"


class StartingMode(str, enum.Enum):
    upload = "upload"
    generate = "generate"


class IntelligenceStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class BubbleStatus(str, enum.Enum):
    draft = "draft"
    approved = "approved"


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    status = Column(SAEnum(ProjectStatus), default=ProjectStatus.site_selection, nullable=False)
    starting_mode = Column(SAEnum(StartingMode), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    site = relationship("Site", back_populates="project", uselist=False, cascade="all, delete-orphan")
    intelligence = relationship("SiteIntelligence", back_populates="project", uselist=False, cascade="all, delete-orphan")
    bubble_diagrams = relationship("BubbleDiagram", back_populates="project", cascade="all, delete-orphan")
    uploaded_files = relationship("UploadedFile", back_populates="project", cascade="all, delete-orphan")


class Site(Base):
    __tablename__ = "sites"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    address = Column(String, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    parcel_polygon = Column(Geometry("POLYGON", srid=4326), nullable=True)
    lot_area_sqm = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="site")


class SiteIntelligence(Base):
    __tablename__ = "site_intelligence"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    status = Column(SAEnum(IntelligenceStatus), default=IntelligenceStatus.pending)

    # AI-synthesized fields
    zoning = Column(JSON, nullable=True)
    building_restrictions = Column(JSON, nullable=True)
    building_codes = Column(JSON, nullable=True)
    environmental = Column(JSON, nullable=True)
    healthcare_constraints = Column(JSON, nullable=True)
    planning_summary = Column(String, nullable=True)
    raw_analysis = Column(String, nullable=True)

    # Real data from external APIs
    address_details = Column(JSON, nullable=True)
    elevation_data = Column(JSON, nullable=True)
    sun_data = Column(JSON, nullable=True)
    climate_data = Column(JSON, nullable=True)
    air_quality_data = Column(JSON, nullable=True)
    flood_data = Column(JSON, nullable=True)
    nearby_infrastructure = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="intelligence")


class BubbleDiagram(Base):
    __tablename__ = "bubble_diagrams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    version = Column(Integer, default=1)
    nodes = Column(JSON, nullable=True)
    edges = Column(JSON, nullable=True)
    requirements_text = Column(String, nullable=True)
    program_data = Column(JSON, nullable=True)
    status = Column(SAEnum(BubbleStatus), default=BubbleStatus.draft)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="bubble_diagrams")


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    filename = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=True)
    parsed_data = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="uploaded_files")
