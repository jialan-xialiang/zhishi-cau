# -*- coding: utf-8 -*-
"""修复: 清除HTML中所有反斜杠污染 + 统一版本号 + 修theme-color"""
import sys, re
sys.stdout.reconfigure(encoding="utf-8")
p = r"D:\大学\农客松\app\index.html"
h = open(p, encoding="utf-8-sig").read()
print("修复前含\\:", "\\?" in h or "\\v" in h)

# 1. 清除所有 \?v=N → ?v=N (去掉反斜杠) 并统一 v=38
h = re.sub(r"\\?\?v=\d+", "?v=38", h)
# 2. theme-color 修正
h = h.replace('content="#1f9d55"', 'content="#ff6b2c"')
# 3. 确认无残留
print("修复后:")
print("  反斜杠:", "\\?" in h)
print("  版本号:", re.findall(r"\?v=(\d+)", h))
print("  theme-color:", re.findall(r'theme-color" content="([^"]+)"', h))
print("  css链接:", re.findall(r'style\.css[^"]*', h))

open(p, "w", encoding="utf-8-sig", newline="").write(h)
print("✅ index.html 修复完成")
