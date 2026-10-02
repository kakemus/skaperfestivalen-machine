# Receiver micro:bit — stays plugged into the computer by USB.
# Flash at https://python.microbit.org. Forwards every radio line to USB unchanged.
from microbit import *
import radio

GROUP = 42  # must match controller.py

radio.config(group=GROUP, length=64)
radio.on()
uart.init(115200)
display.show(Image.DIAMOND_SMALL)

while True:
    msg = radio.receive()
    if msg:
        print(msg)
        display.set_pixel(2, 2, 9 if display.get_pixel(2, 2) < 9 else 3)  # blink on traffic
