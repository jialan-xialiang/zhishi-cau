# -*- coding: utf-8 -*-
import sys
sys.stdout.reconfigure(encoding="utf-8")
c = open(r"D:\大学\农客松\app\js\rank.js", encoding="utf-8").read()
# 找"给食堂"
i = c.find("给食堂")
if i >= 0:
    print("给食堂 上下文:")
    sys.stdout.write(c[max(0, i - 100):i + 100])
else:
    print("'给食堂' 已不在代码中")
# 找 openDishReviews 里的 drawer.hidden = false 附近
i = c.find("drawer.hidden = false")
while i >= 0:
    sys.stdout.write("\n── @" + str(i) + " ──\n" + c[i:i + 200])
    i = c.find("drawer.hidden = false", i + 1)
