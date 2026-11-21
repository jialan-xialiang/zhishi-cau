# -*- coding: utf-8 -*-
import sys, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
B = "https://zhishi-cau-ifmv.zai.site"

# rank.js 检查
req = urllib.request.Request(B + "/js/rank.js?v=999", headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
js = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", errors="replace")
print("rank.js:")
print("  给食堂的话已删:", "给食堂的话" not in js)
print("  提交后清缓存:", "CACHE.set('rank_insight', null)" in js)
print("  返回绑定:", "$('#dr-back')" in js)
print("  回复免星级:", "if (this.replyTarget) this.stars = 0;" not in js)

# index.html 检查
req = urllib.request.Request(B + "/index.html?v=999", headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
h = urllib.request.urlopen(req, timeout=30).read().decode("utf-8-sig", errors="replace")
print("\nindex.html:")
print("  抽屉返回按钮:", "dr-back" in h)
print("  规则卡已删:", "榜单规则" not in h)
print("  演示卡已删:", "btn-load-demo" not in h)
print("  badge已删:", "点周几" not in h)
print("  css版本:", h[h.find("style.css"):h.find("style.css")+20])
