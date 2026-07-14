from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Local AI Business Agent"
    app_env: str = "development"
    log_level: str = "INFO"
    secret_key: str = "change-me-in-production"

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    admin_api_key_bootstrap: str = "demo-api-key-stratford-comfort"

    database_url: str = "postgresql+psycopg://agent:agent@localhost:5432/agent"

    recording_storage_enabled: bool = False
    transcript_retention_days: int = 90
    seed_demo: bool = True

    voice_provider: str = "mock"
    retell_api_key: str = ""
    retell_webhook_secret: str = ""
    vapi_api_key: str = ""
    vapi_webhook_secret: str = ""

    calendar_provider: str = "mock"
    google_calendar_credentials_json: str = ""
    google_calendar_id: str = ""

    llm_provider: str = "mock"
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = "gpt-4o-mini"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@example.com"
    notify_email_dry_run: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
