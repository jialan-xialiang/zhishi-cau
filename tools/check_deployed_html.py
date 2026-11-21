# -*- coding: utf-8 -*-
import sys, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
req = urllib.request.Request("https://zhishi-cau-ifmv.zai.site/index.html?v=38",
                             headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
h = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", errors="replace")
print("长度:", len(h))
# 检查结构完整性
for kw in ["</html>", "</body>", "</main>", "view-rank", "view-home", "tabbar", "style.css"]:
    print(kw, ":", kw in h)
# 开头
print("\n开头500:", h[:500])
# 检查emoji残留(可能破坏HTML)
import re
emojis = re.findall(r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U00002190-\U000021FF]", h)
print("emoji残留:", len(emojis), emojis[:10] if emojis else "")
# 检查style标签
print("<style>标签:", "<style" in h)
