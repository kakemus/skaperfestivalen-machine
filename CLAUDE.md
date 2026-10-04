# Machine — Skaperfestivalen

An arcade machine built from found electronics, for Skaperfestivalen at Deichman (Oslo): a yes/no
quiz game whose progress is a long printed paper strip moving up behind a backlit window. Driven by
micro:bits, with an old IBM till display for the questions and a thermal printer. See "The game".

Started 2026-10-02, split out of the maker's earlier art project (`~/Documents/occult-printer`, a
buried oracle printer). Some code was **copied** from there, never imported — the two machines are
unrelated, and changes here must never touch that repo. Don't carry that project's context over:
no iMac, no Gemini, no buried box.

## Running it

Double-click `start.command`: starts `devserver.py` on port 8130 and opens
`http://localhost:8130/` in Chrome. Chrome only — the page uses WebUSB (printer), WebHID (IBM
display) and Web Serial (micro:bit). Each device needs one real click on its Connect button the
first time; after that the page reconnects by itself on load and when a device is re-plugged.

No build step, no npm, no dependencies: native ES modules. `devserver.py` exists only because
Chrome won't keep device permissions on `file://` and caches JS aggressively (it sends no-cache
headers and always serves its own folder).

## Layout

- `main.js` — the only file that knows the page exists; wires the sidebar to everything else.
- `core/` — hardware and plumbing, each the one owner of its device:
  - `printer.js` — WebUSB thermal printer + print queue. **Fast by default** (whole ticket in one
    transfer); **slow mode** paces it out in strips at a set mm/s (the occult printer's
    "breathing" pacing). Cut = GS V 1, which also stops a slow print and drops queued jobs.
  - `raster.js` — canvas → ESC/POS raster bytes (576 dots wide = 80 mm paper at 8 dots/mm),
    plus photo helpers (auto-levels, brightness/contrast, Floyd–Steinberg dither).
  - `ibmDisplay.js` — the IBM display over WebHID (protocol below). Keeps a copy of what's on
    screen and emits `ibm:changed`, so the page shows a replica with or without the hardware.
  - `controller.js` — Web Serial to the micro:bit receiver; parses `KEY:VALUE` lines into
    `controller:*` events.
  - `clock.js` (+ `clockWorker.js`) — timers that keep running in a background tab (see gotchas).
  - `eventBus.js` — tiny pub/sub.
- `tickets/` — ticket designs. Each is `{ label, fields, randomize?, draw(values, { feedMm }) }`;
  the sidebar builds edit fields from `fields` and shows a live preview. Adding a design = a file +
  a line in `tickets/index.js`. Helpers in `tickets/draw.js`.
- `display/scenes.js` — IBM display animations. Each scene is `{ label, setup(lcd), frame(lcd, t,
  inp) }` at 15 fps; `inp` is the controller state (tilt, sound, buttons, shake) or the "ghost"
  stand-in when no micro:bit has been heard for 5 s, so the display never freezes.
  `display/replica.js` draws the on-screen copy in the real 5×8-dot grid.
- `firmware/` — MicroPython for the two micro:bits (flash at python.microbit.org): `controller.py`
  (handheld: buttons, logo, shake, tilt, mic → radio + USB) and `receiver.py` (on USB, forwards
  radio lines). Radio group 42 in both. Same line format as the occult printer's controller, so
  boards flashed for that machine also work here.
- `tools/ibmlcd.py` — the IBM display driver in Python (hidapi), for quick tests from a terminal.
  It's the version the protocol was worked out with.

Current micro:bit mapping (basics, expected to change): A = play (reels spin on the display, then a
prize ticket prints 3 s later), B = next display scene, shake = respin.

## The IBM display (USB 04b3:4526)

"IBM Retail USB 40 Character Liquid Crystal Display", 2 × 20 characters, made 2011. Its protocol
isn't published — worked out by trial on 2026-10-02 and documented at the top of
`core/ibmDisplay.js` and `tools/ibmlcd.py`. Short version: 23-byte HID output reports
`[cmd, len, data…]`; `0x81`/`0x82` replace the top/bottom line, `0x02` clears, `0x40 slot rows×8`
defines custom character 0–7. ~30 writes per second.

- **It has a second HID interface (usage 0xA000) for firmware upgrades. Never write to it** — it
  could brick the display. Both drivers only open usage 0x2600.
- Control characters (CR, LF, FF…) are *printed* as glyphs, not obeyed. Character 0 shows as ‾
  until defined, so lines are padded with spaces.
- The USB cable/connector is loose — a dropout shows the power-on "OK" screen. If the display
  shows "OK", check the cable before suspecting code.

## Gotchas

- **Background tabs.** Chrome throttles timers in a hidden tab, after ~5 min to once a minute: the
  display froze mid-animation and just hopped between scenes (2026-10-02). Everything the machine
  does on its own runs on `core/clock.js` (worker timers) instead of `setInterval`/`setTimeout`.
  The fix wasn't confirmed in a 15-minute hidden run yet.
- **First connect needs a real click** (WebUSB/WebHID/Web Serial rule). Automatic code paths only
  reuse already-granted devices (`connect({ auto: true })`) and stay quiet otherwise.
- Settings (chosen design, edited ticket text, print mode, scene) live in this browser's
  localStorage as `machineSettings`. The code defaults only apply when nothing is saved.
- The printer for this machine isn't decided yet; `raster.js` assumes 80 mm paper (576 dots). A
  58 mm printer needs `PRINT_WIDTH = 384`.

## The game (explained by the maker 2026-10-04 — the plan to build towards)

- **Coin** starts it (a simple coin mechanism → a micro:bit pin).
- The **IBM display asks yes/no questions**; the player answers on **YES / NO buttons** (maybe a
  third micro:bit, or arcade buttons wired to one).
- Each correct answer moves the game one step up: a **long thermal-printed strip** of "screens"
  is mounted as a **belt** between **two motors, one micro:bit at each end, synced by radio**, and
  moves one screen up; only one screen shows, through the window of a salvaged till-scanner
  housing ("the overhead part"), **backlit** so the paper glows. A **bell dings** each step.
- The **printer** prints the strip itself, and a small **reward** each time the player progresses.
  If the belt can't be built, printing each screen is the fallback.
- An earlier sketch (2026-10-02) was first misread as a "test your strength" tower with a barcode
  scanner — wrong: the scanner housing is just the viewing window.

Answers 2026-10-04: **about 10 screens**; a **wrong answer rewinds the belt** to the start.
Hardware on hand: **yellow "TT" DC gear motors** (no position feedback — needs a driver board, e.g.
DRV8833 or a micro:bit motor board, and its own 4×AA / 5–6 V supply; never straight off micro:bit
pins) and an **MG90S metal-gear micro servo** (planned for the bell hammer; also wants separate
5 V). Because TT motors can't count, **registration marks + a light sensor (TCRT5000 or LDR
against the backlight) are required**; a wider/double "home" mark at the strip start lets the
rewind find screen 1. Strip ≈ 10 × 10–12 cm + leaders ≈ 1.2–1.5 m. Open: how far apart the two
motors are, and whether a driver board is on hand. Recommended **one micro:bit + one DRV8833
driving both spools** (scroll-style, no radio sync) over the original one-micro:bit-per-end radio
sync, if the ends are close enough to wire.

Suggested to the maker, not decided: registration marks printed at each screen + a light sensor
so the belt stops exactly on a screen (paper slips; two motors drift); one motor pulls while the
other holds tension (an endless loop with one motor is the fallback); a servo-hammer bell is
simplest; LED backlight only (heat/UV fades thermal paper). Still open: the window height. Proposed first build, all testable without hardware: the game state machine with keyboard
stand-ins and an on-screen belt, radio messages (`BELT:STEP`, `BELL:DING`, `COIN`) + firmware for
the belt/bell boards, a belt-strip designer that prints the screens with marks, reward prints.

## Working with this user

- A creative build for a festival, not a software product: "does it look/feel right in person"
  first, but keep the code clean and dependency-free. No build step — don't add one.
- The maker isn't a programmer. Explain in plain words, give double-click launchers, avoid
  terminal steps for them.
- **Verify on the real thing before calling it done** — serve it with `devserver.py` and drive it
  in a browser; for hardware, ask for a photo (the display) or watch the log.
- Keep scope tight to what's asked; suggest extras rather than building them.
- One git commit per feature, message says *why* and how it was verified. No remote is set up;
  never push unless asked. Commit messages with `*` or `#` break under zsh `-m` — use `-F file`.
- Default to a reasonable creative call over asking about subjective things (wording, look,
  timing); ask before anything hard to undo.
