from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from app.config import Settings
from app.providers.calendar.base import (
    BusinessHourTuple,
    CalendarError,
    CalendarEvent,
    CalendarProvider,
    TimeSlot,
)
from app.providers.calendar.mock import MockCalendarProvider

logger = logging.getLogger(__name__)


class GoogleCalendarProvider(CalendarProvider):
    """
    Google Calendar adapter.

    When OAuth credentials are absent, construction falls back to mock mode
    via get_calendar_provider(). This class raises if used without credentials.
    """

    name = "google"

    def __init__(self, credentials_json: str, calendar_id: str) -> None:
        if not credentials_json or not calendar_id:
            raise CalendarError("Google Calendar credentials or calendar id missing")
        self.calendar_id = calendar_id
        try:
            self._creds: dict[str, Any] = json.loads(credentials_json)
        except json.JSONDecodeError as exc:
            raise CalendarError("Invalid Google Calendar credentials JSON") from exc
        # Real google-api-python-client wiring would go here; MVP keeps a clear
        # failure path so production never silently books without a backend.
        self._client_ready = False
        logger.info("google_calendar_adapter_initialized", extra={"calendar_id": calendar_id})

    def find_availability(
        self,
        *,
        window_start: datetime,
        window_end: datetime,
        duration_minutes: int,
        business_hours: list[BusinessHourTuple] | None = None,
    ) -> list[TimeSlot]:
        raise CalendarError(
            "Google Calendar API client not configured in this environment; "
            "set CALENDAR_PROVIDER=mock or supply a working OAuth client."
        )

    def create_event(
        self,
        *,
        title: str,
        starts_at: datetime,
        ends_at: datetime,
        description: str,
        idempotency_key: str,
    ) -> CalendarEvent:
        raise CalendarError(
            "Google Calendar API client not configured in this environment; "
            "set CALENDAR_PROVIDER=mock or supply a working OAuth client."
        )


def get_calendar_provider(settings: Settings, *, override: CalendarProvider | None = None) -> CalendarProvider:
    if override is not None:
        return override
    if settings.calendar_provider == "google":
        if settings.google_calendar_credentials_json and settings.google_calendar_id:
            return GoogleCalendarProvider(
                settings.google_calendar_credentials_json,
                settings.google_calendar_id,
            )
        logger.warning("google_calendar_credentials_absent_using_mock")
    return MockCalendarProvider()
