from helpers import run_script
from app.db.models import CallOutcome, CallTranscript


def test_caller_refuses_recording_transcription(workflow, business, db):
    result = run_script(
        workflow,
        business,
        utterance="I need help with my furnace.",
        lead={},
        recording_consent=False,
        transcript_consent=False,
    )
    assert result.call.outcome == CallOutcome.REFUSED_CONSENT.value
    assert result.call.recording_consent is False
    assert result.call.transcript_consent is False
    assert any("won't record" in a.say.lower() or "will follow up" in a.say.lower() for a in result.actions)
    # No full conversation transcript should be stored after refusal (only disclosure may exist
    # before consent check — workflow skips caller turn when consent refused)
    transcript = db.query(CallTranscript).filter(CallTranscript.call_id == result.call.id).one_or_none()
    if transcript:
        roles = {t.get("role") for t in transcript.turns}
        assert "caller" not in roles
