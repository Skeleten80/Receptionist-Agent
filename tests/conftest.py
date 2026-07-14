from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import os
from collections.abc import Generator
from typing import Any

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("ADMIN_API_KEY_BOOTSTRAP", "demo-api-key-stratford-comfort")
os.environ.setdefault("SEED_DEMO", "true")
os.environ.setdefault("NOTIFY_EMAIL_DRY_RUN", "true")
os.environ.setdefault("LLM_PROVIDER", "mock")
os.environ.setdefault("CALENDAR_PROVIDER", "mock")
os.environ.setdefault("VOICE_PROVIDER", "mock")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://agent:agent@localhost:5432/agent",
)

from app.config import get_settings
from app.db.base import Base
from app.db.models import Business
from app.providers.calendar import MockCalendarProvider
from app.providers.llm import MockLLMProvider
from app.providers.notify import EmailNotifier
from app.seed.demo_business import seed_demo_business
from app.services.call_workflow import CallWorkflow

get_settings.cache_clear()

TABLES = [
    "audit_events",
    "notifications",
    "appointments",
    "leads",
    "call_transcripts",
    "calls",
    "escalation_rules",
    "knowledge_base_entries",
    "service_types",
    "business_hours",
    "businesses",
]


@pytest.fixture(scope="session")
def engine():
    settings = get_settings()
    eng = create_engine(settings.database_url, pool_pre_ping=True)
    for _ in range(30):
        try:
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            break
        except Exception:
            import time

            time.sleep(1)
    else:
        raise RuntimeError("PostgreSQL not available for tests")

    Base.metadata.drop_all(bind=eng)
    Base.metadata.create_all(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine) -> Generator[Session, None, None]:
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = SessionLocal()
    # Clean slate each test
    session.execute(text(f"TRUNCATE {', '.join(TABLES)} CASCADE"))
    session.commit()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def business(db: Session) -> Business:
    return seed_demo_business(db)


@pytest.fixture
def llm() -> MockLLMProvider:
    return MockLLMProvider()


@pytest.fixture
def calendar() -> MockCalendarProvider:
    return MockCalendarProvider(available=True)


@pytest.fixture
def notifier() -> EmailNotifier:
    return EmailNotifier(
        smtp_host="",
        smtp_port=587,
        smtp_user="",
        smtp_password="",
        smtp_from="noreply@example.com",
        dry_run=True,
        fail=False,
    )


@pytest.fixture
def workflow(
    db: Session, llm: MockLLMProvider, calendar: MockCalendarProvider, notifier: EmailNotifier
) -> CallWorkflow:
    return CallWorkflow(db, llm=llm, calendar=calendar, notifier=notifier)


@pytest.fixture
def booking_lead() -> dict[str, Any]:
    return {
        "name": "Jordan Lee",
        "callback_number": "+15195550100",
        "service_address": "45 Ontario St",
        "city": "Stratford",
        "service_type_slug": "ac-repair",
        "description": "AC not cooling",
    }
