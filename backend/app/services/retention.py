from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import AuditEvent, Call, CallTranscript
from app.services.audit import record_audit


def delete_call_data(db: Session, *, business_id: UUID, call_id: UUID) -> bool:
    """Delete transcript (and recording ref). Keeps call metadata for audit trail."""
    call = (
        db.query(Call)
        .filter(Call.id == call_id, Call.business_id == business_id)
        .one_or_none()
    )
    if call is None:
        return False

    transcript = (
        db.query(CallTranscript)
        .filter(CallTranscript.call_id == call_id, CallTranscript.business_id == business_id)
        .one_or_none()
    )
    if transcript is not None:
        db.delete(transcript)

    call.recording_url = None
    call.agent_messages = []
    record_audit(
        db,
        business_id=business_id,
        call_id=call_id,
        event_type="call_data_deleted",
        detail={"deleted_at": datetime.now(timezone.utc).isoformat()},
    )
    db.commit()
    return True


def purge_expired_transcripts(db: Session) -> int:
    settings = get_settings()
    days = settings.transcript_retention_days
    cutoff = datetime.now(timezone.utc).timestamp() - (days * 86400)
    # Filter in Python for JSONB-simple MVP; production would use SQL age filter.
    deleted = 0
    transcripts = db.query(CallTranscript).all()
    for t in transcripts:
        created = t.created_at
        if created is None:
            continue
        if created.replace(tzinfo=timezone.utc).timestamp() < cutoff:
            db.delete(t)
            deleted += 1
    if deleted:
        db.commit()
    return deleted
