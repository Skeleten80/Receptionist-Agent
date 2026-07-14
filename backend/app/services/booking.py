from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Appointment, Business, Call, Lead, ServiceType
from app.providers.calendar import CalendarError, CalendarProvider, TimeSlot
from app.services.audit import record_audit
from app.services.business_rules import hours_tuples


@dataclass
class BookingResult:
    success: bool
    appointment: Optional[Appointment] = None
    slot: Optional[TimeSlot] = None
    error: Optional[str] = None
    duplicate: bool = False
    no_availability: bool = False


def _parse_window(
    preferred_start: Optional[datetime],
    preferred_end: Optional[datetime],
) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    start = preferred_start or now
    end = preferred_end or (start + timedelta(days=7))
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return start, end


def book_appointment(
    db: Session,
    *,
    business: Business,
    call: Call,
    lead: Lead,
    service: ServiceType,
    calendar: CalendarProvider,
    idempotency_key: str,
    confirmation_spoken: bool,
) -> BookingResult:
    if not confirmation_spoken:
        return BookingResult(success=False, error="confirmation_required")

    existing = (
        db.query(Appointment)
        .filter(
            Appointment.business_id == business.id,
            Appointment.idempotency_key == idempotency_key,
        )
        .one_or_none()
    )
    if existing is not None:
        return BookingResult(success=True, appointment=existing, duplicate=True)

    window_start, window_end = _parse_window(lead.preferred_window_start, lead.preferred_window_end)
    try:
        slots = calendar.find_availability(
            window_start=window_start,
            window_end=window_end,
            duration_minutes=service.duration_minutes,
            business_hours=hours_tuples(list(business.hours)),
        )
    except CalendarError as exc:
        record_audit(
            db,
            business_id=business.id,
            call_id=call.id,
            event_type="calendar_availability_error",
            detail={"error": str(exc)},
        )
        return BookingResult(success=False, error=str(exc))

    if not slots:
        record_audit(
            db,
            business_id=business.id,
            call_id=call.id,
            event_type="no_availability",
            detail={"window_start": window_start.isoformat(), "window_end": window_end.isoformat()},
        )
        return BookingResult(success=False, no_availability=True, error="no_availability")

    slot = slots[0]
    try:
        event = calendar.create_event(
            title=f"{service.name} — {lead.name or 'Customer'}",
            starts_at=slot.starts_at,
            ends_at=slot.ends_at,
            description=f"{lead.description}\nAddress: {lead.service_address}, {lead.city}\nPhone: {lead.callback_number}",
            idempotency_key=idempotency_key,
        )
    except CalendarError as exc:
        record_audit(
            db,
            business_id=business.id,
            call_id=call.id,
            event_type="calendar_create_error",
            detail={"error": str(exc)},
        )
        return BookingResult(success=False, error=str(exc))

    appt = Appointment(
        business_id=business.id,
        call_id=call.id,
        lead_id=lead.id,
        service_type_id=service.id,
        idempotency_key=idempotency_key,
        starts_at=slot.starts_at,
        ends_at=slot.ends_at,
        status="confirmed",
        calendar_event_id=event.event_id,
        confirmation_spoken=True,
    )
    db.add(appt)
    try:
        with db.begin_nested():
            db.flush()
    except IntegrityError:
        existing = (
            db.query(Appointment)
            .filter(
                Appointment.business_id == business.id,
                Appointment.idempotency_key == idempotency_key,
            )
            .one_or_none()
        )
        if existing:
            return BookingResult(success=True, appointment=existing, duplicate=True, slot=slot)
        raise

    lead.status = "booked"
    record_audit(
        db,
        business_id=business.id,
        call_id=call.id,
        event_type="appointment_created",
        detail={"appointment_id": str(appt.id), "calendar_event_id": event.event_id},
    )
    return BookingResult(success=True, appointment=appt, slot=slot)
