#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""知食 ZhiShi · 一体化服务器(纯Python标准库,零依赖)
- 静态服务: 同目录下的前端文件
- /api/chat  : AI 对话代理 → 蚂蚁MaaS ling-3.2-flash(支持SSE流式透传,服务端自动重试429)
- /api/vision: 视觉识别代理 → 蚂蚁MaaS ling-3.0-flash-vl
- /api/reviews: 共享评价存储(JSON文件,多端互通,路演/线上均生效)
- 密钥: 环境变量 ANT_KEY 或同目录 ant_key.txt (不入公开仓库)
用法: python server.py  (端口取环境变量PORT,默认8000)
"""
import http.server
import json
import os
import socket
import sys
import time
import gzip
import urllib.request
import urllib.error

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get('PORT', '3000'))
DATA_DIR = os.environ.get('DATA_DIR') or os.path.join(ROOT, '_data')
REVIEWS_FILE = os.path.join(DATA_DIR, 'zhishi_reviews.json')
NICKS_FILE = os.path.join(DATA_DIR, 'zhishi_nicks.json')

ANT_BASE = 'https://maas-api.antdigital.com/v1'
MODEL_CHAT = os.environ.get('ZHISHI_CHAT_MODEL', 'deepseek-v4.1-flash-1017')
MODEL_VISION = os.environ.get('ZHISHI_VISION_MODEL', 'ling-3.0-flash-vl')

def ant_key():
    k = os.environ.get('ANT_KEY', '')
    if k: return k.strip()
    for f in (os.path.join(ROOT, 'ant_key.txt'), os.path.join(ROOT, '..', 'ant_key.txt')):
        try:
            with open(f, encoding='utf-8') as fh:
                k = fh.read().strip()
                if k: return k
        except OSError:
            pass
    return ''

MIME = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
}

def _ensure_data(name):
    """部署会重建实例清空 $DATA_DIR; 包内 _data 里的数据自动迁移恢复(跨部署持久)"""
    dst = os.path.join(DATA_DIR, name)
    if os.path.exists(dst):
        return
    src = os.path.join(ROOT, '_data', name)
    if os.path.isfile(src):
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            import shutil as _sh
            _sh.copy2(src, dst)
        except Exception:
            pass

def load_reviews():
    _ensure_data('zhishi_reviews.json')
    try:
        with open(REVIEWS_FILE, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return []

def save_reviews(rv):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(REVIEWS_FILE, 'w', encoding='utf-8') as f:
        json.dump(rv, f, ensure_ascii=False)

def load_nicks():
    _ensure_data('zhishi_nicks.json')
    try:
        with open(NICKS_FILE, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def save_nicks(mp):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(NICKS_FILE, 'w', encoding='utf-8') as f:
        json.dump(mp, f, ensure_ascii=False)

def ant_post(path, body, timeout=180, retries=6):
    key = ant_key()
    if not key:
        raise RuntimeError('服务器未配置 ANT_KEY')
    data = json.dumps(body).encode()
    last = None
    for a in range(retries):
        req = urllib.request.Request(ANT_BASE + path, data=data,
            headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key}, method='POST')
        try:
            return urllib.request.urlopen(req, timeout=timeout)
        except urllib.error.HTTPError as e:
            if e.code in (429, 502, 503) and a < retries - 1:
                time.sleep(min(75, (8, 16, 28, 42, 55, 70)[min(a, 5)]))
                last = e
                continue
            raise
    raise last or RuntimeError('upstream failed')

class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'ZhiShi/1.0'

    def log_message(self, fmt, *args):
        sys.stdout.write('[%s] %s\n' % (time.strftime('%H:%M:%S'), fmt % args))

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header('Content-Length', '0')
        self.end_headers()

    # ── 静态文件 ──
    def _static(self, url_path):
        public = {
            'index.html', 'manifest.json', 'css/style.css',
            'js/appcfg.js', 'js/data.js', 'js/store.js', 'js/api.js',
            'js/charts.js', 'js/main.js', 'js/dine.js', 'js/rank.js', 'js/report.js',
        }
        rel = 'index.html' if url_path == '/' else url_path[1:]
        if rel not in public:
            self.send_error(404)
            return
        root = os.path.realpath(ROOT)
        fp = os.path.normpath(os.path.join(root, rel))
        if os.path.realpath(fp) != fp or not os.path.isfile(fp):
            self.send_error(404)
            return
        ext = os.path.splitext(fp)[1].lower()
        ctype = MIME.get(ext, 'application/octet-stream')
        with open(fp, 'rb') as f:
            raw = f.read()
        headers = [('Content-Type', ctype), ('Cache-Control', 'no-cache')]
        body = raw
        if len(raw) > 4096 and 'gzip' in (self.headers.get('Accept-Encoding') or '') and ext in ('.html', '.css', '.js', '.json'):
            body = gzip.compress(raw)
            headers.append(('Content-Encoding', 'gzip'))
        self.send_response(200)
        self._cors()
        for k, v in headers:
            self.send_header(k, v)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self._cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self, limit=9 * 1024 * 1024):
        n = int(self.headers.get('Content-Length') or 0)
        if n > limit:
            raise ValueError('body too large')
        return json.loads(self.rfile.read(n).decode('utf-8'))

    # ── GET ──
    def do_GET(self):
        try:
            p = self.path.split('?')[0]
            if p == '/api/ping':
                self._json({'ok': True, 'app': 'zhishi', 'reviews': len(load_reviews()), 't': int(time.time())})
            elif p == '/api/nicks':
                self._json({'ok': True, 'nicks': load_nicks()})
            elif p == '/api/reviews':
                rv = load_reviews()
                self._json({'ok': True, 'reviews': rv[-500:][::-1], 'count': len(rv)})
            else:
                self._static(p)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            try: self._json({'error': str(e)[:200]}, 500)
            except Exception: pass

    # ── POST ──
    def do_POST(self):
        try:
            p = self.path.split('?')[0]
            if p == '/api/reviews/clear':
                # 管理接口: 清空共享评价(需令牌,防误触/滥用)
                b = self._body(4 * 1024)
                if str(b.get('token', '')) != ant_key()[:8]:
                    self._json({'ok': False, 'error': 'bad token'}, 403); return
                save_reviews([])
                self._json({'ok': True})
            elif p == '/api/nicks/clear':
                b = self._body(4 * 1024)
                if str(b.get('token', '')) != ant_key()[:8]:
                    self._json({'ok': False, 'error': 'bad token'}, 403); return
                save_nicks({})
                self._json({'ok': True})
            elif p == '/api/nick':
                # 昵称注册: uid绑定昵称,昵称全站唯一(被其他uid占用则拒绝)
                b = self._body(4 * 1024)
                uid = str(b.get('uid', ''))[:24].strip()
                nick = str(b.get('nick', ''))[:16].strip()
                if not uid or not nick:
                    self._json({'ok': False, 'error': 'missing uid/nick'}, 400); return
                mp = load_nicks()
                owner = mp.get(nick)
                if owner and owner != uid:
                    self._json({'ok': False, 'error': 'taken', 'by': owner}, 409); return
                # 若该uid此前占用别的昵称,释放旧名
                for n2, u2 in list(mp.items()):
                    if u2 == uid and n2 != nick:
                        mp.pop(n2, None)
                mp[nick] = uid
                save_nicks(mp)
                self._json({'ok': True})
            elif p == '/api/reviews':
                b = self._body(200 * 1024)
                rv = load_reviews()
                rv.append({'id': str(b.get('id', ''))[:32] or ('srv' + str(int(time.time() * 1000))),
                           'replyTo': str(b.get('replyTo', ''))[:32],
                           'dishId': str(b.get('dishId', ''))[:24], 'dish': str(b.get('dishName', b.get('dish', '')))[:60],
                           'stars': int(b.get('stars', 0)),
                           'tags': [str(t)[:12] for t in (b.get('tags') or [])][:8],
                           'text': str(b.get('text', ''))[:300], 'time': int(b.get('time') or time.time() * 1000),
                           'caf': str(b.get('caf', ''))[:20], 'win': str(b.get('win', ''))[:20],
                           'nick': str(b.get('nick', ''))[:16], 'uid': str(b.get('uid', ''))[:24]})
                if len(rv) > 2000: rv = rv[-2000:]
                save_reviews(rv)
                self._json({'ok': True, 'count': len(rv)})
            elif p == '/api/chat':
                self._chat()
            elif p == '/api/vision':
                self._vision()
            else:
                self._json({'error': 'not found'}, 404)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            try: self._json({'error': str(e)[:200]}, 500)
            except Exception: pass

    def _chat(self):
        b = self._body()
        stream = bool(b.get('stream'))
        body = {'model': MODEL_CHAT, 'messages': b.get('messages', []),
                'max_tokens': min(int(b.get('max_tokens') or 1500), 8000),
                'temperature': b.get('temperature', 0.6), 'stream': stream}
        if stream:
            try:
                up = ant_post('/chat/completions', body)
            except Exception as e:
                self._json({'error': str(e)[:200]}, 502); return
            self.send_response(200)
            self._cors()
            self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('X-Accel-Buffering', 'no')
            self.send_header('Transfer-Encoding', 'chunked')
            self.end_headers()
            try:
                while True:
                    chunk = up.read(512)
                    if not chunk: break
                    self.wfile.write(b'%x\r\n' % len(chunk) + chunk + b'\r\n')
                    self.wfile.flush()
                self.wfile.write(b'0\r\n\r\n')
            except (BrokenPipeError, ConnectionResetError):
                pass
        else:
            try:
                with ant_post('/chat/completions', body) as up:
                    self._json_bytes(up.read())
            except Exception as e:
                self._json({'error': str(e)[:200]}, 502)

    def _json_bytes(self, raw):
        self.send_response(200)
        self._cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _vision(self):
        b = self._body()
        messages = [{'role': 'user', 'content': [
            {'type': 'image_url', 'image_url': {'url': b.get('image', '')}},
            {'type': 'text', 'text': b.get('prompt', '识别图片')},
        ]}]
        body = {'model': MODEL_VISION, 'messages': messages,
                'max_tokens': min(int(b.get('max_tokens') or 6000), 12000), 'temperature': 0.2}
        try:
            with ant_post('/chat/completions', body) as up:
                self._json_bytes(up.read())
        except Exception as e:
            self._json({'error': str(e)[:200]}, 502)

def main():
    key = ant_key()
    os.makedirs(DATA_DIR, exist_ok=True)
    httpd = http.server.ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    print('=' * 56)
    print('🌾 知食 ZhiShi 服务器已启动  端口:', PORT)
    print('   AI 密钥:', '已加载 ✔' if key else '❌ 未找到(请放 ant_key.txt 或设 ANT_KEY)')
    print('   模型:', MODEL_CHAT, '/', MODEL_VISION)
    print('   共享评价存储:', REVIEWS_FILE)
    try:
        ips = []
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip.startswith(('192.168.', '10.', '172.')) and ip not in ips:
                ips.append(ip)
        for ip in ips:
            print('   📱 同一WiFi手机访问: http://%s:%d' % (ip, PORT))
    except Exception:
        pass
    print('   本机访问: http://localhost:%d' % PORT)
    print('=' * 56)
    httpd.serve_forever()

if __name__ == '__main__':
    main()
