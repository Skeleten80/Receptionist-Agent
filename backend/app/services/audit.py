from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import AuditEvent
from app.logging_config import _redact


def record_audit(
    db: Session,
    *,
    business_id: UUID,
    call_id: Optional[UUID],
    event_type: str,
    detail: dict[str, Any] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        business_id=business_id,
        call_id=call_id,
        event_type=event_type,
        detail=_redact(detail or {}),
    )
    db.add(event)
    db.flush()
    return event
