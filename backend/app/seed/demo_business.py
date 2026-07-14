from __future__ import annotations

import hashlib
import hmac
from datetime import time

from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import (
    Business,
    BusinessHours,
    EscalationRule,
    KnowledgeBaseEntry,
    ServiceType,
)
from app.db.session import SessionLocal
from app.services.prompt_builder import DEFAULT_PROMPT_TEMPLATE


DEMO_API_KEY = "demo-api-key-stratford-comfort"

DISCLOSURE = (
    "This call may be recorded and transcribed to help us assist you."
)


def _hash_key(raw: str, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), raw.encode("utf-8"), hashlib.sha256).hexdigest()


def seed_demo_business(db: Session) -> Business:
    settings = get_settings()
    api_key = settings.admin_api_key_bootstrap or DEMO_API_KEY
    key_hash = _hash_key(api_key, settings.secret_key)

    existing = db.query(Business).filter(Business.api_key_hash == key_hash).one_or_none()
    if existing:
        return existing

    # Also skip if same-named demo already exists under different key
    by_name = (
        db.query(Business)
        .filter(Business.name == "Stratford Comfort Heating & Air")
        .one_or_none()
    )
    if by_name:
        by_name.api_key_hash = key_hash
        db.commit()
        return by_name

    business = Business(
        name="Stratford Comfort Heating & Air",
        service_area="Stratford and Perth County",
        timezone="America/Toronto",
        disclosure_message=DISCLOSURE,
        owner_email="owner@stratfordcomfort.example",
        owner_phone="+15195550123",
        notification_email_enabled=True,
        notification_sms_enabled=False,
        recording_storage_enabled=False,
        api_key_hash=key_hash,
        voice_provider="mock",
        calendar_provider="mock",
        prompt_template=DEFAULT_PROMPT_TEMPLATE,
    )
    db.add(business)
    db.flush()

    for day in range(0, 5):  # Mon–Fri
        db.add(
            BusinessHours(
                business_id=business.id,
                day_of_week=day,
                open_time=time(8, 0),
                close_time=time(17, 0),
                is_closed=False,
            )
        )
    for day in (5, 6):
        db.add(
            BusinessHours(
                business_id=business.id,
                day_of_week=day,
                open_time=time(0, 0),
                close_time=time(0, 0),
                is_closed=True,
            )
        )

    services = [
        ("HVAC Repair", "hvac-repair", "General HVAC repair visit", 90),
        ("AC Repair", "ac-repair", "Air conditioning repair", 90),
        ("Furnace Repair", "furnace-repair", "Furnace repair visit", 90),
        ("Maintenance Appointment", "maintenance", "Seasonal maintenance", 60),
    ]
    for name, slug, desc, mins in services:
        db.add(
            ServiceType(
                business_id=business.id,
                name=name,
                slug=slug,
                description=desc,
                duration_minutes=mins,
                bookable=True,
                active=True,
            )
        )

    faqs = [
        (
            "What areas do you serve?",
            "We serve Stratford and Perth County.",
            "service_area",
        ),
        (
            "What are your business hours?",
            "We're open Monday to Friday, 8:00 AM to 5:00 PM. After hours, this assistant can take messages and book approved appointments.",
            "hours",
        ),
        (
            "Do you offer maintenance plans?",
            "Yes — we book maintenance appointments for heating and cooling systems. I can help schedule one.",
            "services",
        ),
    ]
    for q, a, cat in faqs:
        db.add(
            KnowledgeBaseEntry(
                business_id=business.id,
                question=q,
                answer=a,
                category=cat,
                active=True,
            )
        )

    db.add(
        EscalationRule(
            business_id=business.id,
            name="Safety / emergency",
            trigger_keywords=[
                "gas smell",
                "smell gas",
                "carbon monoxide",
                "co alarm",
                "fire",
                "smoke",
                "no heat",
                "freezing",
                "extreme cold",
            ],
            intent_match="emergency",
            action="transfer",
            priority=1,
            active=True,
        )
    )
    db.add(
        EscalationRule(
            business_id=business.id,
            name="Speak to human",
            trigger_keywords=["speak to a person", "real person", "manager"],
            intent_match="speak_to_human",
            action="transfer",
            priority=2,
            active=True,
        )
    )

    db.commit()
    db.refresh(business)
    return business


def main() -> None:
    settings = get_settings()
    if not settings.seed_demo:
        print("SEED_DEMO=false — skipping")
        return
    db = SessionLocal()
    try:
        biz = seed_demo_business(db)
        print(f"Demo business ready: {biz.name} ({biz.id})")
        print(f"Admin API key (bootstrap): {settings.admin_api_key_bootstrap}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
