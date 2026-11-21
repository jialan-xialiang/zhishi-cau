# -*- coding: utf-8 -*-
"""本轮修改: ①删设置里的清评价按钮 ②删5连击逻辑 ③修回复星级bug(不再强制0星)"""
import sys
sys.stdout.reconfigure(encoding="utf-8")

# ── 1. index.html 删除按钮块 ──
p = r"D:\大学\农客松\app\index.html"
h = open(p, encoding="utf-8-sig").read()
btn_block = '''      <div class="field" style="margin-top:.6rem">
        <button class="btn btn-danger" id="set-clear-reviews" style="width:100%">🗑 清除本机评价副本（连点 5 次生效）</button>
        <div class="mini-note">只清本地评价副本（云端主副本不受影响）；档案/日记/身份/自定义菜全部保留。仅用于云端已清空后清理本机幽灵副本。</div>
      </div>
'''
if btn_block in h:
    h = h.replace(btn_block, "", 1)
    print("✅ index.html: 清评价按钮已删除")
elif "set-clear-reviews" not in h:
    print("⏭ index.html: 按钮不存在,跳过")
else:
    print("⚠️ 按钮文本不匹配,尝试宽松匹配")
    import re
    h2 = re.sub(r'<div class="field" style="margin-top:\.6rem">\s*<button class="btn btn-danger" id="set-clear-reviews"[^<]*</button>\s*<div class="mini-note">[^<]*</div>\s*</div>', "", h)
    print("宽松匹配删除:", "✅" if h2 != h else "❌")
    h = h2
open(p, "w", encoding="utf-8-sig", newline="").write(h)

# ── 2. main.js 删除5连击绑定 ──
p2 = r"D:\大学\农客松\app\js\main.js"
m = open(p2, encoding="utf-8").read()
start = m.find("$('#set-clear-reviews').onclick")
if start >= 0:
    # 向前找到该语句块开头, 向后找到结尾(到下一个 $('#set-test') 或分号层)
    end_marker = "$('#set-test').onclick"
    end = m.find(end_marker, start)
    # 回溯: 删除从 start 到 end 之间的代码
    m = m[:start] + m[end:]
    print("✅ main.js: 5连击逻辑已删除")
else:
    print("⏭ main.js: 绑定不存在,跳过")
open(p2, "w", encoding="utf-8", newline="\n").write(m)

# ── 3. rank.js 修回复星级bug: 删强制0星 ──
p3 = r"D:\大学\农客松\app\js\rank.js"
r = open(p3, encoding="utf-8").read()
bug_line = "if (this.replyTarget) this.stars = 0;"
if bug_line in r:
    r = r.replace(bug_line, "", 1)
    print("✅ rank.js: 回复强制0星的bug已删除(回复保留用户点的星级)")
else:
    print("⏭ rank.js: bug行不存在,跳过")
open(p3, "w", encoding="utf-8", newline="\n").write(r)
print("全部完成")
