from __future__ import annotations

from datetime import datetime, timedelta, time, timezone
from typing import Optional
from uuid import uuid4

from app.providers.calendar.base import (
    BusinessHourTuple,
    CalendarError,
    CalendarEvent,
    CalendarProvider,
    TimeSlot,
)


class MockCalendarProvider(CalendarProvider):
    """Realistic in-memory calendar with configurable availability and failure modes."""

    name = "mock"

    def __init__(
        self,
        *,
        available: bool = True,
        fail_on_create: bool = False,
        fail_on_availability: bool = False,
        slots: Optional[list[TimeSlot]] = None,
    ) -> None:
        self.available = available
        self.fail_on_create = fail_on_create
        self.fail_on_availability = fail_on_availability
        self._slots = slots
        self._events: dict[str, CalendarEvent] = {}
        self._idempotency: dict[str, CalendarEvent] = {}

    def find_availability(
        self,
        *,
        window_start: datetime,
        window_end: datetime,
        duration_minutes: int,
        business_hours: list[BusinessHourTuple] | None = None,
    ) -> list[TimeSlot]:
        if self.fail_on_availability:
            raise CalendarError("Mock calendar availability failure")
        if not self.available:
            return []
        if self._slots is not None:
            return list(self._slots)

        # Default: next weekday 10:00–11:00 within window if overlaps business hours.
        start = window_start
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        candidate = start.replace(hour=10, minute=0, second=0, microsecond=0)
        if candidate < start:
            candidate += timedelta(days=1)
        for _ in range(14):
            dow = candidate.weekday()  # Mon=0
            if business_hours:
                day_hours = [h for h in business_hours if h[0] == dow and not h[3]]
                if not day_hours:
                    candidate += timedelta(days=1)
                    candidate = candidate.replace(hour=10, minute=0)
                    continue
            else:
                if dow >= 5:
                    candidate += timedelta(days=1)
                    candidate = candidate.replace(hour=10, minute=0)
                    continue
            end = candidate + timedelta(minutes=duration_minutes)
            if end <= window_end:
                return [TimeSlot(starts_at=candidate, ends_at=end)]
            candidate += timedelta(days=1)
            candidate = candidate.replace(hour=10, minute=0)
        return []

    def create_event(
        self,
        *,
        title: str,
        starts_at: datetime,
        ends_at: datetime,
        description: str,
        idempotency_key: str,
    ) -> CalendarEvent:
        if idempotency_key in self._idempotency:
            return self._idempotency[idempotency_key]
        if self.fail_on_create:
            raise CalendarError("Mock calendar create failure")
        event = CalendarEvent(
            event_id=f"mock-{uuid4().hex[:12]}",
            starts_at=starts_at,
            ends_at=ends_at,
            title=title,
        )
        self._events[event.event_id] = event
        self._idempotency[idempotency_key] = event
        return event


class FailCalendarProvider(MockCalendarProvider):
    """Convenience provider that always fails creates (used in tests via DI)."""

    def __init__(self) -> None:
        super().__init__(fail_on_create=True)
