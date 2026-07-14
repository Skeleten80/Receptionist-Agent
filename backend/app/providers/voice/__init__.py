from app.providers.voice.base import VoiceAction, VoiceProvider, VoiceWebhookEvent
from app.providers.voice.mock import MockVoiceProvider
from app.providers.voice.retell import RetellVoiceProvider
from app.providers.voice.vapi import VapiVoiceProvider

__all__ = [
    "VoiceAction",
    "VoiceProvider",
    "VoiceWebhookEvent",
    "MockVoiceProvider",
    "RetellVoiceProvider",
    "VapiVoiceProvider",
    "get_voice_provider",
]


def get_voice_provider(name: str) -> VoiceProvider:
    mapping: dict[str, type[VoiceProvider]] = {
        "mock": MockVoiceProvider,
        "retell": RetellVoiceProvider,
        "vapi": VapiVoiceProvider,
    }
    cls = mapping.get(name.lower(), MockVoiceProvider)
    return cls()
