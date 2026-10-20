# The machine micro:bit (V2), sitting on an ElecFreaks Wukong motor board,
# plugged into the computer by USB.
#
# THE BOARD OWNS THE MACHINE'S BODY (2026-10-13, the maker's goal: the belt runs
# entirely on the micro:bit). The computer only says what happened in the game
# — step up, go home, ring — and the board does all the moving: speeds, kick,
# braking, tightening, finding and settling onto marks, finding START, knowing
# where it is. It reads the YES / NO / coin buttons and rings the bell itself,
# and has a service mode on the arcade buttons, so the belt can be looked after
# with the lid on and no laptop page open.
#
# NEVER BLOCKS (2026-10-12): moves are a small state machine ticked every few
# ms while the loop keeps reading commands; STOP works at any moment; a bad
# line answers ERR instead of crashing; a heartbeat goes out every 2 s.
#
# Commands (one per line):
#   BELT:STEP | BELT:UP:n | BELT:BACK:n   1 / n screens up, n screens down
#   BELT:HOME                             down until the long START mark (the game's rewind)
#   POS:n                                 "the belt is on screen n now" (e.g. set by hand)
#   TENSION                               both spools pull against each other a moment
#   HOLD:1 | HOLD:-1 | HOLD:0             run up/down while held (repeat every ~250 ms; stops
#                                         by itself 600 ms after the last one); 0 = let go
#   MOTOR:m:speed:ms                      run motor m (1/2) at -100..100 for ms (≤ 5 s)
#   BELL:n                                ring n times (also BELL:DING:n); never holds up the belt
#   LED:ON | LED:OFF | LED:RGB:r:g:b      the backlight (8×8 NeoPixel matrix)
#   LED:FLASH:G | LED:FLASH:R             blink green (right answer) / red (wrong); a BELT
#                                         command sent meanwhile waits until it's over
#   LED:HURRY:ms                          time is running out: the light dims in blinks that come
#                                         faster and faster for ms, then steady again. Any flash,
#                                         win light or belt move ends it (the sensor needs steady light)
#   LED:WIN                               the win light: a running rainbow with sparkles (~6 s),
#                                         BELT commands wait for it the same way
#   A BELT command arriving while a move is still finishing (tightening, settling) is
#   queued (one) and run after it, instead of being refused with BUSY.
#   SET:key:value  /  SETTINGS?  /  SAVE  settings (kept on the board in settings.txt)
#   STREAM:ON|OFF  LIGHT?  PING  STATUS?  STOP
#   CALIBRATE                             run up ~1.5 screens measuring the light, set level + hyst
#                                         from the brightest (paper) and darkest (mark) reading:
#                                         CAL:OK:paper:mark:level / CAL:FAIL:why. Position unknown after.
#   TRACE:ON|OFF                          while the belt moves, send T:ms:light:phase every 20 ms
#                                         (the belt page draws it — to see what the sensor really gets)
# Replies: BELT:DONE:pos / BELT:ERROR:why / BELT:WARN:..., MARK:... (what the
#   sensor did), HOLD:DONE, MOTOR:DONE, TENSION:DONE, STOPPED, BUSY,
#   SET:OK:key:value, SETTINGS:k=v,..., LIGHT:n, PONG, HB:state:W1|W0:pos,
#   WUKONG:ON|OFF, ANSWER:YES|NO, COIN:1, SERVICE:ON|OFF, ERR:...
#   pos is -1 while the board doesn't know where it is (after switching on).
#
# START: a quick press of YES + NO together (or A + B) = COIN:1, like a coin.
# CALIBRATE: hold YES + NO for 5 s, or the micro:bit's own A + B for 3 s:
# auto-calibrate, then find START (the phone then puts the game back on START too).
# SERVICE MODE (S on the display: YES / NO wind the belt) is no longer reached from the
# buttons (2026-10-20): the phone panel has hold-to-wind, and YES + NO for 5 s became
# calibrate. The code for it stays.
#
# Radio was taken out (2026-10-13): the board is on USB, and at a maker
# festival full of micro:bits a stray one on the same group could have moved
# the belt. To add it back, feed radio.receive() lines into safe_handle() in
# the main loop — with a secret prefix checked first.
#
# WIRING
#   Wukong M1 = top spool (+ = winds paper in, strip moves up)
#   Wukong M2 = bottom spool (+ = lets paper out; − = winds it back in)
#   (inv1 / inv2 flip a motor wired the other way round — the maker's build has both flipped)
#   LDR: V (3.3 V) ── LDR ── P1, internal pull-down. Paper = high, mark = low.
#   Bell: P2 → a relay module's IN (VCC → the 5V pin, GND → G); the relay switches the bell's own
#   9 V battery. Never the bell straight on P2: it needs far more than a pin gives, and its coil
#   kicks back a spike when switched off.   YES: P8 to GND.   NO: P12 to GND.   Coin: P13 to GND.   A/B = YES/NO.
#   Backlight: 8×8 NeoPixel (WS2812B) IN → P15 (yellow S pin), V- → G, V+ → the Wukong's 5V pin in
#   the small middle header (NOT the red pin rows — those are 3.3 V, too low for these LEDs).
#   Or a separate 5 V supply with its GND joined to the Wukong's. 64 LEDs at full white draw
#   ~4 A, so the brightness is capped at LED_MAX.
#
# THE STRIP (belt/strip.js): next screen printed below the current one; every
# screen has a black mark at the left edge level with its middle; START's is
# 3× as tall. Going up, the sensor meets a mark's top edge first and stops
# there. Going down it would meet the bottom edge — so down moves pass through
# the mark and settle back up onto its top edge: every stop lands the same.
from microbit import *
from neopixel import NeoPixel
import random

WUKONG = 0x10
LED_PIN = pin15
LED_COUNT = 64
LED_MAX = 120          # never brighter than this per colour channel (current!)

S = {                  # settings — the belt page sets these, the board keeps them in settings.txt
    "pull": 60,        # top spool speed going up (0-100)
    "feed": 45,        # the spool letting paper out — slower than the pulling one keeps it tight
    "rewind": 80,      # bottom spool speed going down
    "tension": 55,     # strength of the tug after every move (0 = off) — reached by a soft ramp
    "tensionms": 400,  # how long the tug lasts (first 2/3 ramping up, then holding)
    "mode": 1,         # 1 = stop on marks, 0 = timed steps (a fallback if the sensor fails)
    "level": 0,        # light below this = a mark (0 = not calibrated → timed steps)
    "hyst": 8,         # light must rise above level + hyst to count as "off the mark"
    "steptime": 1500,  # timed mode: ms per screen
    "timeout": 8000,   # give up when no mark turns up for this many ms
    "after": 0,        # keep going this many ms after a mark is found (centre the screen)
    "mingap": 300,     # ignore marks during the first ms of a screen (still leaving the old one)
    "idletension": 0,  # re-tighten after this many s of standing still (0 = off)
    "backlight": 25,   # backlight level 0-120 (keep it steady: the light sensor reads it)
    "cr": 255,         # backlight colour as picked on the belt page, red / green / blue 0-255;
    "cg": 200,         # backlight_on() corrects it for the LEDs (picked orange came out yellow)
    "cb": 40,
    "kick": 80,        # ms of full power every time a motor starts (0 = off) — see drive()
    "inv1": 0,         # 1 = motor M1 is wired the other way round: flip its direction everywhere
    "inv2": 0,         # 1 = same for M2
    "brake": 30,       # ms of reverse power when a mark is found, so the spools don't coast past it
    "creep": 40,       # slow speed used to settle onto a mark
    "settle": 600,     # after a mark stop: creep at most this long each way onto the mark (0 = off)
    "markms": 0,       # how long an ordinary mark stays dark going down — learned, tells START apart
    "screenms": 0,     # how long one screen takes going down — learned
    "upms": 0,         # ... and going up — learned. Both limit how much blank paper a move may run
    "screens": 11,     # screens on the strip (START + levels): Find START never passes more marks
    "bellms": 250,     # how long the bell gets power per ding (a doorbell rings as long as it's on)
    "bellinv": 0,      # 1 = the relay module switches on when P2 is LOW (many cheap ones do)
}
SETTINGS_FILE = "settings.txt"


def load():
    try:
        with open(SETTINGS_FILE) as f:
            for line in f.read().split("\n"):
                if "=" in line:
                    k, v = line.split("=", 1)
                    if k in S:
                        S[k] = int(v)
    except Exception:
        pass


def save():
    with open(SETTINGS_FILE, "w") as f:
        f.write("\n".join("%s=%d" % (k, S[k]) for k in S))


uart.init(115200)
for p in (pin8, pin12, pin13):
    p.set_pull(p.PULL_UP)
load()


def say(line):
    print(line)


# ---------- motors ----------
wukong_ok = True
speeds = [0, 0, 0]  # last speed asked of each motor (before any wiring flip), for brake()


def motor(m, speed):
    """m = 1 or 2, speed -100..100. False if the Wukong doesn't answer (switched off / not seated)."""
    global wukong_ok
    speeds[m] = speed
    if S["inv%d" % m]:
        speed = -speed            # this motor's wires are the other way round
    try:
        i2c.write(WUKONG, bytes([m, 1 if speed >= 0 else 2, min(100, abs(int(speed))), 0]))
    except OSError:
        if wukong_ok:
            say("WUKONG:OFF")
        wukong_ok = False
        return False
    if not wukong_ok:
        say("WUKONG:ON")
    wukong_ok = True
    return True


def stop():
    motor(1, 0)
    motor(2, 0)


def brake():
    """Stop hard: a short burst the other way, then off. Coasting carried the
    paper well past the mark (2026-10-13)."""
    if S["brake"] > 0:
        a, b = speeds[1], speeds[2]
        motor(1, -a)
        motor(2, -b)
        sleep(min(S["brake"], 100))
    stop()


def drive(m1, m2, kick_ms=None):
    """Start motors with a kick: full power for S["kick"] ms, then the asked speed.
    A TT motor at half power often can't break loose from a standstill (the
    spool just sat there, 2026-10-13); once turning it keeps going. None =
    leave that motor alone. False if the Wukong doesn't answer."""
    ok = True
    k = S["kick"] if kick_ms is None else kick_ms
    if k > 0:
        for m, v in ((1, m1), (2, m2)):
            if v:
                ok = motor(m, 100 if v > 0 else -100) and ok
        sleep(min(k, 200))
    for m, v in ((1, m1), (2, m2)):
        if v is not None:
            ok = motor(m, v) and ok
    return ok


def belt_speeds(direction):
    if direction > 0:
        return S["pull"], S["feed"]                                     # top pulls, bottom lets out
    return -(S["feed"] * S["rewind"] // max(1, S["pull"])), -S["rewind"]  # bottom pulls, top lets out


# ---------- light, backlight, display ----------
leds = NeoPixel(LED_PIN, LED_COUNT)


def leds_fill(r, g, b):
    c = (min(LED_MAX, max(0, r)), min(LED_MAX, max(0, g)), min(LED_MAX, max(0, b)))
    for i in range(LED_COUNT):
        leds[i] = c
    leds.show()


GREEN = 80            # % — these LEDs' green is much brighter than their red


def led_level(c, v):
    # A picked colour is what a screen shows; LEDs are "linear" — half the
    # number looks nearly as bright as full — so orange (255, 165, 0) came out
    # yellow (2026-10-14). The usual gamma curve (^2.6) turns a screen value
    # into an LED level; then scaled to the brightness.
    return int(v * (max(0, min(255, c)) / 255) ** 2.6)


def backlight_on():
    v = S["backlight"]
    leds_fill(led_level(S["cr"], v), led_level(S["cg"], v) * GREEN // 100, led_level(S["cb"], v))


def light():
    # Bare LDR + internal pull-down: re-apply the pull before reading, drop the
    # first sample (it jumps), return the median of 7 (steady to about ±3).
    try:
        pin1.read_digital()
        pin1.set_pull(pin1.PULL_DOWN)
    except Exception:
        pass
    pin1.read_analog()
    return sorted(pin1.read_analog() for _ in range(7))[3]


def dark(lv):
    return lv < S["level"]


def clear(lv):
    return lv > S["level"] + S["hyst"]


def on_mark(lv):
    """Dark enough: on the mark, or at its edge (a little into the hysteresis)."""
    return lv < S["level"] + min(S["hyst"] // 3, 15)


shown = None


def show(img):
    global shown
    if img != shown:
        display.show(img)
        shown = img


# ---------- the state machine ----------
task = None        # what's running: a dict, or None when idle
pos = -1           # screen the window shows; -1 = don't know (just switched on)
last_action = 0


queued = [None]    # a BELT command that arrived while a move was finishing


def finish(reply):
    """A belt job is over: report it, with the position for moves — then run a
    queued BELT command, if one came in meanwhile."""
    global task
    task = None
    say(reply + (":%d" % pos if reply == "BELT:DONE" else ""))
    line, queued[0] = queued[0], None
    if line:
        safe_handle(line, running_time())


def start_tension(now, reply, move=0):
    """Top winds in (+), bottom winds in (−): the paper between them goes tight.
    The power ramps up from nothing (tick) — a full-power kick yanked the paper,
    and a steady low power couldn't get the motors turning at all.
    move: the direction just travelled; after tightening, settle onto the mark."""
    global task
    if S["tension"] <= 0 or S["tensionms"] <= 0:
        after_tension(now, reply, move)
        return
    ms = min(S["tensionms"], 1500)
    task = {"kind": "tension", "t0": now, "ramp": max(1, ms * 2 // 3), "end": now + ms,
            "reply": reply, "move": move, "p": -1}


def after_tension(now, reply, move):
    if move:
        start_settle(now, settle_first[move], reply, 2, move)
    else:
        finish(reply)


# Which way to creep first after a move up (1) / down (-1): up overshoots
# downwards (back), down passed through the mark on purpose (up = back onto its
# top edge). Then it follows whatever worked last time — a wrong first guess
# looked like "a rewind back and forth" (2026-10-13).
settle_first = {1: -1, -1: 1}


def start_settle(now, direction, reply, tries, move):
    """Creep until the sensor is on the mark again, so every screen stops in the
    same place. Not found within S["settle"] ms: search the other way for twice
    as long (back over the ground already covered)."""
    global task
    task = None
    lv = light()
    if on_mark(lv):
        say("MARK:on:%d" % lv)
        finish(reply)
        return
    m1, m2 = belt_speeds(direction)
    f = S["creep"] / max(1, max(abs(m1), abs(m2)))
    if not drive(int(m1 * f), int(m2 * f), min(S["kick"], 40)):
        fail("Wukong is off")
        return
    task = {"kind": "settle", "t0": now, "end": now + S["settle"] * (3 - tries), "reply": reply,
            "dir": direction, "tries": tries, "move": move}


def fail(why):
    global task, pos
    stop()
    task = None
    pos = -1
    queued[0] = None             # whatever was queued assumed this move worked
    say("BELT:ERROR:" + why)


def screen_phase(now):
    """How to find the end of the next screen."""
    task["t0"] = now
    if S["mode"] == 1 and S["level"] > 0:
        task["phase"] = "leave"
        task["end"] = now + blank_limit(task["dir"])
    else:
        task["phase"] = "timed"
        task["end"] = now + (S["steptime"] if task["dir"] > 0 else S["steptime"] * S["pull"] // max(1, S["rewind"]))


def blank_limit(direction):
    """How long a move may run without meeting a mark. It used to be the 8 s
    "timeout" — enough, when START wasn't recognised, to rewind the paper
    right off the spool (2026-10-14). Now 1.5 screens: learned screen times
    when known, else the timed-step estimate; never more than "timeout"."""
    learned = S["upms"] if direction > 0 else S["screenms"]
    guess = S["steptime"] if direction > 0 else S["steptime"] * S["pull"] // max(1, S["rewind"])
    return min(S["timeout"], (learned or guess) * 3 // 2)


def start_move(now, direction, screens, home=False):
    global task
    if task:
        say("BUSY")
        return
    hurry_off()
    if home and not (S["mode"] == 1 and S["level"] > 0):
        say("BELT:ERROR:finding START needs Stop on marks and a calibrated sensor")
        return
    # switched on somewhere inside a mark: back out of it first (up), so the
    # whole mark is measured on the way down — it may be START itself
    # Read the light BEFORE starting: the kick alone can carry the sensor into
    # the next mark, and it would then be taken for the mark the move began on.
    on = dark(light())
    if home and pos == 0 and on:
        finish("BELT:DONE")                              # already on START: nothing to do
        return
    unstick = direction < 0 and pos < 0 and on
    if not drive(*belt_speeds(1 if unstick else direction)):
        fail("Wukong is off")
        return
    # Find START from a known screen just counts the marks back to it (it still
    # stops early on a long mark); from an unknown spot it looks for the long
    # mark but never passes more marks than the strip has.
    count = home and pos > 0
    left = pos if count else S["screens"] + 1 if home else max(1, screens)
    task = {"kind": "move", "dir": direction, "left": left, "home": home and not count,
            "sure": pos >= 0, "passed": 0}
    screen_phase(now)
    if unstick:
        task["phase"] = "unstick"
    elif direction < 0 and task["phase"] == "leave" and not on:
        go_seek(now)
    show(Image.ARROW_N if direction > 0 else Image.ARROW_S)


MIN_MARK_MS = 25     # darker than the threshold for less than this = a flicker, not a mark


def go_seek(now):
    """Down, starting on clear paper: look for the next mark — straight away
    from an unknown spot (START may be right there), but not during the first
    mingap ms when the move began on a mark: the slow LDR still "sees" that mark
    for a moment after leaving it, which was taken for the next one — step down
    stayed on its screen, rocking up and down (2026-10-15)."""
    task["phase"] = "seek"
    task["gap0"] = now
    task["first"] = True
    task["quiet"] = now + S["mingap"] if task["sure"] else 0


def screen_done(now, marks):
    global pos
    if pos >= 0:
        pos += task["dir"]
    task["left"] -= 1
    if task["left"] > 0:
        screen_phase(now)          # motors keep running into the next screen
        return
    move = task["dir"] if marks and S["settle"] > 0 else 0
    brake() if marks else stop()
    start_tension(now, "BELT:DONE", move)


def mark_passed(now, length, gap):
    """Going down, a whole mark went by (length ms dark, after gap ms of paper).
    Ordinary, or the long START mark? Compared with the learned length of an
    ordinary one, or — not learned yet — with the paper before it (START's mark
    is 3× as long, an ordinary one under a tenth of a screen)."""
    global pos, save_due
    ref = S["markms"]
    # the paper before it is only a fair yardstick for a whole screen, i.e. when
    # the move began on a mark; from an unknown spot it may be a short stretch
    start = length > 2 * ref if ref else length * 6 >= gap
    say("MARK:%s:%dms" % ("START" if start else "passed", length))
    if start:                      # START — also ends a plain step down: below it is only blank paper
        pos = 1                    # screen_done steps it to 0
        task["left"] = 1
        screen_done(now, True)
        return
    # learn an ordinary mark's length (smoothed, saved), so START stands out next time
    if ref or task["sure"]:
        S["markms"] = length if not ref else (ref * 3 + length) // 4
        if task["sure"]:
            sc = S["screenms"]
            S["screenms"] = gap + length if not sc else (sc * 3 + gap + length) // 4
        save_due = now + 2000
    task["sure"] = True                    # from here on every gap is a whole screen
    if not task["home"]:
        screen_done(now, True)
        return
    task["passed"] += 1
    if task["passed"] > S["screens"]:
        fail("START not found after %d marks - check the light sensor calibration" % task["passed"])
        return
    if pos >= 0:
        pos -= 1
    screen_phase(now)


HOLD_MS = 600          # a hold stops by itself this long after the last HOLD


def hold(now, direction):
    """Run the belt while a button (page or service mode) is held down."""
    global task, pos
    hurry_off()
    if direction == 0:                                   # let go
        if task and task["kind"] == "hold":
            stop()
            start_tension(now, "HOLD:DONE")
        return
    if task and task["kind"] != "hold":
        say("BUSY")
        return
    if task and task["dir"] == direction:
        task["end"] = now + HOLD_MS                      # still held: keep going
        return
    m1, m2 = belt_speeds(direction)
    if not drive(m1, m2):
        fail("Wukong is off")
        return
    pos = -1                                             # moved by hand: position unknown
    task = {"kind": "hold", "dir": direction, "end": now + HOLD_MS}
    show(Image.ARROW_N if direction > 0 else Image.ARROW_S)


def tick(now):
    global task, pos
    if not task:
        return
    kind = task["kind"]
    if kind == "tension":
        if now >= task["end"]:
            stop()
            t = task
            task = None
            after_tension(now, t["reply"], t["move"])
            return
        p = S["tension"] * min(now - task["t0"], task["ramp"]) // task["ramp"]
        if abs(p - task["p"]) >= 3:
            task["p"] = p
            if not (motor(1, p) and motor(2, -p)):
                fail("Wukong is off")
        return
    if kind == "settle":
        if dark(light()):
            brake()
            if task["move"]:
                settle_first[task["move"]] = task["dir"]      # try this way first next time
            say("MARK:%s:%dms" % ("back" if task["dir"] == -task["move"] else "fwd", now - task["t0"]))
            finish(task["reply"])
        elif now >= task["end"]:
            stop()
            t = task
            if t["tries"] > 1:
                say("MARK:other way")
                start_settle(now, -t["dir"], t["reply"], 1, t["move"])
                return
            say("BELT:WARN:mark not found again")
            finish(t["reply"])
        return
    if kind == "cal":
        lv = light()
        task["lo"], task["hi"] = min(task["lo"], lv), max(task["hi"], lv)
        if now >= task["end"]:
            calibrated(now)
        return
    if kind == "jog":
        if now >= task["end"]:
            stop()
            finish("MOTOR:DONE")
        return
    if kind == "hold":
        if now >= task["end"]:
            stop()
            start_tension(now, "HOLD:DONE")
        return
    phase = task["phase"]
    if phase == "timed" or phase == "after":
        if now >= task["end"]:
            screen_done(now, phase == "after")
        return
    # mark mode
    if now >= task["end"]:
        if task["home"] and task["dir"] < 0 and phase == "seek":
            # nothing below: the paper is already past START, in the blank end —
            # START is the first mark going back up
            say("MARK:none below - searching up")
            stop()
            if not drive(*belt_speeds(1)):
                fail("Wukong is off")
                return
            task["dir"] = 1
            task["phase"] = "seek"
            task["end"] = now + blank_limit(1) * 2       # back over the blank it just ran, then START
            task["upstart"] = True
            return
        fail("no mark")
        return
    lv = light()
    first = task.get("first")
    task["first"] = False
    if phase == "unstick":
        if clear(lv):
            stop()
            drive(*belt_speeds(-1))
            screen_phase(now)
            go_seek(now)
        return
    if phase == "leave":
        # up: ignore the first mingap ms (still on the mark it starts from); down
        # starts on a mark's top edge and leaves it at once — a delay there let
        # START slip by unseen when starting just below it
        if (task["dir"] < 0 or now - task["t0"] >= S["mingap"]) and clear(lv):
            if task["dir"] < 0:
                go_seek(now)
            else:
                task["phase"] = "seek"
    elif phase == "seek":
        if dark(lv) and now >= task.get("quiet", 0):
            say("MARK:seen:%d" % lv)
            if task["dir"] > 0 and task["sure"] and not task.get("upstart"):
                u = S["upms"]                            # learn how long a screen takes going up
                S["upms"] = now - task["t0"] if not u else (u * 3 + now - task["t0"]) // 4
            if task["dir"] < 0:                          # down: go through it (see THE STRIP)
                task["phase"] = "through"
                # dark at the very first look: it began somewhere during the kick
                task["dark0"] = now - S["kick"] // 2 if first else now
            elif task.get("upstart"):
                pos = -1                                 # screen_done can't step an unknown position
                task["left"] = 1
                screen_done(now, True)
                pos = 0
            elif S["after"] > 0:
                task["phase"] = "after"
                task["end"] = now + S["after"]
            else:
                screen_done(now, True)
    elif phase == "through":
        if clear(lv):
            if now - task["dark0"] < MIN_MARK_MS and not first:
                task["phase"] = "seek"                   # a flicker, not a mark: keep looking
                say("MARK:flicker:%dms" % (now - task["dark0"]))
                return
            mark_passed(now, now - task["dark0"], task["dark0"] - task["gap0"])


def start_calibrate(now):
    """Auto-calibration (2026-10-16): after the backlight was changed, the old
    threshold sat above even the paper's reading — the board then thought it
    was always on a mark and Find START stopped at once. Running up 1.5 screens
    is sure to pass paper and at least one mark (the blank-paper limit)."""
    global task, pos
    if task:
        say("BUSY")
        return
    hurry_off()
    if not drive(*belt_speeds(1)):
        fail("Wukong is off")
        return
    pos = -1
    lv = light()
    task = {"kind": "cal", "end": now + blank_limit(1), "lo": lv, "hi": lv}
    show(Image.ARROW_N)


def calibrated(now):
    global task, save_due
    stop()
    lo, hi = task["lo"], task["hi"]
    task = None
    if hi - lo < 20:
        queued[0] = None                               # no find-START after a failed calibration
        say("CAL:FAIL:no mark seen (paper %d, darkest %d) - is the sensor on the marks?" % (hi, lo))
        return
    S["level"] = (hi + lo) // 2
    S["hyst"] = max(4, (hi - lo) // 6)
    S["mode"] = 1
    save_due = now + 500
    say("CAL:OK:%d:%d:%d:%d" % (hi, lo, S["level"], S["hyst"]))
    start_tension(now, "TENSION:DONE")


def stop_all():
    global task
    task = None
    hurry_off()
    stop()
    say("STOPPED")


# ---------- bell (never holds up the loop: the belt keeps moving while it rings) ----------
bell = {"left": 0, "on": False, "next": 0}


def ring(times):
    bell["left"] += max(1, min(times, 10))


def bell_pin(on):
    pin2.write_digital(1 if on != bool(S["bellinv"]) else 0)


def bell_tick(now):
    if now < bell["next"]:
        return
    if bell["on"]:
        bell_pin(False)
        bell["on"] = False
        bell["next"] = now + 300
    elif bell["left"] > 0:
        bell["left"] -= 1
        bell_pin(True)
        bell["on"] = True
        bell["next"] = now + max(20, min(S["bellms"], 3000))


# ---------- right / wrong flash ----------
# Green or red blinks before the belt moves (2026-10-14). The light sensor
# reads the backlight, so a move must never run in a flash colour: BELT
# commands that arrive while it blinks are kept and run once the normal
# light is back.
FLASH_COLOURS = {"G": (0, 1, 0), "R": (1, 0, 0)}
FLASH_ON, FLASH_OFF, FLASH_TIMES = 180, 120, 3
flash = {"left": 0, "on": False, "next": 0, "rgb": (0, 0, 0), "then": [], "win": 0}
WIN_MS = 6000


hurry = {"end": 0, "dim": False, "next": 0}


def hurry_off():
    if hurry["end"]:
        hurry["end"] = 0
        backlight_on()


def hurry_tick(now):
    """Blinks dark for 70 ms; the gap shrinks from ~1 s to ~0.15 s as the end nears."""
    if not hurry["end"] or now < hurry["next"]:
        return
    left = hurry["end"] - now
    if left <= 0:
        hurry_off()
        return
    if hurry["dim"]:
        backlight_on()
        hurry["dim"] = False
        hurry["next"] = now + 80 + left * 85 // 1000
    else:
        v = S["backlight"] // 5
        leds_fill(v, v, v)
        hurry["dim"] = True
        hurry["next"] = now + 70


def start_flash(now, colour):
    hurry_off()
    v = min(LED_MAX, max(40, S["backlight"] * 2))       # brighter than the backlight, so it reads
    c = FLASH_COLOURS.get(colour, (1, 1, 1))
    flash["rgb"] = (v * c[0], v * c[1], v * c[2])
    flash["left"], flash["on"], flash["next"] = FLASH_TIMES, False, now


def wheel(h, v):
    """A rainbow colour for h 0-255 at level v."""
    h %= 256
    if h < 85:
        return (v * (85 - h) // 85, v * h // 85, 0)
    if h < 170:
        h -= 85
        return (0, v * (85 - h) // 85, v * h // 85)
    h -= 170
    return (v * h // 85, 0, v * (85 - h) // 85)


def start_win(now):
    hurry_off()
    flash["win"] = now + WIN_MS
    flash["left"], flash["on"], flash["next"] = 0, False, now


def win_tick(now):
    """The rainbow runs round the matrix (each pixel a step further along the
    wheel, the whole wheel turning) with a few white sparkles, ~25 frames/s."""
    if now >= flash["win"]:
        flash["win"] = 0
        flash_done(now)
        return
    if now < flash["next"]:
        return
    flash["next"] = now + 40
    v = min(LED_MAX, max(40, S["backlight"] * 2))
    turn = now // 6
    for i in range(LED_COUNT):
        leds[i] = wheel(i * 4 + turn, v)
    for _ in range(3):
        leds[random.randrange(LED_COUNT)] = (v, v, v)
    leds.show()


def flash_done(now):
    """Normal light again, then the moves that waited."""
    backlight_on()
    waiting, flash["then"] = flash["then"], []
    for line in waiting:
        safe_handle(line, now)


def flash_tick(now):
    if flash["win"]:
        win_tick(now)
        return
    if not (flash["left"] or flash["on"]) or now < flash["next"]:
        return
    if flash["on"]:
        leds_fill(0, 0, 0)
        flash["on"] = False
        flash["next"] = now + FLASH_OFF
        if flash["left"] == 0:                           # last blink done: normal light, then the waiting moves
            flash_done(now)
    else:
        flash["left"] -= 1
        leds_fill(*flash["rgb"])
        flash["on"] = True
        flash["next"] = now + FLASH_ON


def flashing():
    return flash["left"] > 0 or flash["on"] or flash["win"] > 0


# ---------- commands ----------
save_due = 0
streaming = False
tracing = False


def set_value(key, value, now):
    global save_due
    if key not in S:
        say("ERR:unknown setting " + key)
        return
    S[key] = int(value)
    save_due = now + 2000          # write to flash once things settle
    if key == "bellinv":
        bell_pin(False)
    if key in ("backlight", "cr", "cg", "cb"):
        backlight_on()
    say("SET:OK:%s:%d" % (key, S[key]))


def handle(line, now):
    global task, streaming, last_action, pos, tracing
    parts = line.split(":")
    cmd = parts[0]
    last_action = now
    if line == "STOP":
        if flashing():
            flash["left"], flash["on"], flash["then"], flash["win"] = 0, False, [], 0
            backlight_on()
        queued[0] = None
        stop_all()
    elif line == "PING":
        say("PONG")
    elif line == "LIGHT?":
        say("LIGHT:%d" % light())
    elif line == "STATUS?":
        say("STATUS:%s:%s:%d" % (task["kind"] if task else "idle", "W1" if wukong_ok else "W0", pos))
    elif line == "SETTINGS?":
        say("SETTINGS:" + ",".join("%s=%d" % (k, S[k]) for k in S))
    elif line == "SAVE":
        save()
        say("SAVED")
    elif cmd == "SET" and len(parts) == 3:
        set_value(parts[1], parts[2], now)
    elif line == "CALIBRATE":
        start_calibrate(now)
    elif cmd == "TRACE":
        tracing = parts[1] == "ON"
        say("TRACE:OK:" + ("ON" if tracing else "OFF"))
    elif cmd == "STREAM":
        streaming = parts[1] == "ON"
        say("STREAM:OK:" + ("ON" if streaming else "OFF"))
    elif cmd == "BELT" and flashing():
        flash["then"].append(line)                       # runs when the flash is over
    elif cmd == "BELT" and task and task["kind"] in ("move", "tension", "settle"):
        queued[0] = line                                 # runs when this move is done (the latest one wins)
        say("BELT:QUEUED")
    elif cmd == "BELT":
        if parts[1] == "STEP":
            start_move(now, 1, 1)
        elif parts[1] == "UP":
            start_move(now, 1, int(parts[2]))
        elif parts[1] == "BACK":
            start_move(now, -1, int(parts[2]))
        elif parts[1] == "HOME":
            start_move(now, -1, 0, True)
        else:
            say("ERR:unknown " + line[:24])
    elif cmd == "POS":
        pos = int(parts[1])
        say("POS:OK:%d" % pos)
    elif cmd == "HOLD":
        hold(now, int(parts[1]))
    elif line == "TENSION":
        if task:
            say("BUSY")
        else:
            start_tension(now, "TENSION:DONE")
    elif cmd == "MOTOR":
        if task:
            say("BUSY")
        elif drive(int(parts[2]), None) if parts[1] == "1" else drive(None, int(parts[2])):
            pos = -1
            task = {"kind": "jog", "end": now + min(int(parts[3]), 5000)}
            show(parts[1])
        else:
            say("MOTOR:ERROR:Wukong is off")
    elif cmd == "LED":
        if parts[1] == "ON":
            hurry["end"] = 0
            backlight_on()
        elif parts[1] == "OFF":
            hurry["end"] = 0
            leds_fill(0, 0, 0)
        elif parts[1] == "RGB":
            leds_fill(int(parts[2]), int(parts[3]), int(parts[4]))
        elif parts[1] == "FLASH":
            start_flash(now, parts[2] if len(parts) > 2 else "G")
        elif parts[1] == "WIN":
            start_win(now)
        elif parts[1] == "HURRY":
            if not flashing():
                hurry["end"], hurry["dim"], hurry["next"] = now + min(int(parts[2]), 30000), False, now
        say("LED:OK:" + parts[1])
    elif cmd == "BELL":
        ring(int(parts[-1]) if len(parts) > 1 and parts[-1].isdigit() else 1)
    else:
        say("ERR:unknown " + line[:24])


def safe_handle(line, now):
    try:
        handle(line, now)
    except Exception as e:
        say("ERR:%s:%s" % (line[:20], e))


# ---------- buttons + service mode ----------
service = False
held = {"yes": False, "no": False, "coin": False}
both_since = 0     # when YES + NO started being held together (0 = not both)
both_used = False  # this hold already calibrated: no coin on release
# YES + NO pressed together briefly = start a game, like a coin (the maker, 2026-10-16).
# So a lone press waits CHORD_MS for the other before it counts as an answer —
# otherwise starting a game would also answer with whichever was pressed first.
CHORD_MS = 150
CAL_HOLD_MS = 3000       # the micro:bit's own A + B
CAL_ARCADE_MS = 5000     # the arcade YES + NO (10 s until 2026-10-20; the maker wanted 5)
cal_this = [False]       # this hold already started a calibration
ab_since = [0]        # when the micro:bit's own A + B started being held together
pending = [None, 0]   # the lone press waiting: "yes"/"no", when
chord = [False]       # both went down together: decided when both are released


def calibrate_then_home(now):
    if not task:
        start_calibrate(now)
        if task and task["kind"] == "cal":
            queued[0] = "BELT:HOME"                   # finish() runs it after calibrating


def buttons(now):
    global service, both_since, both_used
    yes = pin8.read_digital() == 0 or button_a.is_pressed()
    no = pin12.read_digital() == 0 or button_b.is_pressed()
    coin = pin13.read_digital() == 0
    if button_a.is_pressed() and button_b.is_pressed():
        if not ab_since[0]:
            ab_since[0] = now
        elif not both_used and now - ab_since[0] >= CAL_HOLD_MS:
            both_used = True                          # no coin, no service mode from this hold
            cal_this[0] = True
            calibrate_then_home(now)
    else:
        ab_since[0] = 0
    if yes and no:
        if not both_since:
            both_since = now
        if both_since and not cal_this[0] and now - both_since >= CAL_ARCADE_MS:
            cal_this[0] = True
            both_used = True                          # no coin from this hold
            calibrate_then_home(now)
    elif not yes and not no:
        if chord[0] and not both_used and not service:
            say("COIN:1")                              # a quick press of both: start
        chord[0] = False
        both_since = 0
        both_used = False
        cal_this[0] = False
    if service:
        if both_since or (task and task["kind"] != "hold"):
            pass                                       # both held, or finding START: leave it
        elif yes or no:
            hold(now, 1 if yes else -1)
        elif task and task["kind"] == "hold":
            hold(now, 0)
        if coin and not held["coin"] and not task:
            start_move(now, -1, 0, True)
    else:
        for name, down in (("yes", yes), ("no", no)):
            if down and not held[name] and not chord[0]:
                if pending[0] and pending[0] != name and now - pending[1] <= CHORD_MS:
                    chord[0] = True                    # the other one came in time: both together
                    pending[0] = None
                elif not pending[0]:
                    pending[0], pending[1] = name, now
        if pending[0] and now - pending[1] > CHORD_MS:
            say("ANSWER:" + pending[0].upper())        # no partner: a plain answer
            pending[0] = None
        if coin and not held["coin"]:
            say("COIN:1")
    held["yes"], held["no"], held["coin"] = yes, no, coin


# ---------- main loop ----------
line_in = ""
next_hb = 0
next_stream = 0
next_trace = 0
next_buttons = 0
stop()
bell_pin(False)                  # quiet from the start, whichever way the relay switches
show("M")
try:
    backlight_on()
except Exception as e:
    say("ERR:backlight:%s" % e)

while True:
    now = running_time()
    try:
        if uart.any():
            line_in += (uart.read() or b"").decode("utf-8", "ignore")
            if len(line_in) > 200 and "\n" not in line_in:
                line_in = ""                      # garbage without line ends: drop it
            while "\n" in line_in:
                cmd, line_in = line_in.split("\n", 1)
                cmd = cmd.strip()
                if cmd:
                    safe_handle(cmd, now)

        tick(now)
        bell_tick(now)
        flash_tick(now)
        hurry_tick(now)
        if now >= next_buttons:                   # every 20 ms: a bouncing switch can't double-press
            next_buttons = now + 20
            buttons(now)
        if not task:
            show("S" if service else "M")
            if S["idletension"] > 0 and now - last_action > S["idletension"] * 1000:
                last_action = now
                start_tension(now, "TENSION:AUTO")

        if tracing and task and now >= next_trace:
            next_trace = now + 20
            say("T:%d:%d:%s" % (now, light(), task.get("phase", task["kind"])[:2]))
        if streaming and now >= next_stream:
            next_stream = now + 150
            say("LIGHT:%d" % light())
        if now >= next_hb:
            next_hb = now + 2000
            say("HB:%s:%s:%d" % (task["kind"] if task else ("service" if service else "idle"),
                                 "W1" if wukong_ok else "W0", pos))
        if save_due and now >= save_due:
            save_due = 0
            save()
    except Exception as e:
        task = None
        stop()
        say("ERR:loop:%s" % e)
    sleep(2)
