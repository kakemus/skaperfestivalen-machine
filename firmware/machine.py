# The machine micro:bit (V2), sitting on an ElecFreaks Wukong motor board.
# Flash at https://python.microbit.org. Plug it into the computer by USB.
#
# It runs the belt (two TT motors), watches the strip's registration marks
# with a light-dependent resistor, rings the bell through a relay, and reads
# the YES / NO buttons and the coin switch. It talks to the page over USB
# (and also over radio, so it can sit away from the computer with a receiver
# board plugged in instead).
#
# Lines it understands:   BELT:STEP        one screen up
#                         BELT:BACK:n      n screens down (rewind)
#                         BELL:DING:n      ring n times
#                         MOTOR:m:speed:ms run motor m (1/2) at speed (-100..100) for ms — testing
#                         LIGHT?           report the light sensor reading — for tuning the LDR
#                         PING             answers PONG — "is the board there?"
# Lines it sends:         BELT:DONE / BELT:ERROR:why,  ANSWER:YES / ANSWER:NO,  COIN:1,
#                         LIGHT:n, PONG
#
# WIRING (first guesses — check against the real build, and tune the numbers below):
#   Wukong M1 = top spool (pulls the strip up),  M2 = bottom spool (feeds it).
#   Motors run on the Wukong's own battery, never on the micro:bit.
#   LDR:    3V ── LDR ── P1 ── 10 kΩ ── GND   (LDR behind the paper, facing the backlight,
#           level with where the marks pass). Bright paper = high reading, mark = low.
#   Bell:   P2 → relay module IN (relay switches the bell's own low-voltage supply).
#   YES button: P8 to GND.   NO button: P12 to GND.   Coin switch: P13 to GND.
#   micro:bit's own A / B also work as YES / NO.
#
# NOT TESTED ON HARDWARE YET. The Wukong motor command (I2C address 0x10,
# [motor, direction, speed, 0]) is the same as ElecFreaks' own MakeCode
# extension (pxt-wukong, setMotorSpeed) — checked 2026-10-05.
#
# Until the LDR is wired, USE_LDR = False: a step is just STEP_RUN_MS of motor
# time, so the motors can be tried out. Switch it to True once the light
# sensor sees the marks (use LIGHT? to check the readings).
from microbit import *
import radio

GROUP = 42
WUKONG = 0x10

USE_LDR = False        # False = timed steps (no light sensor yet), True = stop on marks
STEP_RUN_MS = 1500     # timed mode: how long one screen-step runs the motors

PULL_SPEED = 60        # 0-100, top spool while stepping up
FEED_SPEED = 45        # 0-100, bottom spool letting paper out (a bit slower keeps it tight)
REWIND_SPEED = 80
STEP_TIMEOUT_MS = 8000 # per screen — give up if no mark turns up
MARK_FRACTION = 0.6    # a mark = light reading below 60 % of the bright paper level
BELL_MS = 250          # how long the relay holds the bell on per ding

radio.config(group=GROUP, length=64)
radio.on()
uart.init(115200)

for pin in (pin8, pin12, pin13):
    pin.set_pull(pin.PULL_UP)


def say(line):
    print(line)
    radio.send(line)


def motor(m, speed):
    """m = 1 or 2, speed -100..100 (negative = backwards)."""
    direction = 1 if speed >= 0 else 2
    i2c.write(WUKONG, bytes([m, direction, min(100, abs(speed)), 0]))


def stop():
    motor(1, 0)
    motor(2, 0)


def light():
    return pin1.read_analog()


bright = max(light(), 1)


def on_mark():
    return light() < bright * MARK_FRACTION


def run_until_mark(top, bottom):
    """Run the motors, first off the current mark, then until the next one."""
    global bright
    motor(1, top)
    motor(2, bottom)
    start = running_time()
    while on_mark():                       # leave the mark we're sitting on
        if running_time() - start > STEP_TIMEOUT_MS:
            stop(); return False
    while not on_mark():                   # travel to the next one
        bright = max(bright * 0.98, light())  # follow slow changes in the backlight
        if running_time() - start > STEP_TIMEOUT_MS:
            stop(); return False
    stop()
    return True


def run_for(top, bottom, ms):
    motor(1, top)
    motor(2, bottom)
    sleep(ms)
    stop()
    return True


def step(top, bottom, ms):
    return run_until_mark(top, bottom) if USE_LDR else run_for(top, bottom, ms)


def handle(line):
    if line == "BELT:STEP":
        display.show(Image.ARROW_N)
        say("BELT:DONE" if step(PULL_SPEED, FEED_SPEED, STEP_RUN_MS) else "BELT:ERROR:no mark")
    elif line.startswith("BELT:BACK:"):
        display.show(Image.ARROW_S)
        n = int(line.split(":")[2])
        back_ms = STEP_RUN_MS * PULL_SPEED // REWIND_SPEED
        ok = all(step(-FEED_SPEED * REWIND_SPEED // PULL_SPEED, -REWIND_SPEED, back_ms) for _ in range(n))
        say("BELT:DONE" if ok else "BELT:ERROR:no mark")
    elif line.startswith("MOTOR:"):
        _, m, speed, ms = line.split(":")
        display.show(m)
        motor(int(m), int(speed))
        sleep(min(int(ms), 5000))   # never more than 5 s, so a typo can't tear the paper
        stop()
        say("MOTOR:DONE")
    elif line == "LIGHT?":
        say("LIGHT:%d" % light())
    elif line == "PING":
        say("PONG")
    elif line.startswith("BELL:DING"):
        times = int(line.split(":")[2]) if line.count(":") == 2 else 1
        for _ in range(times):
            pin2.write_digital(1); sleep(BELL_MS)
            pin2.write_digital(0); sleep(300)
    display.clear()


last = {"yes": 1, "no": 1, "coin": 1}
line_in = ""
display.show(Image.HAPPY)
stop()

while True:
    # commands from the page (USB) ...
    if uart.any():
        line_in += (uart.read() or b"").decode("utf-8", "ignore")
        while "\n" in line_in:
            cmd, line_in = line_in.split("\n", 1)
            if cmd.strip():
                handle(cmd.strip())
    # ... or by radio
    msg = radio.receive()
    if msg:
        handle(msg)

    # buttons: send on press (pin goes low)
    for key, pin, out in (("yes", pin8, "ANSWER:YES"), ("no", pin12, "ANSWER:NO"), ("coin", pin13, "COIN:1")):
        v = pin.read_digital()
        if v == 0 and last[key] == 1:
            say(out)
        last[key] = v
    if button_a.was_pressed():
        say("ANSWER:YES")
    if button_b.was_pressed():
        say("ANSWER:NO")
    sleep(10)
