from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import Business, Call, Lead, Notification
from app.providers.notify import NotificationChannel, NotifyResult
from app.services.audit import record_audit


def build_owner_summary(
    *,
    business: Business,
    call: Call,
    lead: Optional[Lead] = None,
    extra: str = "",
) -> tuple[str, str]:
    subject = f"[{business.name}] Call update — {call.outcome or call.status}"
    lines = [
        f"Business: {business.name}",
        f"Call ID: {call.id}",
        f"From: {call.from_number}",
        f"Intent: {call.intent or 'n/a'}",
        f"Outcome: {call.outcome or 'n/a'}",
        f"Status: {call.status}",
    ]
    if call.summary:
        lines.append(f"Summary: {call.summary}")
    if lead:
        lines.extend(
            [
                "",
                "Lead:",
                f"  Name: {lead.name}",
                f"  Phone: {lead.callback_number}",
                f"  Address: {lead.service_address}, {lead.city}",
                f"  Service: {lead.service_type_slug}",
                f"  Description: {lead.description}",
            ]
        )
    if extra:
        lines.extend(["", extra])
    return subject, "\n".join(lines)


def send_owner_notification(
    db: Session,
    *,
    business: Business,
    call: Call,
    channel: NotificationChannel,
    lead: Optional[Lead] = None,
    urgent: bool = False,
    extra: str = "",
) -> Notification:
    subject, body = build_owner_summary(business=business, call=call, lead=lead, extra=extra)
    if urgent:
        subject = f"[URGENT] {subject}"

    recipient = business.owner_email if channel.channel == "email" else (business.owner_phone or "")
    notification = Notification(
        business_id=business.id,
        call_id=call.id,
        channel=channel.channel,
        recipient=recipient,
        subject=subject,
        body=body,
        status="pending",
    )
    db.add(notification)
    db.flush()

    if channel.channel == "email" and not business.notification_email_enabled:
        notification.status = "failed"
        notification.error_detail = "email_notifications_disabled"
        record_audit(
            db,
            business_id=business.id,
            call_id=call.id,
            event_type="notification_skipped",
            detail={"channel": "email", "reason": "disabled"},
        )
        return notification

    if channel.channel == "sms" and not business.notification_sms_enabled:
        notification.status = "failed"
        notification.error_detail = "sms_notifications_disabled"
        return notification

    result: NotifyResult = channel.send(recipient=recipient, subject=subject, body=body)
    if result.success:
        notification.status = "sent"
        notification.sent_at = datetime.now(timezone.utc)
        record_audit(
            db,
            business_id=business.id,
            call_id=call.id,
            event_type="notification_sent",
            detail={"channel": channel.channel, "notification_id": str(notification.id)},
        )
    else:
        notification.status = "failed"
        notification.error_detail = result.error
        record_audit(
            db,
            business_id=business.id,
            call_id=call.id,
            event_type="notification_failed",
            detail={"channel": channel.channel, "error": result.error},
        )
    db.flush()
    return notification
