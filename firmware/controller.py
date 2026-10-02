# Handheld micro:bit (V2) — flash at https://python.microbit.org
# Sends "KEY:VALUE" lines by radio (and over USB too, so it also works plugged in
# directly). Same line format as the occult printer's controller.
from microbit import *
import radio

GROUP = 42  # must match receiver.py; use another number to keep two machines apart

radio.config(group=GROUP, length=64, power=7)
radio.on()


def send(line):
    radio.send(line)
    print(line)


last = {"a": None, "b": None, "logo": None}
next_tilt = 0
display.show(Image.HAPPY)

while True:
    now = running_time()
    for key, down in (("a", button_a.is_pressed()), ("b", button_b.is_pressed()),
                      ("logo", pin_logo.is_touched())):
        if down != last[key]:
            last[key] = down
            name = {"a": "BTN_A", "b": "BTN_B", "logo": "LOGO"}[key]
            send(name + ":" + ("1" if down else "0"))
    if accelerometer.was_gesture("shake"):
        send("GESTURE:shake")
        display.show(Image.SURPRISED)
    if now >= next_tilt:  # ~12 times a second is plenty for a 15 fps display
        next_tilt = now + 80
        send("TILT:%d,%d,%d" % accelerometer.get_values())
        send("MIC:%d" % microphone.sound_level())
        display.show(Image.HAPPY)
    sleep(10)
