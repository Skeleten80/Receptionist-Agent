from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.db.models import (
    Business,
    Call,
    CallOutcome,
    CallStatus,
    CallTranscript,
    Intent,
    Lead,
    ServiceType,
)
from app.providers.calendar import CalendarProvider
from app.providers.llm import LLMProvider
from app.providers.notify import NotificationChannel
from app.providers.voice.base import VoiceAction, VoiceWebhookEvent
from app.services.audit import record_audit
from app.services.booking import book_appointment
from app.services.business_rules import never_diagnose, never_quote_price, service_is_bookable
from app.services.escalation import evaluate_escalation
from app.services.notification_service import send_owner_notification
from app.services.prompt_builder import build_system_prompt, match_faq


@dataclass
class ScriptedCallInput:
    """Structured input for simulation / webhook-driven scripted turns."""

    utterance: str = ""
    recording_consent: Optional[bool] = True
    transcript_consent: Optional[bool] = True
    lead: dict[str, Any] = field(default_factory=dict)
    confirm_booking: bool = True
    angry: bool = False
    preferred_window_start: Optional[datetime] = None
    preferred_window_end: Optional[datetime] = None


@dataclass
class WorkflowResult:
    call: Call
    actions: list[VoiceAction]
    duplicate_webhook: bool = False
    lead: Optional[Lead] = None


class CallWorkflow:
    """Deterministic after-hours receptionist workflow."""

    def __init__(
        self,
        db: Session,
        *,
        llm: LLMProvider,
        calendar: CalendarProvider,
        notifier: NotificationChannel,
    ) -> None:
        self.db = db
        self.llm = llm
        self.calendar = calendar
        self.notifier = notifier

    def handle_inbound(
        self,
        business: Business,
        event: VoiceWebhookEvent,
        script: Optional[ScriptedCallInput] = None,
    ) -> WorkflowResult:
        existing = (
            self.db.query(Call)
            .filter(
                Call.business_id == business.id,
                Call.idempotency_key == event.idempotency_key,
            )
            .one_or_none()
        )
        if existing is not None:
            record_audit(
                self.db,
                business_id=business.id,
                call_id=existing.id,
                event_type="duplicate_webhook",
                detail={"idempotency_key": event.idempotency_key},
            )
            self.db.commit()
            return WorkflowResult(
                call=existing,
                actions=[
                    VoiceAction(
                        say="Thanks — we already have this call recorded.",
                        end_call=True,
                        metadata={"duplicate": True},
                    )
                ],
                duplicate_webhook=True,
            )

        call = Call(
            business_id=business.id,
            provider=event.provider,
            provider_call_id=event.provider_call_id,
            idempotency_key=event.idempotency_key,
            from_number=event.from_number,
            to_number=event.to_number,
            status=CallStatus.IN_PROGRESS.value,
            agent_messages=[],
        )
        self.db.add(call)
        try:
            self.db.flush()
        except IntegrityError:
            self.db.rollback()
            existing = (
                self.db.query(Call)
                .filter(
                    Call.business_id == business.id,
                    Call.idempotency_key == event.idempotency_key,
                )
                .one_or_none()
            )
            if existing:
                return WorkflowResult(
                    call=existing,
                    actions=[VoiceAction(say="Thanks — we already have this call recorded.", end_call=True)],
                    duplicate_webhook=True,
                )
            raise

        record_audit(
            self.db,
            business_id=business.id,
            call_id=call.id,
            event_type="call_started",
            detail={"provider": event.provider, "provider_call_id": event.provider_call_id},
        )

        script = script or ScriptedCallInput(utterance=str(event.payload.get("utterance", "")))
        return self._run(business, call, script)

    def run_scripted(self, business: Business, script: ScriptedCallInput, *, call_key: str) -> WorkflowResult:
        event = VoiceWebhookEvent(
            provider="mock",
            provider_call_id=call_key,
            idempotency_key=call_key,
            from_number=str(script.lead.get("callback_number", "+15195550100")),
            to_number="+15195550999",
            event_type="simulate",
            payload={"utterance": script.utterance},
        )
        return self.handle_inbound(business, event, script=script)

    def _say(self, call: Call, text: str, **meta: Any) -> VoiceAction:
        messages = list(call.agent_messages or [])
        messages.append({"role": "assistant", "text": text, "at": datetime.now(timezone.utc).isoformat()})
        call.agent_messages = messages
        return VoiceAction(say=text, metadata=meta)

    def _add_turn(self, call: Call, role: str, text: str) -> None:
        if call.transcript is None:
            call.transcript = CallTranscript(business_id=call.business_id, call_id=call.id, turns=[])
            self.db.add(call.transcript)
            self.db.flush()
        turns = list(call.transcript.turns or [])
        turns.append({"role": role, "text": text, "at": datetime.now(timezone.utc).isoformat()})
        call.transcript.turns = turns

    def _finalize(
        self,
        business: Business,
        call: Call,
        actions: list[VoiceAction],
        *,
        status: str,
        outcome: str,
        summary: str,
        lead: Optional[Lead] = None,
        notify: bool = True,
        urgent: bool = False,
        notify_extra: str = "",
        transfer: bool = False,
    ) -> WorkflowResult:
        call.status = status
        call.outcome = outcome
        call.summary = summary
        call.ended_at = datetime.now(timezone.utc)
        if transfer and actions:
            actions[-1].transfer = True
            actions[-1].end_call = False
        elif actions:
            actions[-1].end_call = True

        record_audit(
            self.db,
            business_id=business.id,
            call_id=call.id,
            event_type="call_completed",
            detail={"outcome": outcome, "status": status},
        )

        if notify:
            send_owner_notification(
                self.db,
                business=business,
                call=call,
                channel=self.notifier,
                lead=lead,
                urgent=urgent,
                extra=notify_extra,
            )

        self.db.commit()
        self.db.refresh(call)
        return WorkflowResult(call=call, actions=actions, lead=lead)

    def _capture_lead(self, business: Business, call: Call, script: ScriptedCallInput) -> Lead:
        extracted = self.llm.extract_lead_fields(script.utterance, known=script.lead)
        lead = Lead(
            business_id=business.id,
            call_id=call.id,
            name=extracted.name or str(script.lead.get("name", "")),
            callback_number=extracted.callback_number
            or str(script.lead.get("callback_number", call.from_number)),
            service_address=extracted.service_address or str(script.lead.get("service_address", "")),
            city=extracted.city or str(script.lead.get("city", "")),
            service_type_slug=extracted.service_type_slug or str(script.lead.get("service_type_slug", "")),
            description=extracted.description or script.utterance,
            preferred_window_start=script.preferred_window_start
            or (
                datetime.fromisoformat(script.lead["preferred_window_start"])
                if script.lead.get("preferred_window_start")
                else datetime.now(timezone.utc)
            ),
            preferred_window_end=script.preferred_window_end
            or (
                datetime.fromisoformat(script.lead["preferred_window_end"])
                if script.lead.get("preferred_window_end")
                else datetime.now(timezone.utc) + timedelta(days=7)
            ),
            status="qualified",
        )
        self.db.add(lead)
        self.db.flush()
        record_audit(
            self.db,
            business_id=business.id,
            call_id=call.id,
            event_type="lead_captured",
            detail={"lead_id": str(lead.id)},
        )
        return lead

    def _run(self, business: Business, call: Call, script: ScriptedCallInput) -> WorkflowResult:
        business = (
            self.db.query(Business)
            .options(
                joinedload(Business.hours),
                joinedload(Business.service_types),
                joinedload(Business.knowledge_base),
                joinedload(Business.escalation_rules),
            )
            .filter(Business.id == business.id)
            .one()
        )

        _ = build_system_prompt(business, list(business.service_types))
        actions: list[VoiceAction] = []

        # 1. Disclosure
        intro = (
            f"Hi, you've reached {business.name}. I'm the automated assistant. "
            f"{business.disclosure_message}"
        )
        actions.append(self._say(call, intro, stage="disclosure"))
        self._add_turn(call, "assistant", intro)
        record_audit(
            self.db, business_id=business.id, call_id=call.id, event_type="disclosure_played", detail={}
        )

        # Consent
        call.recording_consent = script.recording_consent
        call.transcript_consent = script.transcript_consent
        if script.recording_consent is False or script.transcript_consent is False:
            msg = (
                "Understood — I won't record or keep a transcript of this call. "
                "A team member will follow up with you shortly. Goodbye."
            )
            actions.append(self._say(call, msg, stage="consent_refused"))
            self._add_turn(call, "assistant", msg)
            # Still notify owner that someone called and refused consent
            return self._finalize(
                business,
                call,
                actions,
                status=CallStatus.COMPLETED.value,
                outcome=CallOutcome.REFUSED_CONSENT.value,
                summary="Caller refused recording/transcription; follow-up required.",
                urgent=True,
                notify_extra="Caller refused recording or transcription consent.",
            )

        utterance = script.utterance or "I need help"
        self._add_turn(call, "caller", utterance)

        # 2. Intent
        intent_result = self.llm.classify_intent(utterance)
        intent = intent_result.intent
        call.intent = intent.value
        record_audit(
            self.db,
            business_id=business.id,
            call_id=call.id,
            event_type="intent_detected",
            detail={"intent": intent.value, "confidence": intent_result.confidence},
        )

        # Diagnosis guard
        diag = never_diagnose(utterance)
        if diag:
            actions.append(self._say(call, diag.message, stage="no_diagnosis"))

        # Escalation rules
        esc = evaluate_escalation(
            intent=intent,
            utterance=utterance,
            rules=list(business.escalation_rules),
            angry=script.angry,
        )
        if esc.escalate:
            lead = self._capture_lead(business, call, script) if script.lead or utterance else None
            msg = (
                "This sounds urgent — I'm connecting you with our on-call team right away. "
                "Please stay on the line."
            )
            if intent == Intent.SPEAK_TO_HUMAN:
                msg = "Of course — I'll transfer you to a team member now."
            actions.append(self._say(call, msg, stage="escalate", reason=esc.reason))
            self._add_turn(call, "assistant", msg)
            return self._finalize(
                business,
                call,
                actions,
                status=CallStatus.ESCALATED.value,
                outcome=CallOutcome.ESCALATED.value,
                summary=f"Escalated: {esc.reason}",
                lead=lead,
                urgent=True,
                transfer=True,
                notify_extra=f"Escalation reason: {esc.reason}",
            )

        # Price quote refusal
        price_rule = never_quote_price(intent)
        if price_rule:
            actions.append(self._say(call, price_rule.message, stage="no_quote"))
            self._add_turn(call, "assistant", price_rule.message)
            lead = self._capture_lead(business, call, script) if script.lead else None
            # Offer path: if they also provided booking fields, continue; else end with lead capture
            if not script.lead.get("service_type_slug"):
                follow = "Would you like me to book a service visit instead? A team member can also call you back."
                actions.append(self._say(call, follow, stage="no_quote_followup"))
                return self._finalize(
                    business,
                    call,
                    actions,
                    status=CallStatus.COMPLETED.value,
                    outcome=CallOutcome.REFUSED_QUOTE.value,
                    summary="Caller asked for a price quote; declined to quote; offered booking/callback.",
                    lead=lead,
                )

        # General / unknown questions via KB
        if intent in {Intent.GENERAL_QUESTION, Intent.UNKNOWN, Intent.EXISTING_BOOKING}:
            faq = match_faq(list(business.knowledge_base), utterance)
            if faq:
                actions.append(self._say(call, faq.answer, stage="faq"))
                self._add_turn(call, "assistant", faq.answer)
                return self._finalize(
                    business,
                    call,
                    actions,
                    status=CallStatus.COMPLETED.value,
                    outcome=CallOutcome.ANSWERED_FAQ.value,
                    summary=f"Answered FAQ: {faq.question}",
                )
            msg = (
                "I'm not sure about that. I'll have a team member follow up with you. "
                "Thanks for calling."
            )
            actions.append(self._say(call, msg, stage="unknown"))
            self._add_turn(call, "assistant", msg)
            lead = self._capture_lead(business, call, script)
            return self._finalize(
                business,
                call,
                actions,
                status=CallStatus.COMPLETED.value,
                outcome=CallOutcome.UNKNOWN.value,
                summary="Unknown/out-of-scope question; lead captured for follow-up.",
                lead=lead,
                urgent=False,
                notify_extra="Unknown question — please follow up.",
            )

        # New service booking path
        lead = self._capture_lead(business, call, script)
        service = (
            self.db.query(ServiceType)
            .filter(
                ServiceType.business_id == business.id,
                ServiceType.slug == lead.service_type_slug,
            )
            .one_or_none()
        )
        bookable_err = service_is_bookable(service)
        if bookable_err:
            actions.append(self._say(call, bookable_err.message, stage="not_bookable"))
            return self._finalize(
                business,
                call,
                actions,
                status=CallStatus.COMPLETED.value,
                outcome=CallOutcome.LEAD_CAPTURED.value,
                summary=bookable_err.message,
                lead=lead,
                urgent=bookable_err.escalate,
                notify_extra=bookable_err.code,
            )

        assert service is not None

        # Never promise until availability confirmed
        gather_msg = (
            f"Thanks {lead.name or 'there'}. I have your request for {service.name} "
            f"at {lead.service_address}, {lead.city}. Let me check availability — "
            "I won't book anything until we confirm a time."
        )
        actions.append(self._say(call, gather_msg, stage="pre_availability"))
        self._add_turn(call, "assistant", gather_msg)

        if not script.confirm_booking:
            msg = "No problem. I've saved your details and someone will call you back to schedule."
            actions.append(self._say(call, msg, stage="not_confirmed"))
            lead.status = "follow_up"
            return self._finalize(
                business,
                call,
                actions,
                status=CallStatus.COMPLETED.value,
                outcome=CallOutcome.LEAD_CAPTURED.value,
                summary="Lead captured; caller did not confirm booking.",
                lead=lead,
            )

        # Confirm aloud before create (scripted confirmation)
        # First check availability without creating
        from app.services.booking import _parse_window
        from app.services.business_rules import hours_tuples

        window_start, window_end = _parse_window(lead.preferred_window_start, lead.preferred_window_end)
        try:
            slots = self.calendar.find_availability(
                window_start=window_start,
                window_end=window_end,
                duration_minutes=service.duration_minutes,
                business_hours=hours_tuples(list(business.hours)),
            )
        except Exception as exc:  # CalendarError and unexpected
            record_audit(
                self.db,
                business_id=business.id,
                call_id=call.id,
                event_type="calendar_availability_error",
                detail={"error": str(exc)},
            )
            msg = (
                "I'm having trouble checking the calendar right now. "
                "I've saved your details and a team member will follow up shortly."
            )
            actions.append(self._say(call, msg, stage="calendar_failure"))
            lead.status = "follow_up"
            return self._finalize(
                business,
                call,
                actions,
                status=CallStatus.FAILED.value,
                outcome=CallOutcome.LEAD_CAPTURED.value,
                summary="Calendar failure during availability check; lead captured.",
                lead=lead,
                urgent=True,
                notify_extra=f"Calendar error: {exc}",
            )

        if not slots:
            msg = (
                "I don't see an open slot in your preferred window. "
                "I've saved your request and our team will call you back to schedule."
            )
            actions.append(self._say(call, msg, stage="no_availability"))
            lead.status = "follow_up"
            return self._finalize(
                business,
                call,
                actions,
                status=CallStatus.COMPLETED.value,
                outcome=CallOutcome.LEAD_CAPTURED.value,
                summary="No calendar availability; lead captured for follow-up.",
                lead=lead,
                notify_extra="No availability in preferred window.",
            )

        slot = slots[0]
        confirm_msg = (
            f"I can offer {slot.starts_at.strftime('%A %B %d at %I:%M %p')}. "
            f"To confirm: {service.name} for {lead.name} at {lead.service_address}, {lead.city}, "
            f"callback {lead.callback_number}. Shall I book that?"
        )
        actions.append(self._say(call, confirm_msg, stage="confirm_aloud"))
        self._add_turn(call, "assistant", confirm_msg)
        self._add_turn(call, "caller", "yes" if script.confirm_booking else "no")

        appt_key = f"appt:{call.idempotency_key}"
        result = book_appointment(
            self.db,
            business=business,
            call=call,
            lead=lead,
            service=service,
            calendar=self.calendar,
            idempotency_key=appt_key,
            confirmation_spoken=True,
        )

        if result.no_availability:
            msg = (
                "That slot just filled. I've saved your details and someone will follow up."
            )
            actions.append(self._say(call, msg, stage="no_availability_race"))
            return self._finalize(
                business,
                call,
                actions,
                status=CallStatus.COMPLETED.value,
                outcome=CallOutcome.LEAD_CAPTURED.value,
                summary="Availability lost before booking; lead captured.",
                lead=lead,
            )

        if not result.success:
            msg = (
                "I wasn't able to finish booking on the calendar. "
                "I've captured your information and a team member will follow up right away."
            )
            actions.append(self._say(call, msg, stage="booking_failure"))
            lead.status = "follow_up"
            call.error_detail = result.error
            return self._finalize(
                business,
                call,
                actions,
                status=CallStatus.FAILED.value,
                outcome=CallOutcome.LEAD_CAPTURED.value,
                summary=f"Booking failed: {result.error}",
                lead=lead,
                urgent=True,
                notify_extra=f"Booking/calendar error: {result.error}",
            )

        booked_msg = (
            f"You're booked for {result.appointment.starts_at.strftime('%A %B %d at %I:%M %p')}. "
            "We'll see you then. Goodbye."
        )
        actions.append(self._say(call, booked_msg, stage="booked"))
        self._add_turn(call, "assistant", booked_msg)
        return self._finalize(
            business,
            call,
            actions,
            status=CallStatus.COMPLETED.value,
            outcome=CallOutcome.BOOKED.value,
            summary=f"Booked {service.name} at {result.appointment.starts_at.isoformat()}",
            lead=lead,
        )
