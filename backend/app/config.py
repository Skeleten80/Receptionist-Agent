from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Values that used to ship as defaults / in docs. They are public, so never accept them.
_KNOWN_INSECURE_VALUES = {
    "change-me-in-production",
    "demo-api-key-stratford-comfort",
}
_MIN_SECRET_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Local AI Business Agent"
    app_env: str = "development"
    log_level: str = "INFO"
    # Required: no default. Generate with: python -c "import secrets; print(secrets.token_urlsafe(48))"
    secret_key: str

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    # Required: no default. Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"
    admin_api_key_bootstrap: str

    database_url: str = "postgresql+psycopg://agent:agent@localhost:5432/agent"

    recording_storage_enabled: bool = False
    transcript_retention_days: int = 90
    seed_demo: bool = False

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

    @field_validator("secret_key", "admin_api_key_bootstrap")
    @classmethod
    def _require_real_secret(cls, value: str, info) -> str:  # noqa: ANN001
        name = info.field_name.upper()
        value = (value or "").strip()
        if not value:
            raise ValueError(f"{name} must be set (refusing to start without it)")
        if value in _KNOWN_INSECURE_VALUES:
            raise ValueError(f"{name} is set to a public demo/placeholder value; generate a real one")
        if len(value) < _MIN_SECRET_LENGTH:
            raise ValueError(f"{name} must be at least {_MIN_SECRET_LENGTH} characters")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
