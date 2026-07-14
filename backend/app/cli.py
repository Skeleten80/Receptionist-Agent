from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.config import get_settings
from app.db.session import SessionLocal
from app.providers.calendar import MockCalendarProvider, get_calendar_provider
from app.providers.llm import get_llm_provider
from app.providers.notify import get_email_notifier
from app.api.simulation import SCRIPTS
from app.seed.demo_business import seed_demo_business
from app.services.call_workflow import CallWorkflow, ScriptedCallInput


def cmd_simulate(script_name: str) -> None:
    settings = get_settings()
    db = SessionLocal()
    try:
        business = seed_demo_business(db)
        preset = SCRIPTS.get(script_name)
        if not preset:
            raise SystemExit(f"Unknown script: {script_name}. Options: {', '.join(SCRIPTS)}")
        now = datetime.now(timezone.utc)
        script = ScriptedCallInput(
            utterance=str(preset.get("utterance", "")),
            recording_consent=bool(preset.get("recording_consent", True)),
            transcript_consent=bool(preset.get("transcript_consent", True)),
            lead=dict(preset.get("lead") or {}),
            confirm_booking=True,
            preferred_window_start=now,
            preferred_window_end=now + timedelta(days=7),
        )
        calendar_mode = preset.get("calendar")
        if calendar_mode == "empty":
            calendar = MockCalendarProvider(available=False)
        elif calendar_mode == "fail":
            calendar = MockCalendarProvider(fail_on_create=True, fail_on_availability=True)
        else:
            calendar = get_calendar_provider(settings)
        notifier = get_email_notifier(settings, fail=bool(preset.get("notify_fail")))
        workflow = CallWorkflow(
            db,
            llm=get_llm_provider(settings),
            calendar=calendar,
            notifier=notifier,
        )
        result = workflow.run_scripted(business, script, call_key=f"cli-{script_name}-{uuid4().hex[:8]}")
        print(f"outcome={result.call.outcome} status={result.call.status} call_id={result.call.id}")
        for action in result.actions:
            print(f"  ASSISTANT: {action.say}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(prog="local-ai-business-agent")
    sub = parser.add_subparsers(dest="command", required=True)
    sim = sub.add_parser("simulate", help="Run a scripted fake call")
    sim.add_argument(
        "--script",
        required=True,
        help="Script name (booking_success, emergency_gas, ...)",
    )
    args = parser.parse_args()
    if args.command == "simulate":
        cmd_simulate(args.script)


if __name__ == "__main__":
    main()
