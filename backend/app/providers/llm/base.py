from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Optional

from app.config import Settings
from app.db.models import Intent


@dataclass
class IntentResult:
    intent: Intent
    confidence: float
    rationale: str = ""


@dataclass
class ExtractedLead:
    name: str = ""
    callback_number: str = ""
    service_address: str = ""
    city: str = ""
    service_type_slug: str = ""
    description: str = ""
    preferred_window_text: str = ""


class LLMProvider(ABC):
    name: str

    @abstractmethod
    def classify_intent(self, utterance: str, *, context: dict[str, Any] | None = None) -> IntentResult:
        raise NotImplementedError

    @abstractmethod
    def extract_lead_fields(self, utterance: str, *, known: dict[str, Any] | None = None) -> ExtractedLead:
        raise NotImplementedError


class MockLLMProvider(LLMProvider):
    """Rule-based classifier for deterministic tests and local mock mode."""

    name = "mock"

    EMERGENCY_KEYWORDS = (
        "gas smell",
        "smell gas",
        "carbon monoxide",
        "co detector",
        "fire",
        "smoke",
        "no heat",
        "freezing",
        "explosion",
    )
    HUMAN_KEYWORDS = ("speak to a person", "real person", "human", "manager", "operator", "transfer")
    PRICE_KEYWORDS = ("how much", "price", "quote", "estimate", "cost", "pricing")
    EXISTING_KEYWORDS = ("existing appointment", "reschedule", "cancel my", "my booking")
    SERVICE_KEYWORDS = ("repair", "ac", "furnace", "hvac", "maintenance", "appointment", "book", "service")

    def classify_intent(self, utterance: str, *, context: dict[str, Any] | None = None) -> IntentResult:
        text = utterance.lower()
        if any(k in text for k in self.EMERGENCY_KEYWORDS):
            return IntentResult(Intent.EMERGENCY, 0.95, "emergency keyword")
        if any(k in text for k in self.HUMAN_KEYWORDS):
            return IntentResult(Intent.SPEAK_TO_HUMAN, 0.9, "human request")
        if any(k in text for k in self.PRICE_KEYWORDS):
            return IntentResult(Intent.PRICE_QUOTE, 0.9, "price request")
        if any(k in text for k in self.EXISTING_KEYWORDS):
            return IntentResult(Intent.EXISTING_BOOKING, 0.85, "existing booking")
        if any(k in text for k in self.SERVICE_KEYWORDS):
            return IntentResult(Intent.NEW_SERVICE, 0.85, "service request")
        if "?" in text or text.startswith(("what", "when", "where", "do you", "are you")):
            return IntentResult(Intent.GENERAL_QUESTION, 0.7, "question")
        return IntentResult(Intent.UNKNOWN, 0.4, "unknown")

    def extract_lead_fields(self, utterance: str, *, known: dict[str, Any] | None = None) -> ExtractedLead:
        known = known or {}
        lead = ExtractedLead(
            name=str(known.get("name", "")),
            callback_number=str(known.get("callback_number", "")),
            service_address=str(known.get("service_address", "")),
            city=str(known.get("city", "")),
            service_type_slug=str(known.get("service_type_slug", "")),
            description=str(known.get("description", "")),
            preferred_window_text=str(known.get("preferred_window_text", "")),
        )
        # Simulation scripts pass structured fields via known; utterance is supplemental.
        if not lead.description and utterance:
            lead.description = utterance[:500]
        return lead


class OpenAICompatLLMProvider(LLMProvider):
    """Hosted OpenAI-compatible chat completions for intent/extraction (optional)."""

    name = "openai_compat"

    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model

    def classify_intent(self, utterance: str, *, context: dict[str, Any] | None = None) -> IntentResult:
        # Fallback to mock rules if no key — never block the call path.
        if not self.api_key:
            return MockLLMProvider().classify_intent(utterance, context=context)
        try:
            import httpx

            system = (
                "Classify the caller utterance into one intent: "
                "new_service, existing_booking, emergency, general_question, "
                "speak_to_human, price_quote, unknown, out_of_scope. "
                'Respond JSON: {"intent":"...","confidence":0.0,"rationale":"..."}'
            )
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": utterance},
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0,
                    },
                )
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"]
                import json

                data = json.loads(content)
                return IntentResult(
                    intent=Intent(data.get("intent", "unknown")),
                    confidence=float(data.get("confidence", 0.5)),
                    rationale=str(data.get("rationale", "")),
                )
        except Exception:
            return MockLLMProvider().classify_intent(utterance, context=context)

    def extract_lead_fields(self, utterance: str, *, known: dict[str, Any] | None = None) -> ExtractedLead:
        return MockLLMProvider().extract_lead_fields(utterance, known=known)


def get_llm_provider(settings: Settings, *, override: LLMProvider | None = None) -> LLMProvider:
    if override is not None:
        return override
    if settings.llm_provider == "openai_compat":
        return OpenAICompatLLMProvider(settings.llm_api_key, settings.llm_base_url, settings.llm_model)
    return MockLLMProvider()
