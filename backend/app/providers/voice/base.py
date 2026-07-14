from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


@dataclass
class VoiceWebhookEvent:
    provider: str
    provider_call_id: str
    idempotency_key: str
    from_number: str
    to_number: str
    event_type: str
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass
class VoiceAction:
    """Instruction returned to a voice provider or simulation runner."""

    say: str
    transfer: bool = False
    end_call: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)


class VoiceProvider(ABC):
    name: str

    @abstractmethod
    def parse_webhook(self, body: dict[str, Any], headers: dict[str, str]) -> VoiceWebhookEvent:
        raise NotImplementedError

    @abstractmethod
    def format_response(self, actions: list[VoiceAction]) -> dict[str, Any]:
        raise NotImplementedError
