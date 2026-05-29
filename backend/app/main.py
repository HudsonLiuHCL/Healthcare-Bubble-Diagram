from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from sqlalchemy import text

from .database import engine, Base
from .models import models  # noqa: ensure models are registered
from . import published_model  # noqa: ensure published_projects table is registered
from .api import projects, sites, intelligence, bubble, files, publish, collaborate
from .config import settings

Base.metadata.create_all(bind=engine)

# Add new columns to site_intelligence if the table already existed before this migration
_NEW_COLS = [
    "ALTER TABLE site_intelligence ADD COLUMN IF NOT EXISTS building_codes JSON",
    "ALTER TABLE site_intelligence ADD COLUMN IF NOT EXISTS planning_summary TEXT",
    "ALTER TABLE site_intelligence ADD COLUMN IF NOT EXISTS address_details JSON",
    "ALTER TABLE site_intelligence ADD COLUMN IF NOT EXISTS elevation_data JSON",
    "ALTER TABLE site_intelligence ADD COLUMN IF NOT EXISTS sun_data JSON",
    "ALTER TABLE site_intelligence ADD COLUMN IF NOT EXISTS climate_data JSON",
    "ALTER TABLE site_intelligence ADD COLUMN IF NOT EXISTS air_quality_data JSON",
    "ALTER TABLE site_intelligence ADD COLUMN IF NOT EXISTS flood_data JSON",
    "ALTER TABLE site_intelligence ADD COLUMN IF NOT EXISTS nearby_infrastructure JSON",
]
with engine.connect() as _conn:
    for _sql in _NEW_COLS:
        try:
            _conn.execute(text(_sql))
            _conn.commit()
        except Exception:
            pass

Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

app = FastAPI(title="HealthArch API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(sites.router)
app.include_router(intelligence.router)
app.include_router(bubble.router)
app.include_router(files.router)
app.include_router(publish.router)
app.include_router(collaborate.router)


@app.get("/health")
def health():
    return {"status": "ok"}
