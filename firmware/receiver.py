# Receiver micro:bit — stays plugged into the computer by USB.
# Flash at https://python.microbit.org. Passes lines both ways, unchanged:
# radio → USB (buttons, belt reports…) and USB → radio (belt / bell commands).
# Only needed for boards that aren't plugged into the computer themselves.
from microbit import *
import radio

GROUP = 42  # must match the other boards

radio.config(group=GROUP, length=64)
radio.on()
uart.init(115200)
display.show(Image.DIAMOND_SMALL)
line_in = ""

while True:
    msg = radio.receive()
    if msg:
        print(msg)
        display.set_pixel(2, 2, 9 if display.get_pixel(2, 2) < 9 else 3)  # blink on traffic
    if uart.any():
        line_in += (uart.read() or b"").decode("utf-8", "ignore")
        while "\n" in line_in:
            cmd, line_in = line_in.split("\n", 1)
            if cmd.strip():
                radio.send(cmd.strip())
    sleep(5)
