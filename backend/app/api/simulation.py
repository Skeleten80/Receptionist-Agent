from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import Business
from app.db.session import get_db
from app.dependencies import get_business_by_api_key
from app.providers.calendar import MockCalendarProvider, TimeSlot, get_calendar_provider
from app.providers.llm import get_llm_provider
from app.providers.notify import EmailNotifier, get_email_notifier
from app.schemas import CallOut, LeadOut, SimulateCallRequest, SimulateCallResponse
from app.services.call_workflow import CallWorkflow, ScriptedCallInput

router = APIRouter(prefix="/simulate", tags=["simulation"])


SCRIPTS: dict[str, dict[str, Any]] = {
    "booking_success": {
        "utterance": "My AC isn't cooling. I'd like to book an AC repair appointment.",
        "lead": {
            "name": "Jordan Lee",
            "callback_number": "+15195550100",
            "service_address": "45 Ontario St",
            "city": "Stratford",
            "service_type_slug": "ac-repair",
            "description": "AC not cooling upstairs",
        },
    },
    "price_quote": {
        "utterance": "How much does a furnace repair cost? Can you give me a price quote?",
        "lead": {},
    },
    "emergency_gas": {
        "utterance": "I smell gas near the furnace and I'm worried.",
        "lead": {
            "name": "Sam Rivera",
            "callback_number": "+15195550111",
            "service_address": "12 Erie St",
            "city": "Stratford",
            "service_type_slug": "furnace-repair",
            "description": "Gas smell",
        },
    },
    "speak_to_human": {
        "utterance": "I need to speak to a person please.",
        "lead": {"name": "Alex", "callback_number": "+15195550122"},
    },
    "no_availability": {
        "utterance": "I need furnace repair this week.",
        "lead": {
            "name": "Casey Ng",
            "callback_number": "+15195550133",
            "service_address": "8 Waterloo St",
            "city": "Stratford",
            "service_type_slug": "furnace-repair",
            "description": "Furnace making noise",
        },
        "calendar": "empty",
    },
    "calendar_failure": {
        "utterance": "Please book HVAC repair for me.",
        "lead": {
            "name": "Riley Chen",
            "callback_number": "+15195550144",
            "service_address": "22 Huron St",
            "city": "Stratford",
            "service_type_slug": "hvac-repair",
            "description": "Noisy outdoor unit",
        },
        "calendar": "fail",
    },
    "unknown_question": {
        "utterance": "Do you install geothermal swimming pool heaters for barns?",
        "lead": {"name": "Pat", "callback_number": "+15195550155"},
    },
    "recording_refusal": {
        "utterance": "I need help with my furnace.",
        "recording_consent": False,
        "transcript_consent": False,
        "lead": {},
    },
    "notification_failure": {
        "utterance": "My AC isn't cooling. Book an AC repair please.",
        "lead": {
            "name": "Morgan",
            "callback_number": "+15195550166",
            "service_address": "3 Romeo St",
            "city": "Stratford",
            "service_type_slug": "ac-repair",
            "description": "AC warm air",
        },
        "notify_fail": True,
    },
}


@router.post("/call", response_model=SimulateCallResponse)
def simulate_call(
    payload: SimulateCallRequest,
    business: Annotated[Business, Depends(get_business_by_api_key)],
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> SimulateCallResponse:
    preset = SCRIPTS.get(payload.script, {})
    if payload.script not in SCRIPTS and payload.script != "custom":
        raise HTTPException(status_code=400, detail=f"Unknown script: {payload.script}")

    utterance = payload.utterance or str(preset.get("utterance", ""))
    lead = payload.lead if payload.lead is not None else dict(preset.get("lead") or {})
    recording_consent = (
        payload.recording_consent
        if payload.script == "custom"
        else preset.get("recording_consent", payload.recording_consent)
    )
    transcript_consent = (
        payload.transcript_consent
        if payload.script == "custom"
        else preset.get("transcript_consent", payload.transcript_consent)
    )

    now = datetime.now(timezone.utc)
    script = ScriptedCallInput(
        utterance=utterance,
        recording_consent=bool(recording_consent),
        transcript_consent=bool(transcript_consent),
        lead=lead,
        confirm_booking=payload.confirm_booking,
        preferred_window_start=now,
        preferred_window_end=now + timedelta(days=7),
    )

    calendar_mode = preset.get("calendar")
    if calendar_mode == "empty":
        calendar = MockCalendarProvider(available=False)
    elif calendar_mode == "fail":
        calendar = MockCalendarProvider(fail_on_create=True, fail_on_availability=True)
    else:
        calendar = get_calendar_provider(settings)

    if preset.get("notify_fail"):
        notifier: EmailNotifier = get_email_notifier(settings, fail=True)
    else:
        notifier = get_email_notifier(settings)

    workflow = CallWorkflow(
        db,
        llm=get_llm_provider(settings),
        calendar=calendar,
        notifier=notifier,
    )
    key = payload.idempotency_key or f"sim-{payload.script}-{uuid4().hex[:10]}"
    result = workflow.run_scripted(business, script, call_key=key)
    return SimulateCallResponse(
        call=CallOut.model_validate(result.call),
        actions=[
            {"say": a.say, "transfer": a.transfer, "end_call": a.end_call, "metadata": a.metadata}
            for a in result.actions
        ],
        lead=LeadOut.model_validate(result.lead) if result.lead else None,
        duplicate_webhook=result.duplicate_webhook,
    )
