# -*- coding: utf-8 -*-
"""线上站点全链路验证 v2: ping用GET, chat/vision/reviews用POST"""
import sys, json, base64, zlib, struct, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
BASE = "https://zhishi-cau-ifmv.zai.site"

def get(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def post(path, body, timeout=180):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())

d = get("/api/ping")
print("GET ping:", d)

d = post("/api/chat", {"messages": [{"role": "user", "content": "只回复两个字:在线"}], "max_tokens": 100})
c = d["choices"][0]["message"]
print("POST chat:", d.get("model"), "->", (c.get("content") or "")[:30])

def chunk(t, x):
    q = t + x
    return struct.pack(">I", len(x)) + q + struct.pack(">I", zlib.crc32(q) & 0xFFFFFFFF)
rows = []
for y in range(64):
    r = bytearray([0])
    for x in range(64):
        r += bytes([120, 60, 30] if x < 32 else [60, 140, 60])
    rows.append(bytes(r))
png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 64, 64, 8, 2, 0, 0, 0))
       + chunk(b"IDAT", zlib.compress(b"".join(rows))) + chunk(b"IEND", b""))
d = post("/api/vision", {"image": "data:image/png;base64," + base64.b64encode(png).decode(),
                         "prompt": "图里什么颜色?一句话", "max_tokens": 300})
c = d["choices"][0]["message"]
print("POST vision:", d.get("model"), "->", (c.get("content") or "")[:60])

d = post("/api/reviews", {"dish": "佛跳墙", "stars": 5, "tags": ["好吃"], "text": "线上验收评价", "time": 0, "nick": "验收员", "uid": "utest"})
print("POST reviews:", d)
d = get("/api/reviews")
print("GET reviews:", "count =", d.get("count"), "| 最新:", (d.get("reviews") or [{}])[0].get("text", ""))
