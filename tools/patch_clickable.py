# -*- coding: utf-8 -*-
"""榜单菜卡整体可点击打开评论区 + tabbar避让"""
import sys, re
sys.stdout.reconfigure(encoding="utf-8")

p = r"D:\大学\农客松\app\js\rank.js"
c = open(p, encoding="utf-8").read()

# 1. rank-item 加 data-open-dish 属性 → 整卡可点击
c = c.replace(
    'return `<div class="rank-item">',
    'return `<div class="rank-item" data-open-dish="${esc(x.key)}" style="cursor:pointer">'
)

# 2. 删单独的"查看评论区"按钮(整卡可点已覆盖)
c = c.replace(
    '<button class="btn" data-open-reviews="${esc(x.key)}">查看评论区(${x.n})</button>\n          ',
    '')

# 3. 绑定: 点 rank-item 打开评论区(排除内部按钮)
old_bind = "$$('#rank-list [data-open-reviews]').forEach(b => b.onclick = () => this.openDishReviews(b.dataset.openReviews));"
new_bind = """    $$('#rank-list .rank-item').forEach(item => {
      item.onclick = e => {
        if (e.target.closest('button') || e.target.closest('.mini-btn')) return;
        this.openDishReviews(item.dataset.openDish);
      };
    });"""
if old_bind in c:
    c = c.replace(old_bind, new_bind, 1)

# 4. tabbar避让(css)
pc = r"D:\大学\农客松\app\css\style.css"
cs = open(pc, encoding="utf-8").read()
if ".tabbar{padding-right" not in cs:
    cs = cs.replace(
        "/* ── tab栏 ── */",
        "/* ── tab栏 ── */\n@media (max-width:600px){\n  .tabbar{padding-right:145px}\n}"
    )
open(pc, "w", encoding="utf-8", newline="\n").write(cs)

open(p, "w", encoding="utf-8", newline="\n").write(c)
print("✅ rank.js: 菜卡可点开评论区 + tabbar避让已加")
