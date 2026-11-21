# -*- coding: utf-8 -*-
import sys, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
req = urllib.request.Request("https://zhishi-cau-ifmv.zai.site/js/rank.js?v=38",
                             headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
js = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", errors="replace")
# 检查绑定是否存在
for kw in ["rank-list .rank-item", "openDishReviews(item.dataset", "data-reply-id"]:
    print(kw, ":", kw in js)
# 打印 renderSeg 末尾的绑定区域
i = js.find("data-nutri")
if i >= 0:
    print("\n绑定区域:", js[i:i + 400].replace("\n", " "))
