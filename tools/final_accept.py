# -*- coding: utf-8 -*-
"""v9 公网验收: 全量营养库/搜索逻辑/ping/真实照片视觉"""
import sys, json, base64, re, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
BASE = "https://zhishi-cau-ifmv.zai.site"

def get(p):
    req = urllib.request.Request(BASE + p, headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()

# 1. 全量营养库
js = get("/js/data.js?v=9").decode("utf-8", errors="replace")
i = js.find("const DISHES=")
j = js.find("const DISH_MAP")
dishes = json.loads(js[i + len("const DISHES="):j].rstrip().rstrip(";"))
precise = sum(1 for d in dishes if d.get("kcal") not in (0, None) and d.get("protein") not in (0, None))
print("① 菜品总数:", len(dishes), "| 有营养数据:", precise)
hsgn = next((d for d in dishes if d["name"] == "红烧牛肉面"), None)
print("② 红烧牛肉面归属:", [w["caf"] for w in hsgn["where"]], " kcal:", hsgn["kcal"])

# 2. 关键词搜索逻辑模拟(kwMatch JS逻辑的python版)
def kw_match(d, q):
    hay = (d["name"] + "," + ",".join(d.get("tags", [])) + "," + d.get("cat", "")).lower()
    return all(t in hay for t in q.lower().replace("，", ",").replace("、", ",").split())
hits = [d["name"] for d in dishes if kw_match(d, "红烧 牛肉")]
print("③ 关键词搜索'红烧 牛肉':", hits[:6])

# 3. ping
print("④ ping:", json.loads(get("/api/ping")))

# 4. 真实照片视觉
IMG = r"D:\wechat\xwechat_files\wxid_blbs3r93fdlj22_da31\temp\RWTemp\2026-11\9e20f478899dc29eb19741386f9343c8\dd0c4417e12088532f666564b74962dc.jpg"
b64 = base64.b64encode(open(IMG, "rb").read()).decode()
body = {"image": "data:image/jpeg;base64," + b64,
        "prompt": '仔细观察这张图片,把看到的食物逐样列出来,按公开膳食数据快速估算营养。直接输出最终JSON(双引号):{"foods":[{"food":"外观描述","g":克数}],"kcal":总热量,"protein":克,"fat":克,"carb":克,"sodium":毫克,"tags":["辣"或"清淡"],"desc":"15字点评"}',
        "max_tokens": 4000}
req = urllib.request.Request(BASE + "/api/vision", data=json.dumps(body).encode(),
                             headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(req, timeout=240) as r:
    d = json.loads(r.read())
m = d["choices"][0]["message"]
content = m.get("content") or m.get("reasoning_content", "")[-300:]
print("⑤ 真实照片识别:", content[:180].replace("\n", " "))
