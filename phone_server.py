#!/usr/bin/env python3
"""Serve the phone version of the machine to a phone on the same Wi-Fi.

devserver.py stays 127.0.0.1-only and serves the whole project; this one
listens on the network so a phone can reach it, so it hands out only the
files the phone version needs (the same list as sw.js's FILES) and the phone
check page. Started by start-phone.command.
"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8131
ROOT = os.path.dirname(os.path.abspath(__file__))
FILES = {
    "phone.html", "phone.js", "sw.js", "manifest.json", "icon.svg", "phonecheck.html",
    "core/clock.js", "core/clockWorker.js", "core/controller.js", "core/eventBus.js", "core/printer.js",
    "core/raster.js", "core/singleTab.js", "core/usbSerial.js",
    "game/game.js", "game/questions.js", "game/sound.js",
    "belt/belt.js", "belt/strip.js",
    "tickets/index.js", "tickets/draw.js", "tickets/code128.js", "tickets/fortune.js", "tickets/plain.js",
    "tickets/prize.js", "tickets/reward.js", "tickets/scannerSetup.js",
}
TYPES = {".js": "text/javascript", ".html": "text/html; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml"}
# The page posts its report here on every change, so nothing has to be copied
# off the phone by hand (getting text off the old phone was its own problem).
RESULTS = "/tmp/phonecheck-results.txt"


class OnePage(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0].lstrip("/") or "phone.html"
        if path not in FILES:
            self.send_error(404)
            return
        body = open(os.path.join(ROOT, path), "rb").read()
        self.send_response(200)
        self.send_header("Content-Type", TYPES.get(os.path.splitext(path)[1], "application/octet-stream"))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


    def do_POST(self):
        if self.path != "/results":
            self.send_error(404)
            return
        n = min(int(self.headers.get("Content-Length") or 0), 100_000)
        with open(RESULTS, "wb") as f:
            f.write(self.rfile.read(n))
        self.send_response(204)
        self.end_headers()

    def log_message(self, *args):
        pass


class Server(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


with Server(("0.0.0.0", PORT), OnePage) as httpd:
    httpd.serve_forever()
