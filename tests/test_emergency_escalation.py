from helpers import run_script
from app.db.models import CallOutcome


def test_emergency_gas_smell_escalation(workflow, business):
    result = run_script(
        workflow,
        business,
        utterance="I smell gas near the furnace and I'm worried.",
        lead={
            "name": "Sam",
            "callback_number": "+15195550111",
            "service_address": "12 Erie St",
            "city": "Stratford",
            "service_type_slug": "furnace-repair",
            "description": "Gas smell",
        },
    )
    assert result.call.outcome == CallOutcome.ESCALATED.value
    assert result.call.status == "escalated"
    assert result.call.intent == "emergency"
    assert any(a.transfer for a in result.actions)
    assert any("urgent" in a.say.lower() or "connecting" in a.say.lower() for a in result.actions)
