# The machine micro:bit (V2), sitting on an ElecFreaks Wukong motor board.
# Plug it into the computer by USB (or talk to it by radio through receiver.py).
#
# It runs the belt (two TT motors winding a paper scroll between two spools),
# watches the strip's black marks with a light-dependent resistor, rings the
# bell through a relay, and reads the YES / NO buttons and the coin switch.
#
# NEVER BLOCKS (rewritten 2026-10-12): the old version slept through every
# motor move, so commands sent meanwhile piled up in the tiny serial buffer and
# got cut off ("M1 forward works but not M2 back"), and the page's writes could
# stall. Now the main loop keeps reading while motors run; moves are a small
# state machine ticked every few ms; STOP works at any moment; a bad line
# answers ERR instead of crashing; a heartbeat goes out every 2 s.
#
# Commands (one per line):
#   BELT:STEP | BELT:UP:n | BELT:BACK:n   move 1 / n screens up, n screens down
#   TENSION                               both spools pull against each other a moment
#   HOLD:1 | HOLD:-1 | HOLD:0             run the belt up/down while held: the page repeats it every
#                                         ~250 ms; without a repeat it stops by itself after 600 ms;
#                                         HOLD:0 = let go (stop + tighten)
#   MOTOR:m:speed:ms                      run motor m (1/2) at -100..100 for ms (≤ 5 s)
#   STOP                                  stop everything now
#   SET:key:value  /  SETTINGS?  /  SAVE  settings (kept on the board in settings.txt)
#   STREAM:ON|OFF                         send LIGHT:n ~7 times a second
#   LED:ON | LED:OFF | LED:RGB:r:g:b | LED:TEST   the backlight (8×8 NeoPixel matrix)
#   LIGHT?  PING  STATUS?  BELL:DING:n
#   (older: SPEEDS:p:f:r  SNUG:s:ms  MARKLEVEL:n  STOPMODE:MARK|TIME — still understood)
# Replies: BELT:DONE / BELT:ERROR:why, MOTOR:DONE, TENSION:DONE, STOPPED, BUSY,
#   SET:OK:key:value, SETTINGS:k=v,..., LIGHT:n, PONG, HB:state:wukong:light,
#   WUKONG:ON|OFF, ANSWER:YES|NO, COIN:1, ERR:...
#
# WIRING
#   Wukong M1 = top spool (+ = winds paper in, strip moves up)
#   Wukong M2 = bottom spool (+ = lets paper out; − = winds it back in)
#   LDR: V (3.3 V) ── LDR ── P1, internal pull-down (or 10 kΩ P1 ── GND). Paper = high, mark = low.
#   Bell: P2 → relay.   YES: P8 to GND.   NO: P12 to GND.   Coin: P13 to GND.   A/B = YES/NO.
#   Backlight: 8×8 NeoPixel (WS2812B) IN → P15 (yellow S pin), V- → G, V+ → the Wukong's 5V pin in
#   the small middle header (NOT the red pin rows — those are 3.3 V, too low for these LEDs; that
#   was why it stayed dark at first). Or a separate 5 V supply with its GND joined to the Wukong's. 64 LEDs at full white draw ~4 A, so the
#   brightness is capped at LED_MAX; the default is dim enough to run from the Wukong for tests.
from microbit import *
import radio
from neopixel import NeoPixel

GROUP = 42
WUKONG = 0x10
BELL_MS = 250
LED_PIN = pin15
LED_COUNT = 64
LED_MAX = 120          # never brighter than this per colour channel (current!)

S = {                  # settings — the page sets these, the board keeps them in settings.txt
    "pull": 60,        # top spool speed going up (0-100)
    "feed": 45,        # the spool letting paper out — slower than the pulling one keeps it tight
    "rewind": 80,      # bottom spool speed going down
    "tension": 55,     # strength of the tug after every move (0 = off) — reached by a soft ramp
    "tensionms": 400,  # how long the tug lasts (first 2/3 ramping up, then holding)
    "mode": 0,         # 0 = timed steps, 1 = stop on marks
    "level": 0,        # light below this = a mark (0 = not calibrated → timed steps)
    "hyst": 8,         # light must rise above level + hyst to count as "off the mark"
    "steptime": 1500,  # timed mode: ms per screen
    "timeout": 8000,   # mark mode: give up on a screen after this many ms
    "after": 0,        # keep going this many ms after a mark is found (centre the screen)
    "mingap": 300,     # ignore marks during the first ms of a screen (still leaving the old one)
    "idletension": 0,  # re-tighten after this many s of standing still (0 = off)
    "backlight": 25,   # backlight white level 0-120 (keep it steady: the light sensor reads it)
    "kick": 80,        # ms of full power every time a motor starts (0 = off) — see drive()
    "inv1": 0,         # 1 = motor M1 is wired the other way round: flip its direction everywhere
    "inv2": 0,         # 1 = same for M2 (the maker's build has both flipped — set from the belt page)
    "brake": 30,       # ms of reverse power when a mark is found, so the spools don't coast past it
    "creep": 40,       # slow speed used to back up onto the mark again (settle)
    "settle": 1500,    # after a mark stop: back up at most this long until the sensor is on the mark (0 = off)
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


radio.config(group=GROUP, length=64, queue=10)
radio.on()
uart.init(115200)
for p in (pin8, pin12, pin13):
    p.set_pull(p.PULL_UP)
load()


def say(line):
    print(line)
    radio.send(line)


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


leds = NeoPixel(LED_PIN, LED_COUNT)


def leds_fill(r, g, b):
    c = (min(LED_MAX, max(0, r)), min(LED_MAX, max(0, g)), min(LED_MAX, max(0, b)))
    for i in range(LED_COUNT):
        leds[i] = c
    leds.show()


def backlight_on():
    v = S["backlight"]
    leds_fill(v, v, v)


def drive(m1, m2, kick=True, kick_ms=None):
    """Start motors with a kick: full power for S["kick"] ms, then the asked speed.
    A TT motor at half power often can't break loose from a standstill — the
    spool just sat there while the board reported MOTOR:DONE (2026-10-13); once
    turning it keeps going. None = leave that motor alone. False if the Wukong
    doesn't answer."""
    ok = True
    k = S["kick"] if kick_ms is None else kick_ms
    if kick and k > 0:
        for m, v in ((1, m1), (2, m2)):
            if v:
                ok = motor(m, 100 if v > 0 else -100) and ok
        sleep(min(k, 200))
    for m, v in ((1, m1), (2, m2)):
        if v is not None:
            ok = motor(m, v) and ok
    return ok


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


# ---------- the state machine ----------
task = None        # what's running: a dict, or None when idle
last_action = 0
shown = None


def show(img):
    global shown
    if img != shown:
        display.show(img)
        shown = img


def start_tension(now, reply, settle_dir=0):
    """Top winds in (+), bottom winds in (−): the paper between them goes tight.
    The power ramps up from nothing (tick) — a full-power kick yanked the paper,
    and a steady low power couldn't get the motors turning at all.
    settle_dir: after tightening, back up that way onto the mark (see start_settle)."""
    global task
    if S["tension"] <= 0 or S["tensionms"] <= 0:
        task = None
        finish_after_tension(now, reply, settle_dir)
        return
    ms = min(S["tensionms"], 1500)
    task = {"kind": "tension", "t0": now, "ramp": max(1, ms * 2 // 3), "end": now + ms,
            "reply": reply, "settle": settle_dir, "p": -1}


def finish_after_tension(now, reply, settle_dir):
    if settle_dir:
        start_settle(now, settle_dir, reply)
    else:
        say(reply)


def start_settle(now, direction, reply, tries=2):
    """The paper may have gone past the mark (coasting, the tug). Creep back
    until the sensor sees the mark again, so every screen stops in the same place.
    Not found within S["settle"] ms: the tug moved it the other way — search
    that way for twice as long (back over the ground already covered)."""
    global task
    task = None
    lv = light()
    if lv < S["level"]:
        say("MARK:on:%d" % lv)
        say(reply)
        return
    m1, m2 = belt_speeds(direction)
    f = S["creep"] / max(1, max(abs(m1), abs(m2)))
    if not drive(int(m1 * f), int(m2 * f), kick_ms=min(S["kick"], 40)):
        say("BELT:ERROR:Wukong is off")
        return
    task = {"kind": "settle", "t0": now, "end": now + S["settle"] * (3 - tries), "reply": reply,
            "dir": direction, "tries": tries}


def screen_phase(now):
    """How to find the end of the next screen."""
    marks = S["mode"] == 1 and S["level"] > 0
    t = S["steptime"] if task["dir"] > 0 else S["steptime"] * S["pull"] // max(1, S["rewind"])
    task["t0"] = now
    if marks:
        task["phase"] = "leave"
        task["end"] = now + S["timeout"]
    else:
        task["phase"] = "timed"
        task["end"] = now + t


def belt_speeds(direction):
    if direction > 0:
        return S["pull"], S["feed"]                                     # top pulls, bottom lets out
    return -(S["feed"] * S["rewind"] // max(1, S["pull"])), -S["rewind"]  # bottom pulls, top lets out


HOLD_MS = 600          # a hold stops by itself this long after the last HOLD from the page


def hold(now, direction):
    """Run the belt while the page's button is held down."""
    global task
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
        stop()
        say("BELT:ERROR:Wukong is off")
        task = None
        return
    task = {"kind": "hold", "dir": direction, "end": now + HOLD_MS, "reply": "HOLD:DONE"}
    show(Image.ARROW_N if direction > 0 else Image.ARROW_S)


def start_move(now, direction, screens):
    global task
    if task:
        say("BUSY")
        return
    m1, m2 = belt_speeds(direction)
    if not drive(m1, m2):
        stop()
        say("BELT:ERROR:Wukong is off")
        return
    if S["mode"] == 1 and S["level"] <= 0:
        say("BELT:WARN:not calibrated - timed step")
    task = {"kind": "move", "dir": direction, "left": max(1, screens)}
    screen_phase(now)
    show(Image.ARROW_N if direction > 0 else Image.ARROW_S)


def screen_done(now):
    global task
    task["left"] -= 1
    if task["left"] > 0:
        screen_phase(now)          # motors keep running into the next screen
    else:
        marks = task["phase"] != "timed" and task["phase"] != "after"
        back = -task["dir"] if marks and S["settle"] > 0 else 0
        brake() if marks else stop()
        start_tension(now, "BELT:DONE", back)


def tick(now):
    global task
    if not task:
        return
    kind = task["kind"]
    if kind == "ledtest":
        if now >= task["end"]:
            colours = ((60, 0, 0), (0, 60, 0), (0, 0, 60), (60, 60, 60))
            if task["i"] < len(colours):
                leds_fill(*colours[task["i"]])
                task["i"] += 1
                task["end"] = now + 600
            else:
                backlight_on()
                say("LED:DONE")
                task = None
        return
    if kind == "tension":
        if now >= task["end"]:
            stop()
            t = task
            task = None
            finish_after_tension(now, t["reply"], t["settle"])
            return
        p = S["tension"] * min(now - task["t0"], task["ramp"]) // task["ramp"]
        if abs(p - task["p"]) >= 3:
            task["p"] = p
            if not (motor(1, p) and motor(2, -p)):
                stop()
                say("BELT:ERROR:Wukong is off")
                task = None
        return
    if kind == "settle":
        lv = light()
        if lv < S["level"]:
            brake()
            say("MARK:back:%dms" % (now - task["t0"]))
            say(task["reply"])
            task = None
        elif now >= task["end"]:
            stop()
            if task["tries"] > 1:
                t = task
                start_settle(now, -t["dir"], t["reply"], 1)
                return
            say("BELT:WARN:mark not found again")
            say(task["reply"])
            task = None
        return
    if kind in ("jog", "hold"):
        if now >= task["end"]:
            stop()
            say(task["reply"])
            task = None
        return
    phase = task["phase"]
    if phase == "timed" or phase == "after":
        if now >= task["end"]:
            screen_done(now)
        return
    # mark mode
    if now >= task["end"]:
        stop()
        say("BELT:ERROR:no mark")
        task = None
        return
    lv = light()
    if phase == "leave":
        if now - task["t0"] >= S["mingap"] and lv > S["level"] + S["hyst"]:
            task["phase"] = "seek"
    elif phase == "seek":
        if lv < S["level"]:
            say("MARK:seen:%d" % lv)
            if S["after"] > 0:
                task["phase"] = "after"
                task["end"] = now + S["after"]
            else:
                screen_done(now)


def stop_all():
    global task
    task = None
    stop()
    say("STOPPED")


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
    global task, streaming, last_action
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
        say("STATUS:%s:%s" % (task["kind"] if task else "idle", "W1" if wukong_ok else "W0"))
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
    elif line == "BELT:STEP":
        start_move(now, 1, 1)
    elif cmd == "BELT" and parts[1] == "UP":
        start_move(now, 1, int(parts[2]))
    elif cmd == "BELT" and parts[1] == "BACK":
        start_move(now, -1, int(parts[2]))
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
            task = {"kind": "jog", "end": now + min(int(parts[3]), 5000), "reply": "MOTOR:DONE"}
            show(parts[1])
        else:
            say("MOTOR:ERROR:Wukong is off")
    elif cmd == "LED":
        if parts[1] == "ON":
            backlight_on()
            say("LED:OK:ON")
        elif parts[1] == "OFF":
            leds_fill(0, 0, 0)
            say("LED:OK:OFF")
        elif parts[1] == "RGB":
            leds_fill(int(parts[2]), int(parts[3]), int(parts[4]))
            say("LED:OK:RGB")
        elif parts[1] == "TEST":
            if task:
                say("BUSY")
            else:
                task = {"kind": "ledtest", "i": 0, "end": now}
    elif cmd == "BELL":
        for _ in range(int(parts[2]) if len(parts) > 2 else 1):
            pin2.write_digital(1)
            sleep(BELL_MS)
            pin2.write_digital(0)
            sleep(300)
    # older commands, still understood (the game page sends these)
    elif cmd == "SPEEDS":
        for k, v in zip(("pull", "feed", "rewind"), parts[1:4]):
            set_value(k, v, now)
    elif cmd == "SNUG":
        set_value("tension", parts[1], now)
        set_value("tensionms", parts[2], now)
    elif cmd == "MARKLEVEL":
        set_value("level", parts[1], now)
    elif cmd == "STOPMODE":
        set_value("mode", 1 if parts[1] == "MARK" else 0, now)
    else:
        say("ERR:unknown " + line[:24])


def safe_handle(line, now):
    try:
        handle(line, now)
    except Exception as e:
        say("ERR:%s:%s" % (line[:20], e))


# ---------- main loop ----------
buttons = {"yes": 1, "no": 1, "coin": 1}
line_in = ""
next_hb = 0
next_stream = 0
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
        msg = radio.receive()
        while msg:
            safe_handle(msg.strip(), now)
            msg = radio.receive()

        tick(now)
        if not task:
            show("M")
            if S["idletension"] > 0 and now - last_action > S["idletension"] * 1000:
                last_action = now
                start_tension(now, "TENSION:AUTO")

        for key, p, out in (("yes", pin8, "ANSWER:YES"), ("no", pin12, "ANSWER:NO"), ("coin", pin13, "COIN:1")):
            v = p.read_digital()
            if v == 0 and buttons[key] == 1:
                say(out)
            buttons[key] = v
        if button_a.was_pressed():
            say("ANSWER:YES")
        if button_b.was_pressed():
            say("ANSWER:NO")

        if streaming and now >= next_stream:
            next_stream = now + 150
            say("LIGHT:%d" % light())
        if now >= next_hb:
            next_hb = now + 2000
            say("HB:%s:%s" % (task["kind"] if task else "idle", "W1" if wukong_ok else "W0"))
        if save_due and now >= save_due:
            save_due = 0
            save()
    except Exception as e:
        task = None
        stop()
        say("ERR:loop:%s" % e)
    sleep(2)
