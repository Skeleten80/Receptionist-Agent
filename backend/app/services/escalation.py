from __future__ import annotations

from dataclasses import dataclass

from app.db.models import EscalationRule, Intent


@dataclass
class EscalationDecision:
    escalate: bool
    reason: str
    action: str = "transfer"
    rule_name: str | None = None


def evaluate_escalation(
    *,
    intent: Intent,
    utterance: str,
    rules: list[EscalationRule],
    angry: bool = False,
) -> EscalationDecision:
    text = utterance.lower()
    if angry:
        return EscalationDecision(True, "angry_caller", "transfer")
    if intent in {Intent.EMERGENCY, Intent.SPEAK_TO_HUMAN, Intent.OUT_OF_SCOPE}:
        return EscalationDecision(True, f"intent:{intent.value}", "transfer")

    active = sorted([r for r in rules if r.active], key=lambda r: r.priority)
    for rule in active:
        if rule.intent_match and rule.intent_match == intent.value:
            return EscalationDecision(True, f"rule_intent:{rule.name}", rule.action, rule.name)
        for kw in rule.trigger_keywords or []:
            if str(kw).lower() in text:
                return EscalationDecision(True, f"rule_keyword:{rule.name}", rule.action, rule.name)
    return EscalationDecision(False, "none")
