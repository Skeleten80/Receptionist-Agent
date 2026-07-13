from helpers import run_script
from app.db.models import Appointment, CallOutcome, Notification


def test_successful_hvac_appointment_booking(workflow, business, booking_lead, db):
    result = run_script(
        workflow,
        business,
        utterance="My AC isn't cooling. I'd like to book an AC repair appointment.",
        lead=booking_lead,
    )
    assert result.call.outcome == CallOutcome.BOOKED.value
    assert result.call.status == "completed"
    appts = db.query(Appointment).filter(Appointment.call_id == result.call.id).all()
    assert len(appts) == 1
    assert appts[0].status == "confirmed"
    assert appts[0].confirmation_spoken is True
    assert any("booked" in a.say.lower() for a in result.actions)
    notes = db.query(Notification).filter(Notification.call_id == result.call.id).all()
    assert notes and notes[0].status == "sent"
