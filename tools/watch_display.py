#!/usr/bin/env python3
"""Keeps the IBM display going from the Mac (2026-10-24, at the festival: its USB plug is loose,
and every time it drops out the helper in Termux loses it and the display just shows "OK").

Every 10 s asks the game page (over Chrome's remote debugging, like rescue.py) whether it
reaches the display; after two misses in a row, restarts the helper in Termux and taps
Android's Allow-USB box. Logs one line per event to rescue-report/display-watch.log.
    python tools/watch_display.py
"""
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rescue  # noqa: E402

LOG = os.path.join(rescue.REPORT, "display-watch.log")


def note(text):
    os.makedirs(rescue.REPORT, exist_ok=True)
    line = time.strftime("%H:%M:%S ") + text
    print(line, flush=True)
    with open(LOG, "a") as f:
        f.write(line + "\n")


def main():
    misses, page = 0, None
    note("watching the display")
    while True:
        try:
            if not rescue.serial and not rescue.find_phone():
                note("phone not found"); time.sleep(30); continue
            page = page or rescue.open_page()
            st = rescue.status(page) if page else None
            if st is None:
                page = None
                note("game page not answering")
            elif st["display"]:
                if misses:
                    note("display back")
                misses = 0
            else:
                misses += 1
                if misses >= 2:
                    note("display gone, restarting the helper")
                    ok = rescue.start_helper()
                    note("helper restarted" if ok else "helper still not running (is the display plugged in?)")
                    misses = 0
                    time.sleep(10)
        except Exception as e:  # keep watching whatever happens
            page = None
            note(f"error: {e}")
        time.sleep(10)


if __name__ == "__main__":
    main()
