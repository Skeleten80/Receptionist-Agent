from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import Business
from app.db.session import get_db
from app.providers.calendar import get_calendar_provider
from app.providers.llm import get_llm_provider
from app.providers.notify import get_email_notifier
from app.providers.voice import get_voice_provider
from app.services.call_workflow import CallWorkflow, ScriptedCallInput

router = APIRouter(prefix="/webhooks/voice", tags=["webhooks"])


def _resolve_business(db: Session, body: dict[str, Any], settings: Settings) -> Business | None:
    business_id = body.get("business_id")
    if business_id:
        return db.query(Business).filter(Business.id == business_id).one_or_none()
    # Fallback: single-tenant demo bootstrap
    return db.query(Business).order_by(Business.created_at.asc()).first()


@router.post("/{provider}")
async def voice_webhook(
    provider: str,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    body = await request.json()
    headers = {k.lower(): v for k, v in request.headers.items()}
    voice = get_voice_provider(provider)
    event = voice.parse_webhook(body, headers)
    business = _resolve_business(db, body, settings)
    if business is None:
        return {"error": "no_business_configured"}

    script = None
    if body.get("utterance") or body.get("lead"):
        script = ScriptedCallInput(
            utterance=str(body.get("utterance", "")),
            recording_consent=body.get("recording_consent", True),
            transcript_consent=body.get("transcript_consent", True),
            lead=dict(body.get("lead") or {}),
            confirm_booking=bool(body.get("confirm_booking", True)),
        )

    workflow = CallWorkflow(
        db,
        llm=get_llm_provider(settings),
        calendar=get_calendar_provider(settings),
        notifier=get_email_notifier(settings),
    )
    result = workflow.handle_inbound(business, event, script=script)
    return {
        "call_id": str(result.call.id),
        "outcome": result.call.outcome,
        "duplicate": result.duplicate_webhook,
        **voice.format_response(result.actions),
    }
