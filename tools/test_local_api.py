# -*- coding: utf-8 -*-
import json, urllib.request, sys
sys.stdout.reconfigure(encoding="utf-8")

body = {"messages": [{"role": "user", "content": "只回复两个字:正常"}], "max_tokens": 100, "stream": False}
req = urllib.request.Request("http://localhost:8000/api/chat", data=json.dumps(body).encode(),
                             headers={"Content-Type": "application/json"}, method="POST")
try:
    with urllib.request.urlopen(req, timeout=120) as r:
        d = json.loads(r.read())
    c = d["choices"][0]["message"]
    print("OK 模型:", d.get("model"), "| 内容:", (c.get("content") or "")[:50], "| usage:", d.get("usage", {}).get("total_tokens"))
except Exception as e:
    print("FAIL:", str(e)[:150])
    try:
        print("响应体:", e.read()[:200].decode(errors="replace"))
    except Exception:
        pass
