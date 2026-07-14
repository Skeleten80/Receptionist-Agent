from helpers import run_script
from app.db.models import CallOutcome


def test_caller_asks_for_price_quote(workflow, business):
    result = run_script(
        workflow,
        business,
        utterance="How much does a furnace repair cost? Can you give me a price quote?",
        lead={},
    )
    assert result.call.outcome == CallOutcome.REFUSED_QUOTE.value
    assert any("can't provide a custom price" in a.say.lower() or "cannot provide" in a.say.lower() or "can't provide" in a.say.lower() for a in result.actions)
    assert result.call.intent == "price_quote"
