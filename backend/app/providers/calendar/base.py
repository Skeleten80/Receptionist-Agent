from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, time
from typing import Optional


class CalendarError(Exception):
    """Raised when the calendar provider fails."""


@dataclass
class TimeSlot:
    starts_at: datetime
    ends_at: datetime


@dataclass
class CalendarEvent:
    event_id: str
    starts_at: datetime
    ends_at: datetime
    title: str


BusinessHourTuple = tuple[int, time, time, bool]


class CalendarProvider(ABC):
    name: str

    @abstractmethod
    def find_availability(
        self,
        *,
        window_start: datetime,
        window_end: datetime,
        duration_minutes: int,
        business_hours: list[BusinessHourTuple] | None = None,
    ) -> list[TimeSlot]:
        raise NotImplementedError

    @abstractmethod
    def create_event(
        self,
        *,
        title: str,
        starts_at: datetime,
        ends_at: datetime,
        description: str,
        idempotency_key: str,
    ) -> CalendarEvent:
        raise NotImplementedError
