from __future__ import annotations

from app.db.models import Business, KnowledgeBaseEntry, ServiceType


DEFAULT_PROMPT_TEMPLATE = """You are the automated phone assistant for {business_name}.
Service area: {service_area}.
Be warm, brief, local, and practical—not chatty.
Never diagnose technical issues. Never quote custom prices.
Never promise an appointment until calendar availability is confirmed.
Always escalate emergencies, safety risks, pricing disputes, angry callers,
uncertain requests, or requests for a human.
Bookable services: {services}.
Disclosure: {disclosure}
"""


def build_system_prompt(business: Business, services: list[ServiceType]) -> str:
    template = business.prompt_template or DEFAULT_PROMPT_TEMPLATE
    service_list = ", ".join(s.name for s in services if s.active and s.bookable) or "none configured"
    return template.format(
        business_name=business.name,
        service_area=business.service_area,
        services=service_list,
        disclosure=business.disclosure_message,
    )


def match_faq(entries: list[KnowledgeBaseEntry], question: str) -> KnowledgeBaseEntry | None:
    q = question.lower()
    best: KnowledgeBaseEntry | None = None
    best_score = 0
    for entry in entries:
        if not entry.active:
            continue
        tokens = [t for t in entry.question.lower().replace("?", "").split() if len(t) > 3]
        score = sum(1 for t in tokens if t in q)
        if score > best_score:
            best_score = score
            best = entry
    if best_score >= 2:
        return best
    # exact substring fallback
    for entry in entries:
        if entry.active and entry.question.lower().rstrip("?") in q:
            return entry
    return None
