# -*- coding: utf-8 -*-
"""修复 openDishReviews 里的作用域错误: x.avg 不在作用域内"""
import sys
sys.stdout.reconfigure(encoding="utf-8")
p = r"D:\大学\农客松\app\js\rank.js"
c = open(p, encoding="utf-8").read()

# 修 renderReview 里的 x.avg 引用 → r.stars
old = '''      return `<div class="review-item" style="padding:.55rem .2rem">
        ${x.avg ? `<span class="ri-score ${x.avg < 3 ? 'bad' : ''}">${'★'.repeat(Math.round(x.avg))}${'☆'.repeat(5 - Math.round(x.avg))} ${x.avg.toFixed(1)}</span>` : `<span class="ri-score bad">数据预警</span>`}
        <span class="rv-time" style="margin-left:.3rem">${esc(this.nickOf(r))} · ${this._ago(r.time)}</span>'''
new = '''      return `<div class="review-item" style="padding:.55rem .2rem">
        ${'★'.repeat(Math.round(r.stars || 0))}
        <span class="rv-time" style="margin-left:.3rem">${esc(this.nickOf(r))} · ${this._ago(r.time)}</span>'''
assert old in c, "renderReview x.avg 锚点未找到"
c = c.replace(old, new, 1)
open(p, "w", encoding="utf-8", newline="\n").write(c)
print("✅ renderReview 作用域错误已修")
