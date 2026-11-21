# -*- coding: utf-8 -*-
"""补齐: 删给食堂的话 + 绑定返回按钮"""
import sys, re
sys.stdout.reconfigure(encoding="utf-8")
p = r"D:\大学\农客松\app\js\rank.js"
c = open(p, encoding="utf-8").read()
n = 0

# 1. 删 AI prompt 里的 trend 字段
c = c.replace('"trend":"给食堂的改进建议≤50字"', '"trend":""', 1)
n += 1

# 2. 删渲染 HTML 里的"给食堂的话"行(用正则找到含这个词的 ai-note 行)
m = re.search(r'\s*<div class="ai-note"[^>]*>给食堂的话[^<]*</div>', c)
if m:
    c = c.replace(m.group(0), "", 1)
    n += 1
    print("✅ 给食堂的话渲染已删")
else:
    # 更宽松
    m = re.search(r'<div class="ai-note"[^>]*>给食堂的话[^<]*</div>', c)
    if m:
        c = c.replace(m.group(0), "", 1)
        n += 1
        print("✅ 给食堂的话渲染已删(宽松)")
    else:
        print("⚠️ 给食堂的话渲染未找到")

# 3. 删 renderReview 里 replyTo 相关的 trend/给食堂 引用(如果有)
# 4. 绑定返回按钮
old_close = "    $('#dr-close').onclick = () => { drawer.hidden = true; };"
if old_close in c and "$('#dr-back')" not in c:
    new_close = old_close + "\n    $('#dr-back').onclick = () => { drawer.hidden = true; };"
    c = c.replace(old_close, new_close, 1)
    n += 1
    print("✅ 返回按钮绑定")

open(p, "w", encoding="utf-8", newline="\n").write(c)
print("完成,", n, "处修改")

# 语法检查
import ast
