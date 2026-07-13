from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from app.api import admin, privacy, simulation, webhooks
from app.config import get_settings
from app.logging_config import configure_logging


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    if settings.seed_demo:
        try:
            from app.seed.demo_business import seed_demo_business
            from app.db.session import SessionLocal

            db = SessionLocal()
            try:
                seed_demo_business(db)
            finally:
                db.close()
        except Exception:  # noqa: BLE001 — DB may not be ready during import/tests
            pass
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(title=settings.app_name, lifespan=lifespan)
    application.include_router(admin.router)
    application.include_router(privacy.router)
    application.include_router(webhooks.router)
    application.include_router(simulation.router)

    @application.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return application


app = create_app()
