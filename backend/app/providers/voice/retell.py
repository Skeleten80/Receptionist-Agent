from __future__ import annotations

from typing import Any

from app.providers.voice.base import VoiceAction, VoiceProvider, VoiceWebhookEvent


class RetellVoiceProvider(VoiceProvider):
    name = "retell"

    def parse_webhook(self, body: dict[str, Any], headers: dict[str, str]) -> VoiceWebhookEvent:
        call = body.get("call", body)
        call_id = str(call.get("call_id") or body.get("call_id") or "")
        return VoiceWebhookEvent(
            provider=self.name,
            provider_call_id=call_id,
            idempotency_key=str(body.get("idempotency_key") or call_id),
            from_number=str(call.get("from_number") or body.get("from_number", "")),
            to_number=str(call.get("to_number") or body.get("to_number", "")),
            event_type=str(body.get("event") or body.get("event_type") or "inbound"),
            payload=body,
        )

    def format_response(self, actions: list[VoiceAction]) -> dict[str, Any]:
        # Retell agent response shape varies; return a stable adapter envelope.
        return {
            "provider": self.name,
            "response": [
                {"type": "transfer" if a.transfer else "speak", "content": a.say, "end_call": a.end_call}
                for a in actions
            ],
        }
