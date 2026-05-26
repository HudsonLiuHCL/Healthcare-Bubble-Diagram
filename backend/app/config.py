from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    database_url: str = "postgresql://healtharch:healtharch@localhost:5432/healtharch"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    upload_dir: str = str(Path(__file__).parent.parent / "uploads")

    class Config:
        env_file = str(Path(__file__).parent.parent.parent / ".env")
        extra = "ignore"


settings = Settings()
