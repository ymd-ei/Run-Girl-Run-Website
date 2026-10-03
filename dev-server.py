#!/usr/bin/env python3
"""Dev-only static server with caching disabled.

The default `python -m http.server` lets browsers heuristically cache ES modules,
which makes live-editing the editor modules unreliable. This sends no-store on
everything so each reload fetches fresh source. Not used in production (the site
is hosted on GitHub Pages).
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
ROOT = os.path.dirname(os.path.abspath(__file__))  # serve the website folder


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass  # quiet


class Server(ThreadingHTTPServer):
    # The default backlog of 5 drops connections when a page requests its ~15
    # modules plus media at once (ERR_CONNECTION_RESET in the browser).
    request_queue_size = 128
    daemon_threads = True


if __name__ == "__main__":
    handler = partial(NoCacheHandler, directory=ROOT)
    Server(("", PORT), handler).serve_forever()
