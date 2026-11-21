# -*- coding: utf-8 -*-
import sys, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
req = urllib.request.Request("https://zhishi-cau-ifmv.zai.site/js/rank.js?v=38",
                             headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
js = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", errors="replace")
print("长度:", len(js))
for kw in ["data-open-dish", "data-open-reviews", "查看评论区", "rank-item']", "onclick = e =>"]:
    found = kw in js
    positions = []
    idx = 0
    while True:
        i = js.find(kw, idx)
        if i < 0: break
        positions.append(i)
        idx = i + len(kw)
    print(f"  {kw}: {'✅' if found else '❌'} @{positions[:5]}")
# 打印 renderSeg 里的按钮区域
i = js.find("ri-btns")
if i >= 0:
    print("\nri-btns 上下文:", js[i:i + 200].replace("\n", " "))
# 打印绑定区域
i = js.find("rank-item']")
if i >= 0:
    print("\nrank-item绑定:", js[i:i + 200].replace("\n", " "))
