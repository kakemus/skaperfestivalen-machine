#!/usr/bin/env python3
"""
Same as `python3 -m http.server`, except every response is marked
non-cacheable. Plain http.server sends no cache headers at all, which lets
Chrome silently serve a stale mismatched copy of index.html/main.js/*.js
after an edit — even across a normal reload — which looks exactly like
"nothing works" with no error anywhere. This makes that class of bug
impossible instead of asking you to remember to hard-reload every time.

Threaded: a plain socketserver.TCPServer handles ONE connection at a time,
so a single slow/kept-alive client (a stalled fetch, a long-poll, a browser
tab left open) blocks every other request behind it forever -- looks exactly
like "localhost is hung." ThreadingMixIn gives each connection its own
thread so one stuck client can't starve the rest.
"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8130
os.chdir(os.path.dirname(os.path.abspath(__file__)))  # always serve this project, wherever it's started from


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


class ReusableTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


with ReusableTCPServer(("127.0.0.1", PORT), NoCacheHandler) as httpd:
    httpd.serve_forever()
