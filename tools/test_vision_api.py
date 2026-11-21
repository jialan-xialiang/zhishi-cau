# -*- coding: utf-8 -*-
"""测试本地服务器的视觉识别代理 /api/vision"""
import sys, json, base64, zlib, struct, urllib.request
sys.stdout.reconfigure(encoding="utf-8")

def chunk(t, d):
    c = t + d
    return struct.pack(">I", len(d)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

rows = []
for y in range(64):
    r = bytearray([0])
    for x in range(64):
        # 造一个"伪菜品"图: 左半深棕(像红烧肉),右半绿(像青菜)
        r += bytes([120, 60, 30] if x < 32 else [60, 140, 60])
    rows.append(bytes(r))
png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 64, 64, 8, 2, 0, 0, 0))
       + chunk(b"IDAT", zlib.compress(b"".join(rows))) + chunk(b"IEND", b""))

body = {"image": "data:image/png;base64," + base64.b64encode(png).decode(),
        "prompt": "这是菜品照片吗?简短回答看到了什么颜色块。", "max_tokens": 400}
req = urllib.request.Request("http://localhost:8000/api/vision", data=json.dumps(body).encode(),
                             headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(req, timeout=180) as r:
    d = json.loads(r.read())
c = d["choices"][0]["message"]
print("OK 模型:", d.get("model"), "| 内容:", (c.get("content") or "")[:120])
