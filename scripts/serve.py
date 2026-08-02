#!/usr/bin/env python3
"""Local dev server that refuses to let the browser cache anything.

python -m http.server sends no cache headers at all, so browsers fall back to
their own guess and happily keep yesterday's javascript. That has cost us real
debugging time, so here the answer is simply: never store this.

    python3 scripts/serve.py [port]
"""
import http.server
import socketserver
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):        # keep the terminal readable
        if "GET" in (fmt % args) and " 200 " not in (fmt % args):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3006
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), NoCache) as httpd:
        print(f"Oefensommen op http://localhost:{port}  (zonder cache)")
        httpd.serve_forever()
