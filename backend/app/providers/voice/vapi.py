from __future__ import annotations

from typing import Any

from app.providers.voice.base import VoiceAction, VoiceProvider, VoiceWebhookEvent


class VapiVoiceProvider(VoiceProvider):
    name = "vapi"

    def parse_webhook(self, body: dict[str, Any], headers: dict[str, str]) -> VoiceWebhookEvent:
        message = body.get("message", body)
        call = message.get("call", body.get("call", {}))
        call_id = str(call.get("id") or body.get("call_id") or "")
        return VoiceWebhookEvent(
            provider=self.name,
            provider_call_id=call_id,
            idempotency_key=str(body.get("idempotency_key") or call_id),
            from_number=str(call.get("customer", {}).get("number") or body.get("from_number", "")),
            to_number=str(call.get("phoneNumber", {}).get("number") or body.get("to_number", "")),
            event_type=str(message.get("type") or body.get("event_type") or "inbound"),
            payload=body,
        )

    def format_response(self, actions: list[VoiceAction]) -> dict[str, Any]:
        return {
            "provider": self.name,
            "results": [
                {"speak": a.say, "transfer": a.transfer, "endCall": a.end_call} for a in actions
            ],
        }
