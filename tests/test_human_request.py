from helpers import run_script
from app.db.models import CallOutcome


def test_caller_asks_for_human(workflow, business):
    result = run_script(
        workflow,
        business,
        utterance="I need to speak to a person please.",
        lead={"name": "Alex", "callback_number": "+15195550122"},
    )
    assert result.call.outcome == CallOutcome.ESCALATED.value
    assert result.call.intent == "speak_to_human"
    assert any(a.transfer for a in result.actions)
    assert any("transfer" in a.say.lower() for a in result.actions)
