# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding="utf-8")
for p in [r"D:\大学\农客松\app\index.html", r"D:\大学\农客松\app\js\report.js"]:
    c = open(p, encoding="utf-8-sig" if p.endswith(".html") else "utf-8").read()
    for kw in ["热力", "本周记录"]:
        i = 0
        while True:
            i = c.find(kw, i)
            if i < 0:
                break
            print(p.split("\\")[-1], "@", i, ":", c[max(0, i - 20):i + 30].replace("\n", " "))
            i += len(kw)
