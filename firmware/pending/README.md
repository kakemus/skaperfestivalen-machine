# Firmware changes waiting for the next micro:bit update

Updating the micro:bit is fiddly (unplug it from the hub, into the Mac, run
`update-microbit.command`, back), so the maker wants **one** update later with
everything in it (2026-10-21). Until then `firmware/machine.py` stays exactly what's
on the board. Apply these with `git apply firmware/pending/<file>.patch`, check with
the firmware simulator, then update the board once.

- `calibrate-5s.patch` — hold JA + NEI **5 s** = auto-calibrate + find START (was
  10 s); the old service mode is no longer reached from the buttons (the phone panel
  has hold-to-wind). The phone already resets the game after any calibration
  (`CAL:OK` → the board's find-START reply), so nothing else is needed. After applying,
  update the texts that say 10 s: phone.html (Auto-calibrate hint), belt.html (the
  "On the machine" hint), CLAUDE.md (Buttons / service mode).
- `flash-count-longer-win.patch` — `LED:FLASH:R:12` = a red flash with a blink count,
  and the win rainbow 10 s (`WIN_MS`). Optional: the phone already gets the same effect
  by repeating `LED:FLASH:R` 4 times and `LED:WIN` after 5 s (phone.js `flash` /
  `celebrate`); with this patch those could become one command each.
