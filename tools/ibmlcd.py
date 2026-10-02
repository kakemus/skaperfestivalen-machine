"""Driver for the IBM Retail USB 40-character LCD (USB 04b3:4526) — a 2 x 20 shop-till
customer display. The protocol isn't published; it was worked out by trial on 2026-10-02.

The display shows up as two HID interfaces:
  usage 0xA000  firmware upgrade  — NEVER write to this one, it can brick the display
  usage 0x2600  the display       — everything below

Every write is a 23-byte output report: [command, length, up to 21 data bytes].
  0x81 len text      replace the top line (20 chars; shorter text leaves char-0 cells)
  0x82 len text      replace the bottom line
  0x02               clear the screen
  0x40 slot rows*8   define custom character `slot` (0-7) from 8 rows of 5 pixels
                     (bit 4 = left pixel); print it by putting chr(slot) in the text.
                     Redefining a slot changes every copy already on screen at once.
  0x20               brought back the power-on "OK" screen once (may have been the
                     loose cable) — avoid
  0x10               unknown (cursor tests inconclusive so far)
The display answers each write with an 8-byte status: 01 ... = accepted, 80 ... = rejected.
About 30 line writes per second get through.
"""
import hid

VENDOR, PRODUCT, DISPLAY_USAGE = 0x04B3, 0x4526, 0x2600
WIDTH = 20


class IBMLCD:
    def __init__(self):
        paths = [d["path"] for d in hid.enumerate(VENDOR, PRODUCT) if d["usage"] == DISPLAY_USAGE]
        if not paths:
            raise RuntimeError("IBM display not found — is the USB cable seated?")
        self.h = hid.device()
        self.h.open_path(paths[0])
        self.shown = [None, None]  # skip rewriting a line that hasn't changed

    def _send(self, cmd, data=b"", length=None):
        report = bytes([cmd, len(data) if length is None else length]) + bytes(data)
        self.h.write(b"\0" + report.ljust(23, b"\0"))
        return bytes(self.h.read(8, 500))

    def clear(self):
        self._send(0x02)
        self.shown = [None, None]

    def line(self, row, text, force=False):
        """Set a whole line. Accepts str (latin-1; chr(0)-chr(7) = custom chars) or bytes."""
        data = text if isinstance(text, (bytes, bytearray)) else text.encode("latin-1", "replace")
        data = bytes(data[:WIDTH]).ljust(WIDTH, b" ")
        if force or self.shown[row] != data:
            self._send(0x81 if row == 0 else 0x82, data)
            self.shown[row] = data

    def show(self, top="", bottom=""):
        self.line(0, top)
        self.line(1, bottom)

    def define_char(self, slot, rows):
        """rows: 8 ints, 5 bits each (0b10000 = leftmost pixel), or 8 strings like '.#.#.'."""
        rows = [int(r.replace(".", "0").replace("#", "1"), 2) if isinstance(r, str) else r for r in rows]
        self._send(0x40, bytes(rows[:8]).ljust(8, b"\0"), length=slot)


if __name__ == "__main__":
    import sys
    args = (sys.argv[1:] + ["", ""])[:2]
    IBMLCD().show(*args)
