# -*- coding: utf-8 -*-
"""恢复'查看评论区'按钮 + 保留整卡点击"""
import sys
sys.stdout.reconfigure(encoding="utf-8")
p = r"D:\大学\农客松\app\js\rank.js"
c = open(p, encoding="utf-8").read()
old = '''        <div class="ri-btns">
          <button class="btn" data-review="${esc(x.key)}" data-review-name="${esc(x.name)}">我也评</button>'''
new = '''        <div class="ri-btns">
          <button class="btn" data-open-reviews="${esc(x.key)}">查看评论区(${x.n})</button>
          <button class="btn" data-review="${esc(x.key)}" data-review-name="${esc(x.name)}">我也评</button>'''
if old in c:
    c = c.replace(old, new, 1)
    print("✅ 查看评论区按钮已恢复")
else:
    print("⚠️ 未匹配,检查内容")
open(p, "w", encoding="utf-8", newline="\n").write(c)
