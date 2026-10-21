# Firmware changes waiting for the next micro:bit update

Updating the micro:bit is fiddly (unplug it from the hub, into the Mac, run
`update-microbit.command`, back), so changes are collected here and put on the board
together; until then `firmware/machine.py` stays exactly what runs on the board.
Add a change as a `.patch` with a line below on what it does and which texts to update.

**Nothing pending.** The last batch went on the board on 2026-10-21: a 5 s hold of JA + NEI
does nothing (no more service mode from the buttons), 10 s = auto-calibrate; `LED:FLASH:R:n`
takes a blink count; the win rainbow lasts 10 s.
