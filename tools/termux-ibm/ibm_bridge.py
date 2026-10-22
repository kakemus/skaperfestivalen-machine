"""IBM till display bridge for Termux on Android (Chrome on the phone has no WebHID).

Started by start-display.sh through `termux-usb -e`, which hands over an open file
descriptor for the display (USB 04b3:4526). Talks to it with libusb (ctypes), and
serves http://127.0.0.1:8765 for the game page in Chrome:
    GET /ping                      -> "ok"
    GET /show?top=...&bottom=...   -> shows two lines (20 characters each)
    GET /clear
Protocol (worked out 2026-10-02, tools/ibmlcd.py): 23-byte output reports
[cmd, len, data...]; 0x81 top line, 0x82 bottom line, 0x02 clear. The cursor (an
underline) sits under the bottom row's first cell after every line write and can't be
switched off; 0x01 moves it but blanks the top row, so the game keeps that cell empty.
The display has a second HID interface (usage 0xA000) for firmware upgrades:
NEVER write to it. Only the interface whose report descriptor has usage 0x2600 and
not 0xA000 is used; if that can't be told apart, nothing is written at all.
"""
import ctypes
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

PREFIX = os.environ.get("PREFIX", "/data/data/com.termux/files/usr")
usb = ctypes.CDLL(PREFIX + "/lib/libusb-1.0.so")
usb.libusb_control_transfer.argtypes = [ctypes.c_void_p, ctypes.c_uint8, ctypes.c_uint8, ctypes.c_uint16,
                                        ctypes.c_uint16, ctypes.c_char_p, ctypes.c_uint16, ctypes.c_uint]
usb.libusb_interrupt_transfer.argtypes = [ctypes.c_void_p, ctypes.c_ubyte, ctypes.c_char_p, ctypes.c_int,
                                          ctypes.POINTER(ctypes.c_int), ctypes.c_uint]
usb.libusb_wrap_sys_device.argtypes = [ctypes.c_void_p, ctypes.c_long, ctypes.POINTER(ctypes.c_void_p)]
usb.libusb_claim_interface.argtypes = [ctypes.c_void_p, ctypes.c_int]
usb.libusb_set_auto_detach_kernel_driver.argtypes = [ctypes.c_void_p, ctypes.c_int]
usb.libusb_release_interface.argtypes = [ctypes.c_void_p, ctypes.c_int]
usb.libusb_strerror.restype = ctypes.c_char_p
usb.libusb_clear_halt.argtypes = [ctypes.c_void_p, ctypes.c_ubyte]
LIBUSB_ERROR_PIPE = -9
WIDTH = 20
# The display's own font has no Æ Ø Å (2026-10-20: "Å" didn't show), so they're drawn as
# custom characters 1-3 (5 x 8 pixels, bit 4 = the left pixel) and swapped in for the letters.
GLYPHS = {
    "Å": (1, [0x04, 0x0A, 0x04, 0x0E, 0x11, 0x1F, 0x11, 0x00]),
    "Ø": (2, [0x0E, 0x13, 0x13, 0x15, 0x19, 0x19, 0x0E, 0x00]),
    "Æ": (3, [0x0F, 0x14, 0x14, 0x1F, 0x14, 0x14, 0x17, 0x00]),
}

# Kvitteringsspillet's big arrow (2026-10-22): one arrow over the right 3 columns of both rows,
# 15 x 16 pixels. The page sends 17 characters of text per row and which arrow (?pil=); the
# helper adds the arrow. Its 6 cells need at most 4 different custom characters (slots 4-7;
# blank cells are spaces, equal cells share a slot), redefined only when the arrow changes.
# (Two columns at first — too small, the maker said.)
PIL_TEKST = 17
PIL_SLOTS = (4, 5, 6, 7)
PIL_FORM = {
    "up": lambda x, y: (y <= 7 and abs(x - 7) <= y * 0.95 + 0.5) or (8 <= y <= 15 and abs(x - 7) <= 1.5),
    "down": lambda x, y: (y >= 8 and abs(x - 7) <= (15 - y) * 0.95 + 0.5) or (0 <= y <= 7 and abs(x - 7) <= 1.5),
    "right": lambda x, y: (x >= 10 and abs(y - 7.5) <= (14 - x) * 1.75 + 0.5) or (x <= 9 and abs(y - 7.5) <= 1.5),
}


def pil_celler(kind):
    """The arrow as cells: (glyphs for the slots, the 3 characters of the top row, of the bottom row)."""
    on = PIL_FORM.get(kind)
    if not on:
        return [], "   ", "   "
    glyphs, rows = [], []
    for gy in (0, 8):
        row = ""
        for gx in (0, 5, 10):
            g = [sum(1 << (4 - i) for i in range(5) if on(gx + i, gy + r)) for r in range(8)]
            if not any(g):
                row += " "
                continue
            if g not in glyphs:
                glyphs.append(g)
            row += chr(PIL_SLOTS[glyphs.index(g)])
        rows.append(row)
    return glyphs, rows[0], rows[1]


def err(code):
    return usb.libusb_strerror(code).decode()


def control_in(h, rtype, req, value, index, length):
    buf = ctypes.create_string_buffer(length)
    n = usb.libusb_control_transfer(h, rtype, req, value, index, buf, length, 1000)
    if n < 0:
        raise RuntimeError("control transfer failed: " + err(n))
    return buf.raw[:n]


class Display:
    def __init__(self, fd):
        ctx = ctypes.c_void_p()
        usb.libusb_set_option(None, 2)            # LIBUSB_OPTION_NO_DEVICE_DISCOVERY: Android gives us the fd
        if usb.libusb_init(ctypes.byref(ctx)) != 0:
            raise RuntimeError("libusb_init failed")
        self.h = ctypes.c_void_p()
        r = usb.libusb_wrap_sys_device(ctx, fd, ctypes.byref(self.h))
        if r != 0:
            raise RuntimeError("libusb_wrap_sys_device: " + err(r))
        dev = control_in(self.h, 0x80, 6, 0x0100, 0, 18)
        vid, pid = dev[8] | dev[9] << 8, dev[10] | dev[11] << 8
        if (vid, pid) != (0x04B3, 0x4526):
            raise RuntimeError("not the IBM display: %04x:%04x" % (vid, pid))
        # the configuration: HID interfaces, their report descriptors and endpoints
        head = control_in(self.h, 0x80, 6, 0x0200, 0, 9)
        conf = control_in(self.h, 0x80, 6, 0x0200, 0, head[2] | head[3] << 8)
        ifaces, cur, i = {}, None, 0
        while i + 1 < len(conf) and conf[i] > 0:
            ln, typ = conf[i], conf[i + 1]
            d = conf[i:i + ln]
            if typ == 4:
                cur = d[2]
                ifaces[cur] = {"cls": d[5], "rdlen": 0, "out": None, "in": None}
            elif typ == 0x21 and cur is not None:
                ifaces[cur]["rdlen"] = d[7] | d[8] << 8
            elif typ == 5 and cur is not None and d[3] & 3 == 3:
                ifaces[cur]["in" if d[2] & 0x80 else "out"] = d[2]
            i += ln
        found = []
        # Android's own HID driver holds the interfaces: take each over (auto-detach) before
        # reading its report descriptor — a read only — and let go of the ones that aren't it
        usb.libusb_set_auto_detach_kernel_driver(self.h, 1)
        for n, f in ifaces.items():
            if f["cls"] != 3 or not f["rdlen"]:
                continue
            r = usb.libusb_claim_interface(self.h, n)
            if r != 0:
                raise RuntimeError("claim interface %d: %s" % (n, err(r)))
            try:
                rd = control_in(self.h, 0x81, 6, 0x2200, n, f["rdlen"])
            finally:
                usb.libusb_release_interface(self.h, n)
            display = b"\x0a\x00\x26" in rd
            firmware = b"\x0a\x00\xa0" in rd
            print("interface %d: report descriptor %d bytes, display=%s firmware=%s, out=%s in=%s"
                  % (n, len(rd), display, firmware, f["out"], f["in"]), flush=True)
            if display and not firmware:
                found.append(n)
        if len(found) != 1:
            raise RuntimeError("couldn't tell the display interface apart safely (%s) - not writing" % found)
        self.iface, self.ep_out, self.ep_in = found[0], ifaces[found[0]]["out"], ifaces[found[0]]["in"]
        usb.libusb_set_auto_detach_kernel_driver(self.h, 1)
        r = usb.libusb_claim_interface(self.h, self.iface)
        if r != 0:
            raise RuntimeError("claim interface %d: %s" % (self.iface, err(r)))
        self.lock = threading.Lock()
        self.shown = [None, None]
        print("display interface %d claimed" % self.iface, flush=True)

    def send(self, cmd, data=b"", length=None):
        report = (bytes([cmd, len(data) if length is None else length]) + bytes(data)).ljust(23, b"\0")
        with self.lock:
            if self.ep_out:
                n = ctypes.c_int()
                r = usb.libusb_interrupt_transfer(self.h, self.ep_out, report, 23, ctypes.byref(n), 500)
                if r == LIBUSB_ERROR_PIPE:
                    # a stalled endpoint, e.g. after the helper before was killed mid-write
                    # (2026-10-22): clear it and try once more
                    usb.libusb_clear_halt(self.h, self.ep_out)
                    r = usb.libusb_interrupt_transfer(self.h, self.ep_out, report, 23, ctypes.byref(n), 500)
            else:                                   # SET_REPORT (output) on the control pipe
                r = usb.libusb_control_transfer(self.h, 0x21, 0x09, 0x0200, self.iface, report, 23, 500)
                r = 0 if r == 23 else r
            if r < 0:
                raise RuntimeError("write failed: " + err(r))
            if self.ep_in:                          # the display answers with an 8-byte status: read it away
                buf, n = ctypes.create_string_buffer(8), ctypes.c_int()
                usb.libusb_interrupt_transfer(self.h, self.ep_in, buf, 8, ctypes.byref(n), 100)
                return buf.raw[:n.value]

    def glyphs(self):
        for slot, rows in GLYPHS.values():
            self.send(0x40, bytes(rows), length=slot)

    def line(self, row, text):
        text = text.upper()
        for letter, (slot, _) in GLYPHS.items():
            text = text.replace(letter, chr(slot))
        data = text.encode("latin-1", "replace")[:WIDTH].ljust(WIDTH, b" ")
        if self.shown[row] != data:
            self.send(0x81 if row == 0 else 0x82, data)
            self.shown[row] = data

    def pil(self, kind):
        """Defines the arrow's characters (if it changed); returns the 3 characters per row."""
        glyphs, top, bottom = pil_celler(kind)
        if getattr(self, "pil_na", None) != kind:
            for slot, rows in zip(PIL_SLOTS, glyphs):
                self.send(0x40, bytes(rows), length=slot)
            self.pil_na = kind
        return top, bottom

    def clear(self):
        self.send(0x02)
        self.shown = [None, None]


class Handler(BaseHTTPRequestHandler):
    def reply(self, code, text):
        body = text.encode()
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET")
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        try:
            if url.path == "/ping":
                return self.reply(200, "ok")
            if url.path == "/show":
                top, bottom = q.get("top", ""), q.get("bottom", "")
                if "pil" in q:                       # 17 characters of text + the arrow
                    a, b = DISPLAY.pil(q["pil"])
                    top, bottom = top[:PIL_TEKST].ljust(PIL_TEKST) + a, bottom[:PIL_TEKST].ljust(PIL_TEKST) + b
                DISPLAY.line(0, top)
                DISPLAY.line(1, bottom)
                return self.reply(200, "ok")
            if url.path == "/clear":
                DISPLAY.clear()
                return self.reply(200, "ok")
            self.reply(404, "no such thing")
        except Exception as e:
            self.reply(500, str(e))

    def log_message(self, *args):
        pass


def probe(fd):
    """Is this the IBM display? Reads only the device descriptor (no claim, no writes)."""
    ctx, h = ctypes.c_void_p(), ctypes.c_void_p()
    usb.libusb_set_option(None, 2)
    usb.libusb_init(ctypes.byref(ctx))
    if usb.libusb_wrap_sys_device(ctx, fd, ctypes.byref(h)) != 0:
        return False
    dev = control_in(h, 0x80, 6, 0x0100, 0, 18)
    return (dev[8] | dev[9] << 8, dev[10] | dev[11] << 8) == (0x04B3, 0x4526)


if __name__ == "__main__":
    if "--probe" in sys.argv:
        try:
            print("IBM" if probe(int(sys.argv[-1])) else "other")
        except Exception as e:
            print("other", e)
        sys.exit(0)
    DISPLAY = Display(int(sys.argv[-1]))
    DISPLAY.clear()
    DISPLAY.glyphs()
    DISPLAY.line(0, "KVITTERINGSSPILLET")
    DISPLAY.line(1, "KLAR - ÆØÅ")
    print("bridge on http://127.0.0.1:8765", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
