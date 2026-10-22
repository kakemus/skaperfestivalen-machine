#!/usr/bin/env python3
"""Check and fix the phone in the machine from the Mac, over the hotspot (2026-10-22).

The phone (Redmi, Chrome 87) sits inside the cabinet; this reaches it with adb over Wi-Fi
and Chrome's remote debugging, so a stuck machine at the festival doesn't mean opening it.
    python tools/rescue.py           check, and fix whatever is down
    python tools/rescue.py --check   only check and report
    python tools/rescue.py --setup   once: lets the Mac into Termux (sshd), starts the helper on its own
Each run leaves a screenshot and the game's log in rescue-report/ (not in git).

What it fixes, in this order (the display helper first: switching to Termux and back
would drop the game's full screen):
  phone not found      -> looks for it on the hotspot (adb port 5555) and connects
  phone server down    -> starts phone_server.py on this Mac (port 8131)
  IBM display helper   -> restarts it over ssh into Termux, or reopens Termux (whose
                          ~/.bashrc starts it); taps OK on Android's Allow-USB boxes
  page missing, stuck, -> restarts Chrome on the game page and taps TRYKK FOR Å STARTE
  or not drawing          (a white screen while the game runs: Chrome stops drawing
                          after many hours, 2026-10-21)
  printer / micro:bit  -> asks the page to reconnect the devices it already knows
Wireless adb is lost when the phone restarts; then it needs the USB cable once:
`adb tcpip 5555`.
"""
import base64
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

import websocket   # websocket-client (tools/requirements.txt)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPORT = os.path.join(ROOT, "rescue-report")
PORT = 8131
DEVTOOLS = 9222
HELPER = 8765
SUBNET = "172.20.10."                 # the iPhone hotspot
KEY = os.path.expanduser("~/.ssh/maskin")    # made 2026-10-22, its .pub is put on the phone by --setup
CHECK_ONLY = "--check" in sys.argv
serial = None                         # the phone's adb address


def say(text):
    print(text, flush=True)


def sh(*args, timeout=20):
    r = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    return r.stdout + r.stderr


def adb(*args, timeout=20):
    return sh("adb", "-s", serial, *args, timeout=timeout)


def http(url, timeout=3):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.read().decode("utf-8", "replace")
    except Exception:
        return None


def mac_ip():
    for iface in ("en0", "en1"):
        ip = sh("ipconfig", "getifaddr", iface).strip()
        if ip:
            return ip
    return None


# ---------- the phone ----------
def find_phone():
    global serial
    listed = re.findall(r"^(\S+)\s+device\b", sh("adb", "devices"), re.M)
    for s in listed:
        serial = s
        if "Redmi" in adb("shell", "getprop", "ro.product.model") or len(listed) == 1:
            return True
    # not connected: try every address on the hotspot with adb's port open
    import socket
    for i in range(2, 15):
        ip = SUBNET + str(i)
        try:
            socket.create_connection((ip, 5555), timeout=0.4).close()
        except OSError:
            continue
        if "connected" in sh("adb", "connect", ip + ":5555"):
            serial = ip + ":5555"
            time.sleep(1)
            if "device" in sh("adb", "-s", serial, "get-state"):
                return True
    return False


def screenshot(name):
    os.makedirs(REPORT, exist_ok=True)
    path = os.path.join(REPORT, name)
    with open(path, "wb") as f:
        f.write(subprocess.run(["adb", "-s", serial, "exec-out", "screencap", "-p"], capture_output=True).stdout)
    return path


def phone_ip():
    return serial.split(":")[0]


def ssh(command, timeout=20):
    """A shell inside Termux on the phone (sshd from remote-setup.sh, only this Mac's key)."""
    try:
        r = subprocess.run(["ssh", "-p", "8022", "-i", KEY, "-o", "BatchMode=yes", "-o", "ConnectTimeout=4",
                            "-o", "StrictHostKeyChecking=accept-new", phone_ip(), command],
                           capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout + r.stderr
    except subprocess.TimeoutExpired:
        return 1, "timed out"


# ---------- the game page, through Chrome's remote debugging ----------
def page_socket():
    adb("forward", f"tcp:{DEVTOOLS}", "localabstract:chrome_devtools_remote")
    raw = http(f"http://127.0.0.1:{DEVTOOLS}/json")
    if not raw:
        return None
    for t in json.loads(raw):
        if t.get("type") == "page" and re.search(rf":{PORT}/(phone\.html)?([?#].*)?$", t.get("url", "")):
            return t["webSocketDebuggerUrl"]
    return None


class Page:
    def __init__(self, url):
        self.ws = websocket.create_connection(url, timeout=10, suppress_origin=True)
        self.n = 0

    def call(self, method, timeout=10, **params):
        self.n += 1
        self.ws.settimeout(timeout)
        self.ws.send(json.dumps({"id": self.n, "method": method, "params": params}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get("id") == self.n:
                return m

    def eval(self, expr, timeout=10):
        r = self.call("Runtime.evaluate", timeout=timeout, expression=expr, returnByValue=True, awaitPromise=True)
        return r.get("result", {}).get("result", {}).get("value")

    def draws(self):
        """Chrome sometimes keeps running the page but stops drawing it: then a screenshot never comes."""
        try:
            return "data" in self.call("Page.captureScreenshot", timeout=8, format="jpeg", quality=10).get("result", {})
        except Exception:
            return False

    def close(self):
        try:
            self.ws.close()
        except Exception:
            pass


def open_page():
    url = page_socket()
    if not url:
        return None
    try:
        return Page(url)
    except Exception:
        return None


def status(page):
    try:
        return page.eval("window.maskin ? maskin.status() : null")
    except Exception:
        return None


def restart_chrome(ip):
    say("  restarting Chrome on the game page …")
    adb("shell", "am", "force-stop", "com.android.chrome")
    time.sleep(2)
    adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", f"http://{ip}:{PORT}/", "com.android.chrome")
    for _ in range(20):
        time.sleep(1)
        page = open_page()
        if page and status(page):
            return page
    return None


def tap_to_start(page):
    """The first tap gives full screen, screen-on and sound. Xiaomi blocks taps from adb, but a
    touch sent through Chrome's remote debugging counts as a real one (tested 2026-10-22)."""
    page.eval('document.getElementById("panel").hidden = true; document.getElementById("tapToStart").hidden = false')
    page.call("Input.dispatchTouchEvent", type="touchStart", touchPoints=[{"x": 200, "y": 400}])
    page.call("Input.dispatchTouchEvent", type="touchEnd", touchPoints=[])
    time.sleep(1.5)


def helper_up():
    adb("forward", f"tcp:{HELPER}", f"tcp:{HELPER}")
    return http(f"http://127.0.0.1:{HELPER}/ping") == "ok"


def push_helper_files():
    """Copies the helper's files from this Mac onto the phone (so a fix here reaches it)."""
    here = os.path.join(ROOT, "tools", "termux-ibm")
    for name in ("ibm_bridge.py", "start-display.sh"):
        try:
            data = open(os.path.join(here, name), "rb").read()
            subprocess.run(["ssh", "-p", "8022", "-i", KEY, "-o", "BatchMode=yes", "-o", "ConnectTimeout=4",
                            phone_ip(), f"cat > ~/{name}.new && mv ~/{name}.new ~/{name}"],
                           input=data, capture_output=True, timeout=20)
        except Exception:
            pass


def allow_usb_box():
    """Taps OK on Android's "Allow Termux:API to access the USB device?" box, if it's in front.
    Needs Xiaomi's "USB debugging (Security settings)" (on since 2026-10-22). uiautomator can't
    read the screen while the game animates, so OK is tapped where it sits on the Redmi
    (1080 x 2340: 887, 1335) — scaled for another screen."""
    if "UsbPermissionActivity" not in adb("shell", "dumpsys", "window").split("mCurrentFocus", 1)[-1][:200]:
        return False
    m = re.search(r"(\d+)x(\d+)", adb("shell", "wm", "size"))
    w, h = (int(m.group(1)), int(m.group(2))) if m else (1080, 2340)
    adb("shell", "input", "tap", str(round(w * 887 / 1080)), str(round(h * 1335 / 2340)))
    return True


def choose_device(page, button):
    """After an unplug Android takes Chrome's USB permission away, so a device needs Chrome's
    chooser again: a click with a user gesture opens it, then the first device, Connect and
    Android's OK are tapped (positions on the Redmi, scaled; tested 2026-10-22)."""
    m = re.search(r"(\d+)x(\d+)", adb("shell", "wm", "size"))
    w, h = (int(m.group(1)), int(m.group(2))) if m else (1080, 2340)
    at = lambda x, y: adb("shell", "input", "tap", str(round(w * x / 1080)), str(round(h * y / 2340)))
    page.call("Runtime.evaluate", expression=f'document.getElementById("{button}").click()', userGesture=True)
    time.sleep(2)
    at(131, 284)            # the first device in the list
    time.sleep(0.8)
    at(923, 1113)           # Connect
    for _ in range(4):
        time.sleep(1)
        if allow_usb_box():
            break
    time.sleep(3)


def start_helper():
    say("  starting the IBM display helper …")
    push_helper_files()
    code, _ = ssh("pkill -f ibm_bridge.py; sleep 0.5; (nohup bash ~/start-display.sh > ~/display.log 2>&1 &); sleep 0.3")
    if code != 0:
        # no ssh (Termux not running): reopening Termux runs ~/.machine-autostart.sh, which
        # starts sshd and the helper by itself
        say("  (no ssh into Termux — reopening Termux)")
        adb("shell", "am", "force-stop", "com.termux")
        time.sleep(1)
        adb("shell", "am", "start", "-n", "com.termux/.app.TermuxActivity")
    for _ in range(40):
        time.sleep(1)
        if allow_usb_box():
            say("  tapped OK on Android's Allow-USB box")
        if helper_up():
            return True
    code, out = ssh("tail -5 ~/display.log")
    if code == 0:
        say("  helper says: " + out.strip().replace("\n", " | "))
    return False


def back_to_chrome():
    adb("shell", "am", "start", "-n", "com.android.chrome/com.google.android.apps.chrome.Main")
    time.sleep(2)


# ---------- one-time setup of Termux (sshd + autostart) ----------
def setup():
    import http.server
    import threading
    here = os.path.join(ROOT, "tools", "termux-ibm")
    key = open(KEY + ".pub").read().strip()
    files = {"/s": open(os.path.join(here, "remote-setup.sh")).read().replace("__KEY__", key),
             "/ibm_bridge.py": open(os.path.join(here, "ibm_bridge.py")).read(),
             "/start-display.sh": open(os.path.join(here, "start-display.sh")).read()}

    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            body = files.get(self.path, "").encode()
            self.send_response(200 if body else 404)
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *a):
            pass

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 8999), H)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    adb("reverse", "tcp:8999", "tcp:8999")
    adb("shell", "am", "start", "-n", "com.termux/.app.TermuxActivity")
    say("Termux is open on the phone. Type this there and press Enter:\n\n"
        "    curl -s localhost:8999/s | bash\n\nwaiting for it to finish …")
    for _ in range(600):
        time.sleep(1)
        if ssh("echo ok")[0] == 0:
            say("✓ The Mac can reach Termux on the phone now.")
            break
    else:
        say("✗ Didn't hear from the phone within 10 minutes.")
    server.shutdown()


# ---------- the run ----------
def main():
    say("THE MACHINE — rescue from the Mac" + (" (check only)" if CHECK_ONLY else ""))
    ip = mac_ip()
    if not ip:
        return say("✗ This Mac isn't on Wi-Fi — join the phone's hotspot first.")
    say(f"• Mac at {ip}")

    if not find_phone():
        return say("✗ Can't find the phone on the hotspot. Is it on, and on the hotspot?\n"
                   "  If it was restarted: connect it to the Mac with USB once and run  adb tcpip 5555")
    say(f"✓ Phone found ({serial})")

    if http(f"http://127.0.0.1:{PORT}/phone.js") is None:
        if CHECK_ONLY:
            say("✗ The phone server on this Mac isn't running (the phone uses its own copy meanwhile)")
        else:
            subprocess.Popen([sys.executable, os.path.join(ROOT, "phone_server.py"), str(PORT)], cwd=ROOT,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
            time.sleep(1)
            say("✓ Started the phone server on this Mac")
    else:
        say("✓ Phone server running")

    # the display helper first: going to Termux and back would drop the game's full screen
    if helper_up():
        say("✓ IBM display helper running")
    elif CHECK_ONLY:
        say("✗ IBM display helper not running")
    else:
        say("✓ IBM display helper started" if start_helper() else "✗ IBM display helper still not running — is the display plugged in?")
        back_to_chrome()

    # Chrome draws only while it's in front: a page behind the home screen would look "white"
    if not CHECK_ONLY and "com.android.chrome" not in adb("shell", "dumpsys", "window").split("mCurrentFocus", 1)[-1][:200]:
        say("• Chrome wasn't in front — bringing it back")
        back_to_chrome()
    page = open_page()
    st = status(page) if page else None
    if not page or not st:
        why = "no game page open" if not page else "the game page isn't answering"
    elif not page.draws():
        why = "Chrome has stopped drawing (white screen)"
    elif st.get("otherTab"):
        why = "the game is open in two tabs"
    else:
        why = None
    if why:
        say(f"✗ {why}")
        if page:
            page.close()
        page = None if CHECK_ONLY else restart_chrome(ip)
        if not page:
            screenshot("screen.png")
            return say("✗ Couldn't get the game page going — see rescue-report/screen.png")
        st = status(page)
        say(f"✓ Game page running again ({st['version']})")
    else:
        say(f"✓ Game page running and drawing ({st['version']}, game: {st['state']})")

    if not CHECK_ONLY and (not st["started"] or not st["fullscreen"]):
        tap_to_start(page)
        st = status(page)
        say("✓ Tapped start (full screen, sound)" if st["started"] else "✗ The start tap didn't take")

    if not CHECK_ONLY and not (st["printer"] and st["microbit"]):
        page.eval("maskin.connect()")
        for _ in range(10):
            time.sleep(1)
            st = status(page)
            if st["printer"] and st["microbit"]:
                break
        # still not: the device was unplugged, Chrome lost its permission — the chooser again
        if not st["printer"]:
            say("  reconnecting the printer through Chrome's chooser …")
            choose_device(page, "connectPrinter")
        if not page.eval("maskin.status().microbit") and not page.eval(
                "navigator.usb.getDevices().then(d => d.some(x => x.vendorId === 0x0d28))"):
            say("  reconnecting the micro:bit through Chrome's chooser …")
            choose_device(page, "connectMicrobit")
            time.sleep(6)
        st = status(page)
    say(("✓" if st["printer"] else "✗") + " Printer " + ("connected" if st["printer"] else
        "not connected — is it on and plugged into the hub? (if it's new to the phone, it needs one tap on Connect)"))
    say(("✓" if st["microbit"] else "✗") + " micro:bit " + ("connected and answering" if st["microbit"] else
        "not answering — is the Wukong switched on? (Reset micro:bit in the panel, or switch it off and on)"))
    say(("✓" if st["display"] else "✗") + " IBM display " + ("connected" if st["display"] else "not reached by the page"))
    say(f"• Belt position: {st['position']}")

    os.makedirs(REPORT, exist_ok=True)
    with open(os.path.join(REPORT, "log.txt"), "w") as f:
        f.write("\n".join(st["log"]) + "\n")
    if not CHECK_ONLY:
        page.eval('maskin.log("Rescue from the Mac: checked and fixed")')
    page.close()
    say(f"• Screenshot and the game's log: {screenshot('screen.png')}, rescue-report/log.txt")


if __name__ == "__main__":
    if "--setup" in sys.argv:
        setup() if find_phone() else say("✗ Can't find the phone on the hotspot.")
    else:
        main()
