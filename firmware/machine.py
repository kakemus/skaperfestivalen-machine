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
#   SET:key:value  /  SETTINGS?  /  SAVE  settings (kept on the board in settings.txt)
#   STREAM:ON|OFF  LIGHT?  PING  STATUS?  STOP
# Replies: BELT:DONE:pos / BELT:ERROR:why / BELT:WARN:..., MARK:... (what the
#   sensor did), HOLD:DONE, MOTOR:DONE, TENSION:DONE, STOPPED, BUSY,
#   SET:OK:key:value, SETTINGS:k=v,..., LIGHT:n, PONG, HB:state:W1|W0:pos,
#   WUKONG:ON|OFF, ANSWER:YES|NO, COIN:1, SERVICE:ON|OFF, ERR:...
#   pos is -1 while the board doesn't know where it is (after switching on).
#
# SERVICE MODE: hold YES + NO (or A + B) for 5 s, again to leave. The display
# shows S. Hold YES = wind up, hold NO = wind down, coin = find START. Presses
# aren't sent to the game meanwhile.
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
#   Bell: P2 → relay.   YES: P8 to GND.   NO: P12 to GND.   Coin: P13 to GND.   A/B = YES/NO.
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

WUKONG = 0x10
BELL_MS = 250
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
    "backlight": 25,   # backlight white level 0-120 (keep it steady: the light sensor reads it)
    "kick": 80,        # ms of full power every time a motor starts (0 = off) — see drive()
    "inv1": 0,         # 1 = motor M1 is wired the other way round: flip its direction everywhere
    "inv2": 0,         # 1 = same for M2
    "brake": 30,       # ms of reverse power when a mark is found, so the spools don't coast past it
    "creep": 40,       # slow speed used to settle onto a mark
    "settle": 600,     # after a mark stop: creep at most this long each way onto the mark (0 = off)
    "markms": 0,       # how long an ordinary mark stays dark going down — learned, tells START apart
    "screenms": 0,     # how long one screen takes going down — learned, limits a search for START
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


def backlight_on():
    v = S["backlight"]
    leds_fill(v, v, v)


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


def finish(reply):
    """A belt job is over: report it, with the position for moves."""
    global task
    task = None
    say(reply + (":%d" % pos if reply == "BELT:DONE" else ""))


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
    say("BELT:ERROR:" + why)


def screen_phase(now):
    """How to find the end of the next screen."""
    task["t0"] = now
    if S["mode"] == 1 and S["level"] > 0:
        task["phase"] = "leave"
        task["end"] = now + S["timeout"]
    else:
        task["phase"] = "timed"
        task["end"] = now + (S["steptime"] if task["dir"] > 0 else S["steptime"] * S["pull"] // max(1, S["rewind"]))


def start_move(now, direction, screens, home=False):
    global task
    if task:
        say("BUSY")
        return
    if home and not (S["mode"] == 1 and S["level"] > 0):
        say("BELT:ERROR:finding START needs Stop on marks and a calibrated sensor")
        return
    # switched on somewhere inside a mark: back out of it first (up), so the
    # whole mark is measured on the way down — it may be START itself
    # Read the light BEFORE starting: the kick alone can carry the sensor into
    # the next mark, and it would then be taken for the mark the move began on.
    on = dark(light())
    unstick = direction < 0 and pos < 0 and on
    if not drive(*belt_speeds(1 if unstick else direction)):
        fail("Wukong is off")
        return
    task = {"kind": "move", "dir": direction, "left": 99 if home else max(1, screens), "home": home,
            "sure": pos >= 0}
    screen_phase(now)
    if unstick:
        task["phase"] = "unstick"
    elif direction < 0 and task["phase"] == "leave" and not on:
        go_seek(now)
    show(Image.ARROW_N if direction > 0 else Image.ARROW_S)


def go_seek(now):
    """Down, starting on clear paper: look for the next mark straight away."""
    task["phase"] = "seek"
    task["gap0"] = now
    task["first"] = True
    if task["home"] and S["screenms"]:
        task["end"] = now + S["screenms"] * 3 // 2   # no mark in 1.5 screens: blank paper, see tick


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
    if pos >= 0:
        pos -= 1
    screen_phase(now)


HOLD_MS = 600          # a hold stops by itself this long after the last HOLD


def hold(now, direction):
    """Run the belt while a button (page or service mode) is held down."""
    global task, pos
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
            task["end"] = now + S["timeout"]
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
        if dark(lv):
            say("MARK:seen:%d" % lv)
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
            mark_passed(now, now - task["dark0"], task["dark0"] - task["gap0"])


def stop_all():
    global task
    task = None
    stop()
    say("STOPPED")


# ---------- bell (never holds up the loop: the belt keeps moving while it rings) ----------
bell = {"left": 0, "on": False, "next": 0}


def ring(times):
    bell["left"] += max(1, min(times, 10))


def bell_tick(now):
    if now < bell["next"]:
        return
    if bell["on"]:
        pin2.write_digital(0)
        bell["on"] = False
        bell["next"] = now + 300
    elif bell["left"] > 0:
        bell["left"] -= 1
        pin2.write_digital(1)
        bell["on"] = True
        bell["next"] = now + BELL_MS


# ---------- commands ----------
save_due = 0
streaming = False


def set_value(key, value, now):
    global save_due
    if key not in S:
        say("ERR:unknown setting " + key)
        return
    S[key] = int(value)
    save_due = now + 2000          # write to flash once things settle
    if key == "backlight":
        backlight_on()
    say("SET:OK:%s:%d" % (key, S[key]))


def handle(line, now):
    global task, streaming, last_action, pos
    parts = line.split(":")
    cmd = parts[0]
    last_action = now
    if line == "STOP":
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
    elif cmd == "STREAM":
        streaming = parts[1] == "ON"
        say("STREAM:OK:" + ("ON" if streaming else "OFF"))
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
            backlight_on()
        elif parts[1] == "OFF":
            leds_fill(0, 0, 0)
        elif parts[1] == "RGB":
            leds_fill(int(parts[2]), int(parts[3]), int(parts[4]))
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
SERVICE_HOLD_MS = 5000
service = False
held = {"yes": False, "no": False, "coin": False}
both_since = 0     # when YES + NO started being held together (0 = not both)
both_used = False  # this hold already toggled service: wait for a release


def buttons(now):
    global service, both_since, both_used
    yes = pin8.read_digital() == 0 or button_a.is_pressed()
    no = pin12.read_digital() == 0 or button_b.is_pressed()
    coin = pin13.read_digital() == 0
    if yes and no:
        if not both_since:
            both_since = now
        elif not both_used and now - both_since >= SERVICE_HOLD_MS:
            both_used = True
            service = not service
            if task and task["kind"] == "hold":
                hold(now, 0)
            say("SERVICE:" + ("ON" if service else "OFF"))
    elif not yes and not no:
        both_since = 0
        both_used = False
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
        if yes and not held["yes"]:
            say("ANSWER:YES")
        if no and not held["no"]:
            say("ANSWER:NO")
        if coin and not held["coin"]:
            say("COIN:1")
    held["yes"], held["no"], held["coin"] = yes, no, coin


# ---------- main loop ----------
line_in = ""
next_hb = 0
next_stream = 0
next_buttons = 0
stop()
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
        if now >= next_buttons:                   # every 20 ms: a bouncing switch can't double-press
            next_buttons = now + 20
            buttons(now)
        if not task:
            show("S" if service else "M")
            if S["idletension"] > 0 and now - last_action > S["idletension"] * 1000:
                last_action = now
                start_tension(now, "TENSION:AUTO")

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
