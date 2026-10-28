#!/usr/bin/env python3
"""Server statis untuk "Kurir Sandi" (anti-cache saat ngoding).

Pakai:
    python3 serve.py            # http://127.0.0.1:8123
    python3 serve.py 9000       # ganti port

Skrip ini otomatis pindah ke folder proyeknya sendiri, jadi bisa dijalankan
dari mana saja. Tanpa cache supaya perubahan js/css langsung terlihat.
"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):        # log ringkas
        sys.stderr.write("  " + (fmt % args) + "\n")


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"Kurir Sandi  ->  http://127.0.0.1:{PORT}")
    print(f"mode sentuh di desktop: http://127.0.0.1:{PORT}/?touch=1   (Ctrl+C untuk stop)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nberhenti.")
