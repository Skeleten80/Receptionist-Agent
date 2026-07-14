from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

from app.config import Settings


@dataclass
class NotifyResult:
    success: bool
    provider_message_id: Optional[str] = None
    error: Optional[str] = None


class NotificationChannel(ABC):
    channel: str

    @abstractmethod
    def send(self, *, recipient: str, subject: str, body: str) -> NotifyResult:
        raise NotImplementedError


class EmailNotifier(NotificationChannel):
    channel = "email"

    def __init__(
        self,
        *,
        smtp_host: str,
        smtp_port: int,
        smtp_user: str,
        smtp_password: str,
        smtp_from: str,
        dry_run: bool = True,
        fail: bool = False,
    ) -> None:
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password
        self.smtp_from = smtp_from
        self.dry_run = dry_run
        self.fail = fail

    def send(self, *, recipient: str, subject: str, body: str) -> NotifyResult:
        if self.fail:
            return NotifyResult(success=False, error="Email provider failure")
        if self.dry_run or not self.smtp_host:
            return NotifyResult(success=True, provider_message_id="dry-run-email")
        # Real SMTP can be wired here without changing call-path consumers.
        try:
            import smtplib
            from email.message import EmailMessage

            msg = EmailMessage()
            msg["From"] = self.smtp_from
            msg["To"] = recipient
            msg["Subject"] = subject
            msg.set_content(body)
            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=15) as smtp:
                smtp.starttls()
                if self.smtp_user:
                    smtp.login(self.smtp_user, self.smtp_password)
                smtp.send_message(msg)
            return NotifyResult(success=True, provider_message_id="smtp-sent")
        except Exception as exc:  # noqa: BLE001 — surface as NotifyResult
            return NotifyResult(success=False, error=str(exc))


class SmsNotifierStub(NotificationChannel):
    """Interface stub for future SMS support — not used in MVP send path."""

    channel = "sms"

    def send(self, *, recipient: str, subject: str, body: str) -> NotifyResult:
        return NotifyResult(success=False, error="SMS channel not enabled in MVP")


def get_email_notifier(settings: Settings, *, fail: bool = False) -> EmailNotifier:
    return EmailNotifier(
        smtp_host=settings.smtp_host,
        smtp_port=settings.smtp_port,
        smtp_user=settings.smtp_user,
        smtp_password=settings.smtp_password,
        smtp_from=settings.smtp_from,
        dry_run=settings.notify_email_dry_run,
        fail=fail,
    )
