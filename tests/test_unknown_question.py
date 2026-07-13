from helpers import run_script
from app.db.models import CallOutcome


def test_unknown_question(workflow, business):
    result = run_script(
        workflow,
        business,
        utterance="Do you install geothermal swimming pool heaters for barns?",
        lead={"name": "Pat", "callback_number": "+15195550155"},
    )
    assert result.call.outcome == CallOutcome.UNKNOWN.value
    assert any("not sure" in a.say.lower() or "follow up" in a.say.lower() for a in result.actions)
    assert result.lead is not None
