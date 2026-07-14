from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time
from typing import Optional

from app.db.models import BusinessHours, Intent, ServiceType


@dataclass
class RuleViolation:
    code: str
    message: str
    escalate: bool = False


def never_diagnose(utterance: str) -> Optional[RuleViolation]:
    diagnostic = ("what's wrong", "what is wrong", "diagnose", "is it the capacitor", "which part")
    text = utterance.lower()
    if any(d in text for d in diagnostic):
        return RuleViolation(
            "no_diagnosis",
            "I can't diagnose the issue over the phone, but I can help book a technician.",
        )
    return None


def never_quote_price(intent: Intent) -> Optional[RuleViolation]:
    if intent == Intent.PRICE_QUOTE:
        return RuleViolation(
            "no_custom_pricing",
            "I can't provide a custom price over the phone. A technician will assess on-site. "
            "I can book an appointment or connect you with the team.",
            escalate=False,
        )
    return None


def service_is_bookable(service: ServiceType | None) -> Optional[RuleViolation]:
    if service is None or not service.active or not service.bookable:
        return RuleViolation(
            "service_not_bookable",
            "That service isn't available for online booking. I'll have someone follow up.",
            escalate=True,
        )
    return None


def within_configured_hours(hours: list[BusinessHours], when: datetime) -> bool:
    dow = when.weekday()
    day = next((h for h in hours if h.day_of_week == dow), None)
    if day is None or day.is_closed:
        return False
    t = when.timetz().replace(tzinfo=None) if when.tzinfo else when.time()
    return day.open_time <= t < day.close_time


def hours_tuples(hours: list[BusinessHours]) -> list[tuple[int, time, time, bool]]:
    return [(h.day_of_week, h.open_time, h.close_time, h.is_closed) for h in hours]
