# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding="utf-8")
p = r"D:\大学\农客松\app\index.html"
h = open(p, encoding="utf-8-sig").read()
h = h.replace("本周记录热力", "本周记录热量")
open(p, "w", encoding="utf-8-sig", newline="").write(h)
print("✅ 热力→热量")
