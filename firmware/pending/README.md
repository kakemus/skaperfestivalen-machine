# Firmware changes waiting for the next micro:bit update

Updating the micro:bit is fiddly (unplug it from the hub, into the Mac, run
`update-microbit.command`, back), so the maker wants **one** update later with
everything in it (2026-10-21). Until then `firmware/machine.py` stays exactly what's
on the board. Apply these with `git apply firmware/pending/<file>.patch`, check with
the firmware simulator, then update the board once.

- `no-service-mode.patch` — a 5 s hold of JA + NEI does **nothing** any more (it used to
  switch on the old service mode, S on the display, with YES / NO winding the belt — the
  phone panel has hold-to-wind now); **10 s** still = auto-calibrate + find START, and the
  phone puts the game back on START after it. (Replaces an earlier 5 s-calibrate patch:
  the maker settled on 10 s, 5 s nothing — 2026-10-21.) Checked in the firmware simulator:
  6 s hold → only a COIN on release (which the game ignores), 11 s → CAL:OK and
  BELT:DONE:0, a quick press of both → COIN, one button → ANSWER. After applying, update
  belt.html's "On the machine" hint and CLAUDE.md (Buttons / service mode).
- `flash-count-longer-win.patch` — `LED:FLASH:R:12` = a red flash with a blink count,
  and the win rainbow 10 s (`WIN_MS`). Optional: the phone already gets the same effect
  by repeating `LED:FLASH:R` 4 times and `LED:WIN` after 5 s (phone.js `flash` /
  `celebrate`); with this patch those could become one command each.
