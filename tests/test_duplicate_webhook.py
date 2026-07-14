from helpers import run_script
from app.db.models import Call


def test_duplicate_provider_webhook(workflow, business, booking_lead, db):
    key = "dup-webhook-key-001"
    first = run_script(
        workflow,
        business,
        utterance="My AC isn't cooling. Book AC repair.",
        lead=booking_lead,
        key=key,
    )
    second = run_script(
        workflow,
        business,
        utterance="My AC isn't cooling. Book AC repair.",
        lead=booking_lead,
        key=key,
    )
    assert first.duplicate_webhook is False
    assert second.duplicate_webhook is True
    assert first.call.id == second.call.id
    assert db.query(Call).filter(Call.idempotency_key == key).count() == 1
