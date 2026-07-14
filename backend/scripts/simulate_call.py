#!/usr/bin/env python3
"""CLI wrapper: python backend/scripts/simulate_call.py booking_success"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.cli import cmd_simulate


if __name__ == "__main__":
    script = sys.argv[1] if len(sys.argv) > 1 else "booking_success"
    cmd_simulate(script)
