# -*- coding: utf-8 -*-
"""探测蚂蚁 MaaS API 能力: 模型列表/文本对话/流式/CORS/视觉。仅标准库。
用法: python -I probe_api.py <api_key> <输出txt>"""
import sys, json, time, base64, zlib, struct, urllib.request, urllib.error

BASE = "https://maas-api.antdigital.com/v1"

def make_png(w=64, h=64):
    def chunk(typ, data):
        c = typ + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    rows = []
    for y in range(h):
        row = bytearray([0])
        for x in range(w):
            row += bytes([230, 60, 40]) if x < w // 2 else bytes([40, 190, 90])
        rows.append(bytes(row))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(b"".join(rows)))
    png += chunk(b"IEND", b"")
    return png

def req(method, path, key, body=None, headers=None, timeout=90):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json"}
    if key:
        h["Authorization"] = "Bearer " + key
    if headers:
        h.update(headers)
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read()
            return resp.status, dict(resp.headers), raw
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()
    except Exception as e:
        return None, {}, str(e).encode()

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    key = sys.argv[1]
    out_path = sys.argv[2]
    log = []
    def p(*a):
        s = " ".join(str(x) for x in a)
        log.append(s)
        print(s)

    # 1. 模型列表
    st, hd, raw = req("GET", "/models", key)
    p("\n===== 1. GET /models ===== status:", st)
    try:
        models = [m["id"] for m in json.loads(raw).get("data", [])]
        p("models:", json.dumps(models, ensure_ascii=False))
    except Exception as e:
        models = []
        p("parse fail:", e, "raw[:500]:", raw[:500].decode(errors="replace"))

    # 2. 文本对话 ling-3.2-flash
    st, hd, raw = req("POST", "/chat/completions", key, {
        "model": "ling-3.2-flash",
        "messages": [{"role": "user", "content": "请只回复两个字:收到"}],
        "max_tokens": 20,
    })
    p("\n===== 2. POST /chat/completions (ling-3.2-flash) ===== status:", st)
    p("raw[:1200]:", raw[:1200].decode(errors="replace"))

    # 3. 流式
    p("\n===== 3. stream=true 测试 =====")
    st, hd, raw = req("POST", "/chat/completions", key, {
        "model": "ling-3.2-flash",
        "messages": [{"role": "user", "content": "从1数到5"}],
        "stream": True, "max_tokens": 60,
    })
    p("status:", st, "content-type:", hd.get("Content-Type"))
    p("raw[:1500]:", raw[:1500].decode(errors="replace"))

    # 4. CORS 预检
    st, hd, raw = req("OPTIONS", "/chat/completions", None, None, headers={
        "Origin": "http://localhost:8000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, content-type",
    })
    p("\n===== 4. CORS 预检 OPTIONS ===== status:", st)
    for k, v in hd.items():
        p("  ", k, ":", v)

    # 5. 视觉测试: 先 ling-3.2-flash, 再候选视觉模型
    png = make_png()
    b64 = base64.b64encode(png).decode()
    data_url = "data:image/png;base64," + b64
    candidates = ["ling-3.2-flash"]
    for m in models or []:
        ml = m.lower()
        if any(kw in ml for kw in ["vl", "vision", "glm-4v", "qwen-vl", "qvq", "internvl", "minicpm-v", "gemma"]):
            candidates.append(m)
    p("\n===== 5. 视觉测试 ===== candidates:", candidates)
    for mid in candidates[:6]:
        st, hd, raw = req("POST", "/chat/completions", key, {
            "model": mid,
            "messages": [{"role": "user", "content": [
                {"type": "text", "text": "这张图片左半边和右半边分别是什么颜色? 用中文一句话回答"},
                {"type": "image_url", "image_url": {"url": data_url}},
            ]}],
            "max_tokens": 100,
        })
        p("--- model:", mid, "status:", st)
        p(raw[:800].decode(errors="replace"))

    # 6. 采样参数确认(temperature 支持)
    st, hd, raw = req("POST", "/chat/completions", key, {
        "model": "ling-3.2-flash",
        "messages": [{"role": "system", "content": "你是个只会说西瓜的机器人"},
                     {"role": "user", "content": "你好"}],
        "max_tokens": 20, "temperature": 0.3,
    })
    p("\n===== 6. system+temperature ===== status:", st)
    p(raw[:600].decode(errors="replace"))

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(log))
    print("\nsaved to", out_path)

if __name__ == "__main__":
    main()
