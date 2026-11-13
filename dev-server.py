#!/usr/bin/env python3
"""Dev-only static server with caching disabled.

The default `python -m http.server` lets browsers heuristically cache ES modules,
which makes live-editing the editor modules unreliable. This sends no-store on
everything so each reload fetches fresh source. Not used in production (the site
is hosted on GitHub Pages).

It also answers Range requests (206 Partial Content), like GitHub Pages does, so
videos can be seeked locally; the stock server always sends the whole file.
"""
import os
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
ROOT = os.path.dirname(os.path.abspath(__file__))  # serve the website folder


class NoCacheHandler(SimpleHTTPRequestHandler):
    _range_left = None  # bytes still to send for a Range response

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self):
        rng = self.headers.get("Range")
        path = self.translate_path(self.path)
        m = re.fullmatch(r"bytes=(\d*)-(\d*)", rng.strip()) if rng else None
        if not m or not os.path.isfile(path) or m.groups() == ("", ""):
            return super().send_head()
        size = os.path.getsize(path)
        first, last = m.groups()
        if first == "":  # "bytes=-N": the last N bytes
            start, end = max(0, size - int(last)), size - 1
        else:
            start, end = int(first), min(int(last), size - 1) if last else size - 1
        if start >= size or start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._range_left = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        try:
            if self._range_left is None:
                return super().copyfile(source, outputfile)
            left, self._range_left = self._range_left, None
            while left > 0:
                chunk = source.read(min(64 * 1024, left))
                if not chunk:
                    break
                outputfile.write(chunk)
                left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass  # the browser dropped the request (normal while seeking video)

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
