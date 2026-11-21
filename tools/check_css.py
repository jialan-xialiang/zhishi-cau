# -*- coding: utf-8 -*-
import sys, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
req = urllib.request.Request("https://zhishi-cau-ifmv.zai.site/css/style.css?v=38",
                             headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
css = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", errors="replace")
print("长度:", len(css))
print("开头300:", css[:300])
print("...")
print("结尾200:", css[-200:])
# 大括号配对
print("左括号:", css.count("{"), "右括号:", css.count("}"))
# 检查是否是二进制/损坏
non_print = sum(1 for ch in css[:500] if ord(ch) > 127 and ch not in "，。：；！？·—…""''（）《》【】")
print("前500字符非ASCII非中文:", non_print)
