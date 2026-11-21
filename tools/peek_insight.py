# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding="utf-8")
c = open(r"D:\大学\农客松\app\js\rank.js", encoding="utf-8").read()
# 搜索 insight 渲染区域
i = c.find("async insight()")
j = c.find("bind()")
seg = c[i:j]
# 找 "给食堂" 或 "trend" 在渲染部分的引用
for kw in ["给食堂", "trend", "ai-note"]:
    idx = 0
    while True:
        idx = seg.find(kw, idx)
        if idx < 0: break
        print(f"'{kw}' @insight+{idx}: ...{seg[max(0,idx-30):idx+40]}...")
        idx += len(kw)
# 打印整个 insight 函数
sys.stdout.write("\n═══ insight 完整代码 ═══\n")
sys.stdout.write(c[i:c.find("bind()")])
