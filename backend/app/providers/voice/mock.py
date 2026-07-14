from __future__ import annotations

from typing import Any

from app.providers.voice.base import VoiceAction, VoiceProvider, VoiceWebhookEvent


class MockVoiceProvider(VoiceProvider):
    name = "mock"

    def parse_webhook(self, body: dict[str, Any], headers: dict[str, str]) -> VoiceWebhookEvent:
        call_id = str(body.get("call_id") or body.get("provider_call_id") or "mock-call")
        idem = str(body.get("idempotency_key") or call_id)
        return VoiceWebhookEvent(
            provider=self.name,
            provider_call_id=call_id,
            idempotency_key=idem,
            from_number=str(body.get("from_number", "")),
            to_number=str(body.get("to_number", "")),
            event_type=str(body.get("event_type", "inbound")),
            payload=body,
        )

    def format_response(self, actions: list[VoiceAction]) -> dict[str, Any]:
        return {
            "provider": self.name,
            "actions": [
                {
                    "say": a.say,
                    "transfer": a.transfer,
                    "end_call": a.end_call,
                    "metadata": a.metadata,
                }
                for a in actions
            ],
        }
