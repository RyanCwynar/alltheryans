#!/usr/bin/env python3
"""Local static server with SPA rewrites matching vercel.json."""

from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if path.startswith("/ryan/") and path.count("/") == 2:
            self.path = "/index.html"
        elif path.startswith("/tag/") and path.count("/") == 2:
            self.path = "/tag/index.html"
        return super().send_head()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=4173)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    handler = partial(Handler, directory=str(args.root))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"Serving {args.root} at http://127.0.0.1:{args.port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
