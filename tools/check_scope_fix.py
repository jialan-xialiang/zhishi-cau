# -*- coding: utf-8 -*-
import sys, json, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
B = "https://zhishi-cau-ifmv.zai.site"
req = urllib.request.Request(B + "/js/rank.js?v=40", headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
js = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", errors="replace")
# 检查 x.avg 是否还在 openDishReviews 区域
i = js.find("openDishReviews")
j = js.find("_ago(t)")
seg = js[i:j]
print("openDishReviews 区域含 x.avg:", "x.avg" in seg)
print("含 r.stars:", "r.stars" in seg)
print("区域长度:", len(seg))
print("正常返回")
