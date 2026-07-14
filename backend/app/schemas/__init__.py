from __future__ import annotations

from datetime import datetime, time
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class BusinessHoursIn(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    open_time: time
    close_time: time
    is_closed: bool = False


class BusinessHoursOut(BusinessHoursIn, ORMModel):
    id: UUID
    business_id: UUID


class ServiceTypeIn(BaseModel):
    name: str
    slug: str
    description: str = ""
    duration_minutes: int = 60
    bookable: bool = True
    active: bool = True


class ServiceTypeOut(ServiceTypeIn, ORMModel):
    id: UUID
    business_id: UUID


class KnowledgeBaseIn(BaseModel):
    question: str
    answer: str
    category: str = "general"
    active: bool = True


class KnowledgeBaseOut(KnowledgeBaseIn, ORMModel):
    id: UUID
    business_id: UUID


class EscalationRuleIn(BaseModel):
    name: str
    trigger_keywords: list[str] = Field(default_factory=list)
    intent_match: Optional[str] = None
    action: str = "transfer"
    priority: int = 100
    active: bool = True


class EscalationRuleOut(EscalationRuleIn, ORMModel):
    id: UUID
    business_id: UUID


class NotificationSettingsIn(BaseModel):
    owner_email: EmailStr
    owner_phone: Optional[str] = None
    notification_email_enabled: bool = True
    notification_sms_enabled: bool = False


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    service_area: Optional[str] = None
    timezone: Optional[str] = None
    disclosure_message: Optional[str] = None
    prompt_template: Optional[str] = None
    recording_storage_enabled: Optional[bool] = None
    voice_provider: Optional[str] = None
    calendar_provider: Optional[str] = None


class BusinessOut(ORMModel):
    id: UUID
    name: str
    service_area: str
    timezone: str
    disclosure_message: str
    owner_email: str
    owner_phone: Optional[str]
    notification_email_enabled: bool
    notification_sms_enabled: bool
    recording_storage_enabled: bool
    voice_provider: str
    calendar_provider: str
    prompt_template: str
    created_at: datetime
    updated_at: datetime
    # api_key_hash intentionally omitted


class LeadOut(ORMModel):
    id: UUID
    business_id: UUID
    call_id: Optional[UUID]
    name: str
    callback_number: str
    service_address: str
    city: str
    service_type_slug: str
    description: str
    preferred_window_start: Optional[datetime]
    preferred_window_end: Optional[datetime]
    status: str
    created_at: datetime


class AppointmentOut(ORMModel):
    id: UUID
    business_id: UUID
    call_id: UUID
    lead_id: UUID
    service_type_id: UUID
    starts_at: datetime
    ends_at: datetime
    status: str
    calendar_event_id: Optional[str]
    confirmation_spoken: bool
    created_at: datetime


class CallOut(ORMModel):
    id: UUID
    business_id: UUID
    provider: str
    provider_call_id: str
    from_number: str
    to_number: str
    status: str
    outcome: Optional[str]
    intent: Optional[str]
    recording_consent: Optional[bool]
    transcript_consent: Optional[bool]
    started_at: datetime
    ended_at: Optional[datetime]
    summary: Optional[str]
    error_detail: Optional[str]


class CallDetailOut(CallOut):
    transcript_turns: list[dict[str, Any]] = Field(default_factory=list)
    agent_messages: list[dict[str, Any]] = Field(default_factory=list)


class SimulateCallRequest(BaseModel):
    script: str = Field(
        description=(
            "booking_success | price_quote | emergency_gas | speak_to_human | "
            "no_availability | calendar_failure | unknown_question | "
            "recording_refusal | notification_failure | custom"
        )
    )
    utterance: Optional[str] = None
    lead: Optional[dict[str, Any]] = None
    recording_consent: bool = True
    transcript_consent: bool = True
    confirm_booking: bool = True
    idempotency_key: Optional[str] = None


class SimulateCallResponse(BaseModel):
    call: CallOut
    actions: list[dict[str, Any]]
    lead: Optional[LeadOut] = None
    duplicate_webhook: bool = False
