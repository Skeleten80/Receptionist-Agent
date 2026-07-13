from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from app.db.models import Business
from app.services.call_workflow import CallWorkflow, ScriptedCallInput


def run_script(
    workflow: CallWorkflow,
    business: Business,
    *,
    utterance: str,
    lead: dict[str, Any] | None = None,
    recording_consent: bool = True,
    transcript_consent: bool = True,
    confirm_booking: bool = True,
    key: str | None = None,
) -> Any:
    now = datetime.now(timezone.utc)
    script = ScriptedCallInput(
        utterance=utterance,
        recording_consent=recording_consent,
        transcript_consent=transcript_consent,
        lead=lead or {},
        confirm_booking=confirm_booking,
        preferred_window_start=now,
        preferred_window_end=now + timedelta(days=7),
    )
    return workflow.run_scripted(business, script, call_key=key or f"test-{uuid4().hex}")
