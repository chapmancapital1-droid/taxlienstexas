#!/usr/bin/env python3
"""Texas Land & Tax Sale Finder — serves the app + data + live link checker.
Stdlib only. Bind 0.0.0.0:PORT (default 8000)."""
import json, os, socket, sys, urllib.request, urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

BASE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get('PORT', '8000'))

with open(os.path.join(BASE, 'data', 'counties.json')) as f:
    COUNTIES = json.load(f)
BY_ID = {c['id']: c for c in COUNTIES}
with open(os.path.join(BASE, 'data', 'cities.json')) as f:
    CITIES = json.load(f)

MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
        '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'}


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'TXSaleFinder/1.1'

    def log_message(self, fmt, *args):
        sys.stderr.write('%s %s\n' % (self.address_string(), fmt % args))

    def _send(self, code, body, ctype='application/json'):
        if isinstance(body, str):
            body = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _file(self, name):
        path = os.path.normpath(os.path.join(BASE, name))
        if not path.startswith(BASE) or not os.path.isfile(path):
            return self._send(404, '{"error":"not found"}')
        ext = os.path.splitext(path)[1]
        with open(path, 'rb') as f:
            self._send(200, f.read(), MIME.get(ext, 'application/octet-stream'))

    def do_GET(self):
        u = urlparse(self.path)
        route = u.path
        try:
            if route in ('/', '/index.html'):
                return self._file('index.html')
            if route in ('/app.js', '/style.css', '/dashboard.js', '/dashboard.css', '/manifest.json'):
                return self._file(route.lstrip('/'))
            if route == '/api/counties':
                return self._send(200, json.dumps(COUNTIES))
            if route == '/api/cities':
                return self._send(200, json.dumps(CITIES))
            if route == '/api/check':
                qs = parse_qs(u.query)
                cid = (qs.get('id') or [''])[0]
                county = BY_ID.get(cid)
                if not county:
                    return self._send(400, '{"error":"unknown county id"}')
                url = county.get('website') or ''
                if not url.lower().startswith('http'):
                    return self._send(200, json.dumps({'ok': False, 'error': 'no website on file'}))
                result = self._probe(url)
                return self._send(200, json.dumps(result))
            if route == '/api/health':
                return self._send(200, json.dumps({'ok': True, 'counties': len(COUNTIES), 'cities': len(CITIES), 'version': '1.1'}))
            return self._send(404, '{"error":"not found"}')
        except Exception as e:  # noqa
            return self._send(500, json.dumps({'error': str(e)}))

    @staticmethod
    def _probe(url):
        req = urllib.request.Request(url, method='GET', headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        })
        import time
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return {'ok': r.status < 400, 'code': r.status, 'ms': int((time.time() - t0) * 1000),
                        'final': r.url, 'checked': time.strftime('%Y-%m-%d %H:%M')}
        except urllib.error.HTTPError as e:
            return {'ok': e.code in (401, 403), 'code': e.code, 'ms': int((time.time() - t0) * 1000),
                    'error': 'HTTP %d (bot-blocked pages can still open in a browser)' % e.code,
                    'final': e.url or url, 'checked': time.strftime('%Y-%m-%d %H:%M')}
        except (urllib.error.URLError, socket.timeout, ValueError, OSError) as e:
            return {'ok': False, 'error': str(e)[:120], 'ms': int((time.time() - t0) * 1000),
                    'url': url, 'checked': time.strftime('%Y-%m-%d %H:%M')}


if __name__ == '__main__':
    srv = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    print(f'Serving Texas Land & Tax Sale Finder on 0.0.0.0:{PORT} ({len(COUNTIES)} counties)', flush=True)
    srv.serve_forever()
