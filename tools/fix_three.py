# -*- coding: utf-8 -*-
"""三修: ①删给食堂的话 ②提交后清洞察缓存 ③评论区返回按钮加大"""
import sys
sys.stdout.reconfigure(encoding="utf-8")
p = r"D:\大学\农客松\app\js\rank.js"
c = open(p, encoding="utf-8").read()
n = 0

# 1. 删"给食堂的话"
old_trend = '''        <div class="ai-note" style="border-color:#7fd0a0;background:#f2fbf5;color:#256b43;margin-top:.4rem">给食堂的话:${esc(j.trend || '')}</div>`;'''
if old_trend in c:
    c = c.replace(old_trend, "`;", 1)
    n += 1
    print("✅ 给食堂的话已删")
else:
    # 宽松匹配
    import re as _re
    m = _re.search(r'<div class="ai-note"[^>]*>给食堂的话[^<]*</div>`;', c)
    if m:
        c = c.replace(m.group(0), "`;", 1)
        n += 1
        print("✅ 给食堂的话已删(宽松)")
    else:
        print("⚠️ 给食堂的话未找到")

# 2. insight 输出去掉 trend 字段引用
old_trend2 = '''"trend":"给食堂的改进建议≤50字"` }},'''
if old_trend2 in c:
    c = c.replace(old_trend2, '''"trend":""` }},''', 1)
    print("✅ AI prompt 已去掉 trend")

# 3. 提交后清洞察缓存(找回丢失的失效逻辑)
old_submit = "          this._revCache = null;\n          await this.syncRemote();"
if "rank_insight" not in c[c.find(old_submit):c.find(old_submit) + 200]:
    c = c.replace(old_submit,
      "          this._revCache = null;\n          CACHE.set('rank_insight', null);\n          await this.syncRemote();", 1)
    n += 1
    print("✅ 提交后清洞察缓存")

# 4. openDishReviews: 抽屉头加大返回按钮
old_dr = '''    drawer.hidden = false;
    $$('#dr-body [data-reply-id]').forEach('''
new_dr = '''    drawer.hidden = false;
    const backBtn = $('#dr-back');
    if (backBtn) backBtn.onclick = () => { drawer.hidden = true; };
    $$('#dr-body [data-reply-id]').forEach('''
if old_dr in c:
    c = c.replace(old_dr, new_dr, 1)
    n += 1
    print("✅ 抽屉返回绑定")
else:
    print("⚠️ 抽屉绑定锚点未找到")

open(p, "w", encoding="utf-8", newline="\n").write(c)
print("rank.js 完成,", n, "处修改")

# 5. index.html: 抽屉头改布局(左返回+右关闭)
p2 = r"D:\大学\农客松\app\index.html"
h = open(p2, encoding="utf-8-sig").read()
old_head = '''    <div class="drawer-head">
      <b id="dr-title">评论区</b>
      <button class="icon-btn" id="dr-close">✕</button>
    </div>'''
if "dr-back" not in h:
    new_head = '''    <div class="drawer-head">
      <button class="icon-btn" id="dr-back" style="font-size:13px;font-weight:600;display:flex;align-items:center;gap:4px;color:#fff">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="width:18px;height:18px"><path d="M15 5l-7 7 7 7"/></svg>返回
      </button>
      <b id="dr-title" style="flex:1;text-align:center;font-size:15px"></b>
      <span style="width:56px"></span>
    </div>'''
    if old_head in h:
        h = h.replace(old_head, new_head, 1)
        print("✅ index.html: 抽屉头改返回布局")
    else:
        print("⚠️ 抽屉头锚点未匹配")
open(p2, "w", encoding="utf-8-sig", newline="").write(h)
