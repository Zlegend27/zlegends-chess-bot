#!/usr/bin/env python
"""Minimal static file server for the Kindle chess bot.

Serves the built dist-kindle files from the same directory this script
lives in. Written to work on either Python 2 (common on jailbroken
Kindle firmware) or Python 3.
"""
import os

PORT = 8000

os.chdir(os.path.dirname(os.path.abspath(__file__)))

try:
    from http.server import HTTPServer, SimpleHTTPRequestHandler  # Python 3
except ImportError:
    from BaseHTTPServer import HTTPServer  # Python 2
    from SimpleHTTPServer import SimpleHTTPRequestHandler

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), SimpleHTTPRequestHandler)
    print("Kindle Chess Server running on http://localhost:%d" % PORT)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()
