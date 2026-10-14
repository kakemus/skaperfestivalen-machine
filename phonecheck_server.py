#!/usr/bin/env python3
"""Serve phonecheck.html — and nothing else — to a phone on the same Wi-Fi.

devserver.py stays 127.0.0.1-only and serves the whole project; this one
listens on the network so a phone can reach it, so it hands out exactly one
file. Started by start-phonecheck.command.
"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8131
PAGE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "phonecheck.html")
# The page posts its report here on every change, so nothing has to be copied
# off the phone by hand (getting text off the old phone was its own problem).
RESULTS = "/tmp/phonecheck-results.txt"


class OnePage(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?")[0] not in ("/", "/phonecheck.html"):
            self.send_error(404)
            return
        body = open(PAGE, "rb").read()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
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
