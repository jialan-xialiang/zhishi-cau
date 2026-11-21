# -*- coding: utf-8 -*-
import sys, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
req = urllib.request.Request("https://zhishi-cau-ifmv.zai.site/index.html?v=36",
                             headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
h = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", errors="replace")
i = h.find('id="view-rank"')
j = h.find('id="view-report"')
seg = h[i:j]
# 检查div配对
print("rank区块长度:", len(seg))
print("div开:", seg.count("<div"), "div闭:", seg.count("</div>"))
print("关键元素: seg按钮:", "rank-seg" in seg, "| rank-list:", 'id="rank-list"' in seg,
      "| 洞察卡:", "rank-insight" in seg, "| 身份条:", "my-identity" in seg,
      "| 写评价表单:", "review-dish" in seg, "| 提交按钮:", "btn-review-submit" in seg)
print()
sys.stdout.write(seg[:2200])
