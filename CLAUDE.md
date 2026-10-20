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
- `game/` — the quiz: `game.js` (state machine attract → coin → asking → right: belt up + bell +
  reward / wrong or too slow: rewind → attract; won at the top; talks to everything through an `io`
  object so it runs on screen alone), `questions.js` (default Norwegian yes/no list, "question |
  JA"; the sidebar edits it, saved in localStorage), `sound.js` (synthesized bell for the laptop).
- `belt/` — `strip.js` draws the whole printed strip (leader, START, levels, win screen, black
  registration mark at the left edge mid-screen, START's mark 3× long); `belt.js` is the belt:
  backlit on-screen window + sends `BELT:STEP` / `BELT:HOME` and waits for `BELT:DONE:n` (15 s /
  60 s timeout, so the game never hangs without hardware).
- `display/lcdText.js` — game text for the IBM display: upper-case, word-wrapped, paged, with
  Æ Ø Å as custom characters 5–7 (the ROM very likely lacks them).
- `firmware/` — MicroPython: `machine.py` is the main board (micro:bit on the ElecFreaks Wukong
  motor board, plugged into the computer by USB): two TT motors (M1 top spool pulls, M2 bottom
  feeds), LDR on P1 for the marks, bell relay on P2, YES/NO/coin switches on P8/P12/P13, A/B =
  YES/NO. **The board owns the belt** (see "Board owns the belt" below); no radio on it. Also
  (from the occult-printer days, not used by the belt): `controller.py`
  (handheld: buttons, logo, shake, tilt, mic → radio + USB) and `receiver.py` (on USB, forwards
  radio lines). Radio group 42 in both. Same line format as the occult printer's controller, so
  boards flashed for that machine also work here.
- `firmware/*.hex` — ready-to-flash files (drag onto the MICROBIT drive in Finder): receiver shows
  **R**, machine board shows **M**. Built with `uflash 2.0.0` (`uflash firmware/X.py <dir>`, bundled
  MicroPython V2 2.0.0-beta.5; universal V1+V2 hex). **Rebuild them whenever a `.py` changes.**
  Claude's own processes got "Permission denied" on /Volumes/MICROBIT (macOS removable-volume
  privacy), so flashing from a session needs Removable Volumes allowed for Claude — dragging the
  hex in Finder always works.
- `3d/` — printable parts. `spool.stl` (built by `make_spool.py`, no 3D software needed; same
  part as `spool.scad`): belt spool for 80 mm paper, 22 mm core, 40 mm flanges, D-hole 5.5/3.8 mm
  for the TT motor shaft, 3.3 mm M3 axle hole at the far end, top flange a 45° cone so it prints
  standing on the flat flange without supports. Print two. `preview.html` shows it (via the dev
  server). **Shaft fit confirmed snug** on the school's Bambu P2S (PLA, 0.20 mm, fit-test ring,
  2026-10-05) — keep SHAFT_D 5.5 / SHAFT_FLATS 3.8. `two_spools.3mf` / `fit_test.3mf` (from
  `make_3mf.py`) open in Bambu Studio as geometry only (its "invalid config" notice is expected);
  the P2S prints from a USB stick (export the sliced `.gcode.3mf`).
- `lasercut/` — the scroll cassette (2026-10-06): `make_cassette.py` writes
  `cassette_mdf_3mm.svg` (3 mm MDF, one 570 × 400 bed — the cutter's real usable area; the
  maker's MDF is 2 mm and 3 mm boards of 1190 × 815, cut into 4 × 565 × 395 each) and
  `cassette_diffuser_3mm.svg`; `README.md` = parts list + assembly. Finger-jointed open-back box,
  outer 126 × 216 × 95; motors inside on the left wall (rear shaft through an 8 mm hole + cable ties),
  M3 axles in the right wall, 6 mm dowels keep the paper flat 3 mm behind the front, window 64 × 90
  narrower than the paper so the marks + LDR (hole beside the window) stay hidden, diffuser slots,
  removable back plate for the 8×8 NeoPixel matrix, front doubler for the heavy scanner housing
  (prism box with two ~10 cm glass windows; mounted with long slots since its bracket wasn't
  measured). Not cut yet; TT motor dims are typical values.
- `belt.html` + `belt.js` (2026-10-12, open with `start-belt.command`) — a focused page for the
  scroll mechanism only: connection/board/Wukong/busy pills, a big STOP, step up/down, rewind to
  start, tighten, position counter, light-sensor calibration with editable numbers (paper, mark,
  threshold, hysteresis), all motor/tension/timing settings, single-motor jog, a repeat test (N up
  + rewind, K rounds, stops at the first error) and a copyable log. Settings are kept both in
  localStorage `beltSettings` and on the board (`settings.txt`); a first visit adopts the board's,
  later visits push the page's on every connect.
- **Machine firmware rewritten non-blocking** (2026-10-12): the old one slept through motor moves,
  so commands sent meanwhile were cut off in the serial buffer ("M2 back sometimes doesn't work")
  and the page's writes could hang until a refresh. Now moves/tension/jogs are a state machine
  ticked every ~2 ms, STOP works any time, BUSY instead of overlapping moves, bad lines answer ERR,
  heartbeat `HB:state:W1|W0` every 2 s, `SET:key:value`/`SETTINGS?`/`SAVE` (debounced flash save),
  `STREAM:ON|OFF` for light, `TENSION` = both spools pull against each other (top +, bottom −) —
  also automatic after every move and optionally when idle. Old commands still understood.
  Backlight: 8×8 NeoPixel (WS2812B-64, pins V- / IN / V+) on **P15**; V+ must go to the
  Wukong's **5V pin in the small middle header** — the red rows beside the signal pins are 3.3 V
  and the matrix stayed dark on them (confirmed working on 5 V 2026-10-12); for the festival a
  separate 5 V supply with shared GND (64 LEDs at full white ≈ 4 A). `LED:ON|OFF|RGB:r:g:b|TEST`, setting
  `backlight` (white level, default 25, every channel capped at LED_MAX 120), on at boot.
  **Kick start** (2026-10-13, setting `kick`, default 80 ms, 0 = off, on the belt page): every motor
  start (moves, tension, jogs) gets full power for that long, then the asked speed — at speed 50 a
  TT motor sometimes couldn't break loose (M1 "let out" did nothing while the board answered
  MOTOR:DONE; a nudge got it going), aggravated by a rubbing spool / low Wukong battery.
  The tightening tug is never kicked (a full-power kick both ways yanked the paper).
  **Hold-to-run** (2026-10-13): belt page "Hold: wind up/down" buttons send `HOLD:±1` every 250 ms
  while pressed and `HOLD:0` on release (also on STOP, window blur, tab hidden); the board runs the
  belt at its step speeds, stops by itself 600 ms after the last HOLD (lost connection = stops),
  and tightens after a release.
  **Motor direction flip** (2026-10-13): the maker's build has both motors wired the other way
  round. Board settings `inv1`/`inv2` (1 = flipped) negate the speed inside `motor()`, so every
  move, tension, kick and jog flips together; checkboxes on the belt page, default ticked. Code
  still speaks in "positive M1 = wind in"; rewiring a motor later = untick its box.
  **Mark stops + tightening** (2026-10-13, "stops a while after the mark", "Tighten does nothing"):
  a mark stop now `brake()`s (reverse burst, `brake` ms) instead of coasting, then tightens, then
  *settles*: creeps back (`creep` speed, ≤ `settle` ms) until the sensor reads the mark again,
  and if not found searches the other way for 2× as long (the tug can shift the paper either way).
  Board logs `MARK:seen:n`, `MARK:back:Nms` (how far it overshot), `BELT:WARN:mark not found again`.
  Tightening ramps from 0 to `tension` over 2/3 of `tensionms` (defaults 55 / 400; the page
  migrates the old 35 / 200 once) — a full kick yanked the paper, steady 35 never broke loose.
  Settling then looked like "a rewind back and forth" (wrong first guess, 1.5 s each way), so:
  `settle` is per direction, default 600 ms; at the mark's edge counts (`on_mark`: level +
  min(hyst/3, 15)); `settle_first` remembers per travel direction which way found the mark and
  tries that first (RAM only: one possible wrong guess per direction after power-on). Logs
  `MARK:back|fwd:Nms`, `MARK:other way`, `MARK:on:n`.
  **Building the hex:** machine.py is over uflash's 20 KB limit with its comments — pack a
  stripped copy: `python3 firmware/strip.py firmware/machine.py <dir>/machine.py`, then uflash
  that (checked identical in the simulator). The mark-stopping that "stopped late" on 2026-10-13
  was really "Stop on marks" switched off (timed steps); with it on it works well.
  **End goal (maker, 2026-10-13):** the belt must run entirely on the micro:bit in the finished
  machine. Keep new belt logic on the board, not in JS.
  **Board owns the belt** (2026-10-13, first round of that redesign): the computer stays for the
  IBM display + printer (a micro:bit can't host USB) and the questions; the game page only sends
  `BELT:STEP`, `BELT:HOME`, `BELL:n` and hears `ANSWER:YES|NO`, `COIN:1`, `BELT:DONE:pos`. It no
  longer has belt settings — it used to push its own speeds/tension/threshold/"timed" on every
  connect, silently undoing the belt page's tuning. Board side:
  - **Position** `pos` (−1 = unknown after power-up / a hold / a jog; `POS:n` sets it; in HB and
    every DONE). The belt page shows the board's, no counting in JS.
  - **Find START** (`BELT:HOME`): down until START's long mark. Down moves pass *through* each
    mark (phase "through") and settle back up onto its top edge, so up- and down-stops land on
    the same edge. A mark is START if longer than 2× `markms` (learned, saved: ordinary mark dark
    time going down); unlearned, if dark ≥ 1/6 of the paper before it — only trusted when the
    move began on a mark (`sure`), since from an unknown spot the first gap is partial.
    `screenms` (learned) limits a downward search to 1.5 screens; nothing found = the paper is in
    the blank end above START → search up, the first mark is START. Starting inside a mark with
    unknown position: back out of it up first ("unstick"). The light is read *before* the
    start-up kick (the kick alone carried the sensor into START, which was then skipped). A
    plain step down that meets START stops there. After a fresh flash (settings.txt wiped) the
    learning comes back after one step down from a known position.
  - **Bell** rings from the main loop (`bell_tick`), so the belt keeps moving while it rings (it
    used to sleep 550 ms per ding).
  - **Buttons** polled every 20 ms (debounce). **Service mode**: hold YES+NO (or A+B) 5 s → `S`
    on the display, `SERVICE:ON`; hold YES/NO = wind up/down (`hold()`), coin = Find START;
    presses aren't sent as answers; 5 s again to leave. On the arcade buttons because the
    micro:bit's own A/B will be inside the closed box.
  - **Cut**: radio (stray micro:bits at a maker festival could move the belt; re-adding = feed
    `radio.receive()` into `safe_handle()` with a secret prefix), `SPEEDS/SNUG/MARKLEVEL/
    STOPMODE`, `LED:TEST`. `mode` now defaults to marks (timed = fallback).
  - `belt/strip.js`: START's long mark now starts at the ordinary marks' top edge and grows
    downwards (the printed strip from before has it centred → START sits ~8 mm off; fine).
  Simulator (scratch `sim2.py`): strip with marks, both motors, coasting lag, buttons; Find START
  from 143 start spots (all OK once learned), steps/back/home on new and old strips, service mode,
  bell during a move; packed (strip.py) and source firmware give identical output.
  Tested in a CPython simulator of the micro:bit (scratch, not in repo). `core/controller.js`:
  each write has a 1.5 s timeout; a stuck write aborts and reconnects by itself (`reconnect()`,
  writes queued before it dropped quietly); belt.js also reconnects when heartbeats stop.
- `tools/ibmlcd.py` — the IBM display driver in Python (hidapi), for quick tests from a terminal.
  It's the version the protocol was worked out with.

Inputs: keyboard C = coin, J/Y = ja, N = nei; a barcode scan (fast keys + Enter — the Metrologic
scanner is a USB keyboard) = coin, switchable; handheld micro:bit A = ja / B = nei (A = coin when
idle); machine board lines `ANSWER:YES|NO`, `COIN:1`. The old "Play (spin + print)" demo button
still exists but nothing maps to it.

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
Since then (same day): the maker has an **ElecFreaks Wukong motor board** (drives both motors
from one micro:bit, so one board runs the belt), **an LDR** (no TCRT5000/DRV8833 — under two weeks
left, no time to order), the **Metrologic barcode scanner** connected (USB 0c2e:0200, acts as a
keyboard) — it's a handheld **MS5145 Eclipse** (not the till scanner whose housing is the window). Its
**CodeGate** default sends a code only when its button is pressed; `docs/scanner-setup-codes.png`
(MetroSelect guide 00-02544, p. 17-2) has "CodeGate Inactive Out of Stand" to scan without the
button, `docs/scanner-enter-exit-and-reset.png` the enter/exit + recall-defaults page. Laser: it
reads printed 1D codes only (no QR, no screens), and a **working doorbell gong** for the bell (needs a relay; keep it low-voltage).
The on-screen game was built and played through in the browser 2026-10-04.
**2026-10-05: motors confirmed working.** Receiver (R) and machine board (M) flashed from this repo's
hex files; M1 ran forward/back on command, both straight over USB and from the page's Belt test.
LDR (2026-10-05): bare LDR from V(3.3 V) to P1 with the micro:bit's **internal pull-down**
(no resistor; the maker's MakeCode test did the same). Raw single reads jumped (~930 on the first
read after switching), so `light()` drops the first sample and returns the median of 7 — steady to
±3. First paper/mark test: 349 vs 284. Instead of a fixed 60 % rule the page now calibrates:
"This is paper"/"This is a mark" → midpoint sent as `MARKLEVEL:n`, and a "Stop on marks" switch
sends `STOPMODE:MARK|TIME` (both re-sent whenever the micro:bit connects, since the board forgets
them on restart). An open MakeCode tab competes for the micro:bit over USB — close it.
Gotchas found on the way: a micro:bit seated **the wrong way round in the Wukong** shows up as
`i2c.scan()` → `[]` / `OSError ENODEV` (the Wukong answers at 0x10 when seated right — check
that first); motor wire order only sets direction.
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

## Phone as the brain (2026-10-14: tested, it works)
The maker has an old iPhone XR and a Redmi Note 7 (Android) and asked whether one could replace
the computer. iPhone: no browser there can reach USB at all → at most a Wi-Fi remote. Redmi:
Chrome Android has WebUSB (printer); Web Serial arrived on Android in 2026 (unclear whether wired
USB is covered); WebHID (IBM display) is not on Android yet → the phone's own screen would show
the questions. Fallback if the phone fails: a Raspberry Pi runs these pages unchanged.
`phonecheck.html` (self-contained) checks it on the phone: capabilities, connect + print a test
ticket (text + GS v 0 picture + cut), micro:bit over Web Serial (PING/LIGHT?/BELL/BELT:STEP),
WebUSB/WebHID probes, wake lock, "Copy results". Served to the phone by `phone_server.py`
(0.0.0.0:8131, hands out only that page; devserver.py stays localhost-only) via
`start-phone.command`, which prints the Mac's IP and the chrome://flags step
(#unsafely-treat-insecure-origin-as-secure) Chrome needs before it allows USB on a LAN http page.
**Result on the Redmi Note 7** (Android 10 = its last; Chrome 87, can't be updated): WebUSB
yes, Web Serial no, WebHID no. The printer printed the test ticket (text + raster + cut) over
WebUSB. The micro:bit works over WebUSB too: its USB plug has a CDC-ACM serial port (interface
classes 8, 2, 0a, 3, ff, ff), which Chrome lets WebUSB claim — SET_LINE_CODING 115200 + DTR/RTS,
then bulk in/out (`openUsbSerial` in phonecheck.html). PING/PONG, heartbeats, BELL and a full
BELT:STEP all worked from the phone. So the phone can run printer + belt; the questions would go
on the phone's own screen (no WebHID for the IBM display). Getting there: page served from the
Mac over the maker's iPhone hotspot (school Wi-Fi isolates devices), Chrome flag
#unsafely-treat-insecure-origin-as-secure for the LAN address; the page posts its report to
/tmp/phonecheck-results.txt on the Mac (no easy way to get text off the old phone).
**Phone version** (2026-10-14): `phone.html` + `phone.js` — the same game/belt/ticket modules as
`main.js`, on the phone's own screen: text set as big as fits by a font-size search (whole words
only — hyphenation split "EL-LER"), answer timer bar, level dots, attract lines; "TRYKK FOR Å
STARTE" first tap gives full screen + wake lock + sound; a hidden operator panel (long press 2 s
in the top-left corner: connect, test coin/JA/NEI/step/Find START/print/cut, answer seconds,
screens to win, reward prints, questions, log). Settings in localStorage `phoneSettings`.
`core/usbSerial.js` rebuilds the bit of navigator.serial that `core/controller.js` uses on top of
WebUSB (CDC-ACM claim, line coding, bulk streams); `serialApi()` picks Web Serial when it exists,
so the Mac is unchanged. **Offline copy**: `sw.js` precaches every file (list = `FILES`, kept in
step with `phone_server.py`'s list) and serves the copy first, refreshing it in the background —
so the phone opens the game with no Mac, no Wi-Fi; after a change, open it twice with the Mac on
the hotspot. Verified in real headless Chrome: 27 files cached, page + modules load with the
server stopped. (The Claude browser pane refuses service workers altogether — test them in real
Chrome.) The origin must stay the same (`http://172.20.10.4:8131`, the flag's address) or the
phone has a different, empty copy. `manifest.json` + `icon.svg`: "Add to Home screen" → an icon
that opens it full screen.
**Belt page on the phone** (2026-10-14, the maker: recalibrating live will happen, so do it from the
phone): `belt.html`/`belt.js` are in the phone file lists (sw.js cache v2) and work as they are
(micro:bit over WebUSB via usbSerial.js). Operator panel → "Belt setup & calibration →" (same tab,
so the game page lets go of the micro:bit); "← Game" goes back to `./`. "Send log to the Mac"
posts the log to phone_server.py (/tmp/phonecheck-results.txt).
**Plan agreed 2026-10-14** (after "you moved too fast"): 1 belt tuning (firmware flashed) → 2 YES/NO
buttons (not found yet) → 3 bell (soon: square doorbell rings on 9 V DC; the round one is a 1966
Swedish telephone ringer KLA 22124, probably needs AC) → 4 coin maybe skipped → 5 the maker wants
the QUESTIONS PRINTED by the printer instead of a screen → 6 box. One step at a time; don't build ahead.
**Belt safety + LED colour (2026-10-14, "Find START and coin often rewind so far the paper falls
off the spool"):** a move without a mark used to run up to `timeout` (8 s) — when START wasn't
recognised (threshold off after a light change, nothing learned after a flash) that unwound the
paper. Now `blank_limit()`: at most 1.5 screens of paper without a mark (learned `screenms` down /
`upms` up, else the timed-step estimate; capped by `timeout`), both directions. Find START from a
known `pos` counts the marks back (still stops early on a long mark); from an unknown spot it never
passes more than `screens` (11, belt page field) marks; already on START = no move. Simulated:
wrong threshold → stops ~120 mm in; START unrecognised → ~150 mm into the blank end then back up
onto START (the blank above START is ~250 mm). **Colour**: picked colours are screen colours;
`led_level()` applies gamma 2.6 (LEDs are linear — picked orange came out yellow) and green × 0.8.
**Packing**: `strip.py` also cuts indentation to 1 space/level (18.8 → 15.8 KB of uflash's 20 KB);
packed and source checked identical in the simulator.
**English mode, win light, coin after a game (2026-10-14):** `game/lang.js` holds every word the
game says (no / en), the attract lines, ticket texts and `DEFAULT_QUESTIONS_EN`; `game.js` takes
them via `io.lang()` (default Norwegian, so `main.js` is unchanged in words). Phone panel: Norsk /
English buttons; each language keeps its own question list (`phoneSettings.questions` /
`questionsEn`). Win light: `LED:WIN` — a turning rainbow with white sparkles for 6 s
(`win_tick`, ~25 frames/s), BELT commands wait for it like for a flash; the game sends it on a
win (`io.celebrate`). Coin is now taken in "won" and "lost" too (it used to be ignored for ~12 s
after a win, which looked like the belt not going back to START). The board queues one BELT
command that arrives while a move is still tightening/settling (`BELT:QUEUED`, run by `finish()`;
dropped on STOP or a failed move) instead of answering BUSY; belt/belt.js also treats BUSY as an
answer so the game never waits a minute. Phone panel: Win light test, Send log to the Mac.
**Firmware now goes on over USB, in pieces (2026-10-15).** The bell + win-light version gave a sad
face: `MemoryError` at start-up — MicroPython parses the whole main.py before running it, and
~17 KB (packed) no longer fit. Precompiled `.mpy` was tried: this build can't import .mpy at all
("no module named"). Fix: `firmware/upload.py` packs machine.py (strip.py), cuts it at top-level
statements (ast) into pieces ≤ 5 KB (`belt0.py`…; the main loop alone in the last), and writes
them plus a small loader `main.py` (exec each piece into the same globals, gc between) over the
raw REPL — no soft reset, which would re-run a crashing main.py. Simulator: pieces-in-sequence
give output identical to the whole file. **No more .hex for the machine board** (machine.hex
removed; dragging a hex wipes the board's files incl. settings.txt — then run
`upload.py --loader`). Updates keep settings.txt. Double-click `update-microbit.command`
(makes `.venv` with pyserial once — Homebrew Python refuses pip installs, PEP 668). The page
must be closed (one program per serial port).
**If memory gets tight again** (the maker, 2026-10-15): drop the backlight colour picker /
cr/cg/cb + gamma — a fixed slightly warm white is fine; keep the red and green flashes.
**Board file store is ~16 KB (2026-10-16).** The trace version hit `OSError: 28` (no space) during
upload. Now: `strip.py --rename` packs with only needed spaces and renames the program's own names
to 1–2 letters (never micro:bit/builtin names; the tree must equal the original's with the same
renaming; `firmware/names.txt` maps short → original to decode board errors) — 17.6 → 12.5 KB.
`upload.py` deletes ALL files first (deleting only old pieces left the store fragmented and the
2nd update ran out of space), keeps settings.txt's contents and writes it back last, and retries
Ctrl-C (the running firmware doesn't always stop on the first). The loader keeps its variables in
a function (`__load`): with short names the program's own `n` overwrote a global loop counter →
sad face. Test the packed firmware with the REAL loader + piece files in the simulator, not just
the pieces exec'd in sequence (that missed the loader clash). After two uploads: 13.1 KB used.
**The life simulator (2026-10-16) — the maker's new game, on the phone version.** "Livet AS": you
buy your way up through 15 cards (one per screen, START = card 1); the printed receipt is the only
screen (the phone's display just mirrors state for the operator). `game/cards.js`: cards are
`title | price | JA|NEI | losing text` (JA = a purchase to make, NEI = a trap to refuse — the
maker didn't want JA always right, nor random events), placeholders + FINAL_TEXT (the maker's
ending, without their phone number). `game/life.js`: right choice → ding + green + a receipt line
(+ debt) + step; wrong / timeout → red + losing text + total debt + cut + rewind; last card →
LED:WIN, 3 bells, optional ntfy push (topic in the panel; ntfy.sh/app works in a browser), final
receipt, cut. `game/receipt.js`: till-receipt parts, no feed between lines (one strip), feed only
before a cut. Timer: `LED:HURRY:ms` (firmware) — the light blinks faster for the last 10 s; any
flash/win/move/hold/calibrate/STOP/LED:ON ends it (moves need steady light). The phone pushes
`SET:screens:<cards>` on connect. No printing in attract (the maker plans a sign: "TRYKK JA + NEI
FOR Å STARTE"). The Mac page (main.js) still runs the old quiz. **Firmware now 14.4 KB packed** —
with loader + settings ~15 of ~16 KB: the next firmware feature should come with dropping the
colour picker (cr/cg/cb + gamma), as the maker allowed.

**Kvitteringsspillet, Aksels manus (2026-10-20, branch `kvitteringsspill-aksels-manus`):** replaces
the life game on this branch. `game/kvitteringMotor.js` (the rules, moved unchanged from Aksel's
prototype `kvitteringsspillet/kvitteringsspillet.html`, plus `svarLinje` / `tidenErUte`),
`game/manus.js` (the script; changes: question 10 "Nei" = "Vil du ha kvitteringen?", the boat's
pawn on question 8 "Ja" 50 kr instead of 9500) and
`game/kvittering.js` (the game, same shape as `createLifeGame(io)`; also needs `io.now/after/cancel`
so it runs in Node): question 1 stands ready (state `ready`, nothing printed, no clock) and the
first answer starts the game — `start()` is only the power-on rewind; a life is 10 min = 67 years (60 s until 2026-10-20 — about 6 s a question was too short),
counted from the first answer and only while the player decides; the receipt
prints line by line, `LINJE_MS` 0.5 s per line (blank lines ¼ of that) so players read as it
comes out (the simulator plays `printSound()` from game/sound.js per line), and a printer that doesn't answer is waited for once
(20 s), then only the reading pace is kept until a print gets through; each answer
is printed with the age; **the balance is checked when the whole answer is done** (Aksel: the
story must come out before the loss) — kroner < 0 at the end loses, friends removed that weren't
there are a `vennegjeld` that friends added later in the same answer pay off, death stops at once;
the pawn was lowered so it can't save anyone who couldn't pay for the boat (a test checks every
path); JA = a question's first answer, NEI = its second; after the end: cut,
5 s in which presses are ignored, then the rewind (`rewinding`), then question 1 ready again; every wait on printer/belt has a limit. All in
sw.js + phone_server.py (cache v16). `simulator.html` (`start-simulator.command`) runs the same game
with an on-screen machine, black and white (JA black, NEI white); the time left shows only on the
receipt, the testing panel (D) shows kroner, venner, age, time and which answers can still win. `node tests/kvittering.test.mjs`: all 55 paths identical to the
prototype's motor, then the game on a fake clock incl. a 10-hour day of random presses.
**Wired into phone.js (2026-10-20, Stener's session):** phone.js runs `createKvitteringGame` instead of
the life game (life.js/cards.js/receipt.js stay, unused by the phone). `game/kvitteringTegning.js`
draws the paper: `linjer()` sets the game's 32-character lines in a monospaced font sized to fit
exactly 32 across (all-capital lines bold) with no margins, since the game prints one line per job
and the pieces must join seamlessly; `topp()` the big title + date, `skjermer(manus)` one
scroll screen per question. `belt/strip.js` gained `cfg.screens[i]` = { head, box, price, lines,
answers, foot } drawn inside the window area (screens/README.md, minus the cabinet's 2 mm); without
it the strip is drawn as before (main.js unchanged). Screen 0 = question 1 + "Svar JA eller NEI for
å begynne"; pictures are boxes with their description until real ones exist. The phone panel's Game
section: Preview strip / Print strip; the old cards/seconds/final-text settings are gone. The
"Start" label matters: its title line → `topp()`, its "=====" line is skipped (topp has a rule);
`io.cut` feeds 15 mm past the blade first. Cache v17.
**No start press (2026-10-20, Aksel):** question 1 stands ready, the first answer starts; the game
still sends the header as its own "Start" print just before the first answer, so `topp()` works
as before. phone.js calls `game.start()` once on load (the power-on rewind) and `game.reset()`
when the micro:bit (re)connects while the machine stands ready, so the board finds START even if
it wasn't there at load; COIN, the C key and the panel's Coin button are gone (nothing to start).
The operator screen shows "KLAR · 1. …" instead of the attract lines. Cache v18. Verified in Chrome with no hardware: a whole
game by keyboard to time-up, cut, pause and back to attract, every printed piece collected and
stitched (one seamless receipt); the strip rendered and looked at; `node tests/kvittering.test.mjs`
all ok. Not tried on the real printer: whether 30+ separate small jobs per game print smoothly.
