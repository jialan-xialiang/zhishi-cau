# -*- coding: utf-8 -*-
"""公网最终版本验收: index版本/贝叶斯榜单/自然周/小火锅/昵称接口"""
import sys, json, urllib.request, re
sys.stdout.reconfigure(encoding="utf-8")
B = "https://zhishi-cau-ifmv.zai.site"

def get(p):
    req = urllib.request.Request(B + p, headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

html = get("/index.html").decode("utf-8", errors="replace")
vs = re.findall(r"\?v=(\d+)", html)
print("① 资源版本号:", vs)

js = get("/js/rank.js?v=99").decode("utf-8", errors="replace")
print("② 贝叶斯榜单已上线:", "bayes" in js or "贝叶斯" in js)
print("③ 昵称注册接口调用已上线:", "/api/nick" in js)

store = get("/js/store.js?v=99").decode("utf-8", errors="replace")
print("④ 自然周weekDiary已上线:", "monday" in store or "dow" in store)

data = get("/js/data.js?v=99").decode("utf-8", errors="replace")
i = data.find("const DISHES="); j = data.find("const DISH_MAP")
dishes = json.loads(data[i + 13:j].rstrip().rstrip(";"))
hp = next((x for x in dishes if x["name"] == "小火锅"), None)
print("⑤ 小火锅:", "✅ 在库(研二)" if hp and any(w["caf"] == "研二（风味）" for w in hp["where"]) else "❌")
print("   总菜数:", len(dishes))

ping = json.loads(get("/api/ping"))
print("⑥ ping:", ping.get("ok"), "| 共享评价:", ping.get("reviews"))
try:
    nicks = json.loads(get("/api/nicks"))
    print("⑦ 昵称注册表接口:", "✅", len(nicks.get("nicks", {})), "个昵称")
except Exception as e:
    print("⑦ 昵称接口: ❌", str(e)[:60])
