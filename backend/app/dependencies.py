from __future__ import annotations

import hashlib
import hmac
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import Business
from app.db.session import get_db
from app.providers.calendar import CalendarProvider, get_calendar_provider
from app.providers.llm import LLMProvider, get_llm_provider
from app.providers.notify import EmailNotifier, get_email_notifier
from app.providers.voice import VoiceProvider, get_voice_provider


def hash_api_key(raw_key: str, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), raw_key.encode("utf-8"), hashlib.sha256).hexdigest()


def get_business_by_api_key(
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    x_api_key: Annotated[str | None, Header(alias="X-API-Key")] = None,
) -> Business:
    if not x_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing API key")
    key_hash = hash_api_key(x_api_key, settings.secret_key)
    business = db.query(Business).filter(Business.api_key_hash == key_hash).one_or_none()
    if business is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    return business


def voice_provider_dep(settings: Annotated[Settings, Depends(get_settings)]) -> VoiceProvider:
    return get_voice_provider(settings.voice_provider)


def calendar_provider_dep(settings: Annotated[Settings, Depends(get_settings)]) -> CalendarProvider:
    return get_calendar_provider(settings)


def llm_provider_dep(settings: Annotated[Settings, Depends(get_settings)]) -> LLMProvider:
    return get_llm_provider(settings)


def email_notifier_dep(settings: Annotated[Settings, Depends(get_settings)]) -> EmailNotifier:
    return get_email_notifier(settings)
