# -*- coding: utf-8 -*-
"""删'给食堂的话'渲染行(精确匹配当前实际文本)"""
import sys
sys.stdout.reconfigure(encoding="utf-8")
p = r"D:\大学\农客松\app\js\rank.js"
c = open(p, encoding="utf-8").read()
old = '''        <div class="ai-note" style="border-color:#7fd0a0;background:#f2fbf5;color:#256b43;margin-top:.4rem"> 给食堂的话:${esc(j.trend || '')}</div>`;'''
new = "`;"
if old in c:
    c = c.replace(old, new, 1)
    open(p, "w", encoding="utf-8", newline="\n").write(c)
    print("✅ 给食堂的话渲染已删")
else:
    print("❌ 仍未匹配")
