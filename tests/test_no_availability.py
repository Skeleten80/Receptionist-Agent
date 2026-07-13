from app.providers.calendar import MockCalendarProvider
from app.providers.llm import MockLLMProvider
from app.providers.notify import EmailNotifier
from app.services.call_workflow import CallWorkflow
from helpers import run_script
from app.db.models import Appointment, CallOutcome


def test_calendar_has_no_availability(db, business, llm, notifier, booking_lead):
    calendar = MockCalendarProvider(available=False)
    workflow = CallWorkflow(db, llm=llm, calendar=calendar, notifier=notifier)
    result = run_script(
        workflow,
        business,
        utterance="I need furnace repair this week.",
        lead={
            **booking_lead,
            "service_type_slug": "furnace-repair",
            "description": "Furnace noisy",
        },
    )
    assert result.call.outcome == CallOutcome.LEAD_CAPTURED.value
    assert db.query(Appointment).filter(Appointment.call_id == result.call.id).count() == 0
    assert any("don't see an open slot" in a.say.lower() or "open slot" in a.say.lower() for a in result.actions)
