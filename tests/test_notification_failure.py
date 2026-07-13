from app.providers.notify import EmailNotifier
from app.services.call_workflow import CallWorkflow
from helpers import run_script
from app.db.models import Appointment, CallOutcome, Notification


def test_owner_notification_failure(db, business, llm, calendar, booking_lead):
    notifier = EmailNotifier(
        smtp_host="smtp.example.com",
        smtp_port=587,
        smtp_user="u",
        smtp_password="p",
        smtp_from="noreply@example.com",
        dry_run=False,
        fail=True,
    )
    workflow = CallWorkflow(db, llm=llm, calendar=calendar, notifier=notifier)
    result = run_script(
        workflow,
        business,
        utterance="My AC isn't cooling. Book an AC repair please.",
        lead=booking_lead,
    )
    # Booking still succeeds; notification failure is recorded
    assert result.call.outcome == CallOutcome.BOOKED.value
    assert db.query(Appointment).filter(Appointment.call_id == result.call.id).count() == 1
    notes = db.query(Notification).filter(Notification.call_id == result.call.id).all()
    assert notes
    assert notes[0].status == "failed"
    assert notes[0].error_detail
