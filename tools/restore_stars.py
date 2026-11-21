# -*- coding: utf-8 -*-
"""全量扫描被误删的语义符号并恢复"""
import sys, re, os
sys.stdout.reconfigure(encoding="utf-8")
DIR = r"D:\大学\农客松\app\js"

# 1. rank.js: paint函数/初始星星 的 ★☆ 恢复
p = os.path.join(DIR, "rank.js")
c = open(p, encoding="utf-8").read()
fixes = [
    # paint函数(评星交互)
    ("const paint = v => starsEl.textContent = ''.repeat(v) + ''.repeat(5 - v);",
     "const paint = v => starsEl.textContent = '★'.repeat(v) + '☆'.repeat(5 - v);"),
    ("starsEl.textContent = ''.repeat(v)", "starsEl.textContent = '★'.repeat(v)"),
    # 抽屉楼层星级(若有残留)
    ("''.repeat(Math.round(r.stars || 0))", "'★'.repeat(Math.round(r.stars || 0))"),
]
n = 0
for old, new in fixes:
    if old in c:
        c = c.replace(old, new)
        n += 1
open(p, "w", encoding="utf-8", newline="\n").write(c)
print("rank.js:", n, "处恢复")

# 2. index.html: 评星初始 ☆☆☆☆☆ + 其他空符号位
p = os.path.join(DIR, "index.html")
h = open(p, encoding="utf-8-sig").read()
fixes2 = [
    ('<span class="stars" data-v="0"></span>', '<span class="stars" data-v="0">☆☆☆☆☆</span>'),
]
n = 0
for old, new in fixes2:
    if old in h:
        h = h.replace(old, new)
        n += 1
open(p, "w", encoding="utf-8-sig", newline="").write(h)
print("index.html:", n, "处恢复")

# 3. 全量扫描: 还有哪里有 ''.repeat / 空按钮
print("\n── 残留扫描 ──")
for f in os.listdir(DIR):
    if not f.endswith(".js"): continue
    c = open(os.path.join(DIR, f), encoding="utf-8").read()
    for m in re.finditer(r"'{2,}\.repeat\(", c):
        ln = c[:m.start()].count("\n") + 1
        print(f"  {f}:{ln} 残留 ''.repeat")
    for m in re.finditer(r'id="[a-z-]+">\s*</button>', c) if f == "main.js" else []:
        pass
print("扫描完成")
