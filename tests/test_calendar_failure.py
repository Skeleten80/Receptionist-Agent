from app.providers.calendar import MockCalendarProvider
from app.services.call_workflow import CallWorkflow
from helpers import run_script
from app.db.models import Appointment, CallOutcome, Notification


def test_calendar_provider_failure(db, business, llm, notifier, booking_lead):
    calendar = MockCalendarProvider(fail_on_availability=True)
    workflow = CallWorkflow(db, llm=llm, calendar=calendar, notifier=notifier)
    result = run_script(
        workflow,
        business,
        utterance="Please book HVAC repair for me.",
        lead={
            **booking_lead,
            "service_type_slug": "hvac-repair",
            "description": "Noisy outdoor unit",
        },
    )
    assert result.call.outcome == CallOutcome.LEAD_CAPTURED.value
    assert result.call.status == "failed"
    assert db.query(Appointment).filter(Appointment.call_id == result.call.id).count() == 0
    assert any("trouble checking the calendar" in a.say.lower() for a in result.actions)
    notes = db.query(Notification).filter(Notification.call_id == result.call.id).all()
    assert notes  # owner notified immediately
