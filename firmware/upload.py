"""Put the machine firmware on the micro:bit over USB — no hex dragging.

    python3 firmware/upload.py            # send machine.py in pieces, restart
    python3 firmware/upload.py --loader   # also (re)write the small main.py that runs them

Why (2026-10-15): machine.py grew past what the micro:bit can compile in one
go ("MemoryError: memory allocation failed" and a sad face at start-up — the
board parses the whole file before running it). Precompiled .mpy files would
avoid that, but this MicroPython build can't import them ("no module named").
So the (comment-stripped, strip.py) program is cut at top-level statements
into pieces of a few KB, and main.py runs them one after the other in the
same globals: the parsing memory is only ever needed for one piece. It is
still exactly one program — functions see each other and `global` works.

Bonus: this goes over the serial port, so updates no longer depend on the
MICROBIT drive (copies to it kept hanging on this Mac), and the files on the
board — settings.txt with the belt's tuning — survive an update. Dragging a
.hex onto MICROBIT wipes them; after that, run this once with --loader.

Needs pyserial and mpy-cross==1.12 (pip). Close the belt/game page first:
only one program can use the serial port.
"""
import glob
import os
import subprocess
import sys
import time

import serial

HERE = os.path.dirname(os.path.abspath(__file__))
PIECE_BYTES = 4500          # largest piece the board has to parse at once
# The loader keeps its own variables inside a function: the pieces run in the
# module's globals, and with the short names from strip.py --rename a global
# loop counter `n` got overwritten by the program's own `n` (a sad face:
# "unsupported types for __iadd__: 'dict', 'int'", 2026-10-16). Names with
# underscores are never produced by the renamer.
LOADER = (
    "def __load():\n"
    "    import gc\n"
    "    g = globals()\n"
    "    i = 0\n"
    "    while True:\n"
    "        try:\n"
    "            s = open('belt%d.py' % i).read()\n"
    "        except OSError:\n"
    "            break\n"
    "        gc.collect()\n"
    "        exec(s, g)\n"            # the last piece is the main loop and never returns
    "        s = None\n"
    "        i += 1\n"
    "__load()\n"
    "from microbit import display\n"
    "display.scroll('NO BELT - run upload.py')\n"
)


def pieces():
    """machine.py, comment-stripped, cut at top-level statements into pieces."""
    import ast
    tmp = os.path.join(HERE, ".packed.py")
    subprocess.run([sys.executable, os.path.join(HERE, "strip.py"), os.path.join(HERE, "machine.py"), tmp, "--rename"], check=True)
    src = open(tmp).read()
    os.remove(tmp)
    os.replace(tmp + ".names", os.path.join(HERE, "names.txt"))   # short name = original, to decode board errors
    lines = src.split("\n")
    body = ast.parse(src).body
    out, start, size = [], 0, 0
    for i, stmt in enumerate(body):
        first, last = stmt.lineno - 1, stmt.end_lineno
        part = len("\n".join(lines[first:last]))
        # the final statement (the main loop) always gets a piece of its own,
        # so the source text it keeps alive while running is small
        if size and (size + part > PIECE_BYTES or i == len(body) - 1):
            out.append("\n".join(lines[start:first]) + "\n")
            start, size = first, 0
        size += part
    out.append("\n".join(lines[start:]) + "\n")
    return out


class Board:
    def __init__(self):
        ports = glob.glob("/dev/cu.usbmodem*") + glob.glob("/dev/ttyACM*")
        if not ports:
            sys.exit("No micro:bit found on USB.")
        self.p = serial.Serial(ports[0], 115200, timeout=0.2)

    def read_until(self, marker, secs=5):
        buf, end = b"", time.time() + secs
        while time.time() < end:
            buf += self.p.read(256)
            if marker in buf:
                return buf
        raise RuntimeError("no %r from the board, got %r" % (marker, buf[-200:]))

    def raw_mode(self):
        # Stop whatever runs, enter the raw REPL. No soft reset: that would run
        # main.py again — which is exactly what crashes when the firmware is broken.
        # The running firmware doesn't always catch the first Ctrl-C, so try a few times.
        for attempt in range(5):
            self.p.write(b"\r\x03\x03")
            time.sleep(0.3)
            self.p.write(b"\x03")
            time.sleep(0.2)
            self.p.reset_input_buffer()
            self.p.write(b"\x01")
            try:
                self.read_until(b"raw REPL; CTRL-B to exit\r\n>", 2)
                return
            except RuntimeError:
                time.sleep(0.5)
        raise RuntimeError("the micro:bit didn't stop to receive files — unplug it, plug it back in and try again")

    def run(self, code):
        """Run code in the raw REPL. The board answers OK, the output, \\x04,
        any error, \\x04, then > — read as one piece."""
        self.p.write(code.encode() + b"\x04")
        out = self.read_until(b"\x04>", 10)
        out = out[out.index(b"OK") + 2:-1]                  # output \x04 error \x04
        result, err = out.split(b"\x04")[:2]
        if err.strip():
            raise RuntimeError(err.decode(errors="ignore"))
        return result.decode(errors="ignore")

    def put(self, name, data):
        self.run("f=open(%r,'wb')" % name)
        for i in range(0, len(data), 128):
            self.run("f.write(%r)" % data[i:i + 128])
        self.run("f.close()")

    def restart(self):
        self.p.write(b"\x02")                       # leave raw mode
        time.sleep(0.2)
        self.p.write(b"\x04")                       # soft reset: runs main.py → the firmware


def main():
    parts = pieces()
    board = Board()
    board.raw_mode()
    # Clear EVERYTHING first, keeping a copy of settings.txt to put back at the end:
    # deleting only the old pieces left the board's tiny file store (~16 KB)
    # fragmented, and the next update ran out of space ("OSError: 28", 2026-10-16).
    files = eval(board.run("import os;print(os.listdir())"))
    settings = None
    if "settings.txt" in files:
        settings = board.run("print(open('settings.txt').read())").strip("\r\n")
    for name in files:
        board.run("import os;os.remove(%r)" % name)
    board.put("main.py", LOADER.encode())
    print("main.py (loader) written")
    for n, text in enumerate(parts):
        board.put("belt%d.py" % n, text.encode())
        print("belt%d.py written: %d bytes" % (n, len(text)))
    if settings:
        board.put("settings.txt", settings.replace("\r\n", "\n").encode())
        print("settings.txt put back")
    print("files on the board:", board.run("import os;print(os.listdir())").strip())
    board.restart()
    print("restarted — the firmware is starting")


if __name__ == "__main__":
    main()
