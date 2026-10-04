"""Локальний сервер для трекера. Віддає файли без кешування,
щоб браузер завжди показував свіжу версію після правок."""
import functools
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 4321
ROOT = os.path.dirname(os.path.abspath(__file__))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # тихий лог: сервер не засмічує термінал


if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    print(f"Трекер відкритий: http://localhost:{PORT}")
    print("Зупинити — Ctrl+C")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nСервер зупинено")
