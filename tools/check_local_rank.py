# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding="utf-8")
c = open(r"D:\大学\农客松\app\js\rank.js", encoding="utf-8").read()
print("本地 rank.js:")
print("  给食堂的话:", "给食堂的话" in c)
print("  返回绑定:", "$('#dr-back')" in c)
h = open(r"D:\大学\农客松\app\index.html", encoding="utf-8-sig").read()
print("  index 抽屉返回:", "dr-back" in h)
