# -*- coding: utf-8 -*-
"""验证视觉修复: content 是否非空(reasoning兜底) + 新prompt"""
import sys, json, base64, zlib, struct, urllib.request
sys.stdout.reconfigure(encoding="utf-8")

def chunk(t, x):
    q = t + x
    return struct.pack(">I", len(x)) + q + struct.pack(">I", zlib.crc32(q) & 0xFFFFFFFF)

# 造一张 96x96 "伪菜照": 棕色主体+绿色配菜+白色米饭区
rows = []
for y in range(96):
    r = bytearray([0])
    for x in range(96):
        if x < 60 and 20 < y < 76:
            c = (139, 69, 33)  # 棕色主菜
        elif x >= 60:
            c = (245, 245, 238)  # 白米饭
        else:
            c = (60, 140, 60)    # 绿色青菜
        r += bytes(c)
    rows.append(bytes(r))
png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 96, 96, 8, 2, 0, 0, 0))
       + chunk(b"IDAT", zlib.compress(b"".join(rows))) + chunk(b"IEND", b""))

body = {"image": "data:image/png;base64," + base64.b64encode(png).decode(),
        "prompt": '看这张图片,直接说出你看到的食物,按公开膳食数据快速估算营养。要求:不要长篇推理,直接输出最终JSON(双引号):{"name":"看到的食物简述(≤14字)","items":[{"food":"食材","g":克数估算}],"kcal":总热量数字,"protein":克,"fat":克,"carb":克,"sodium":毫克,"tags":["辣"或"清淡"],"desc":"15字内点评"}',
        "max_tokens": 3200}
for host in ["http://localhost:3000", "https://zhishi-cau-ifmv.zai.site"]:
    try:
        req = urllib.request.Request(host + "/api/vision", data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=180) as r:
            d = json.loads(r.read())
        m = d["choices"][0]["message"]
        content = m.get("content") or ""
        reasoning = m.get("reasoning_content") or ""
        print(f"[{host}] content长度={len(content)} reasoning长度={len(reasoning)}")
        print("  content:", content[:150].replace("\n", " "))
        if not content and reasoning:
            print("  reasoning尾部(应含JSON):", reasoning[-150:].replace("\n", " "))
    except Exception as e:
        print(f"[{host}] FAIL: {str(e)[:120]}")
