import functools
import http.server
import os
import sys

# PORT may be allocated by a preview tool; default to 8000 for manual runs.
port = int(os.environ.get("PORT", 8000))
# Bind to all interfaces by default for LAN previews. Set BIND=127.0.0.1 to
# restrict access to this machine. This server has no authentication and exposes
# every file under directory, so never point it at secrets, .env files, or .git.
bind = os.environ.get("BIND", "")
directory = sys.argv[1] if len(sys.argv) > 1 else "public"
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=directory)
http.server.ThreadingHTTPServer((bind, port), handler).serve_forever()
