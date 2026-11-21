# -*- coding: utf-8 -*-
"""部署后验收: 数据保全是否生效"""
import sys, json, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
B = "https://zhishi-cau-ifmv.zai.site"
req = urllib.request.Request(B + "/api/ping", headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
print("ping:", json.loads(urllib.request.urlopen(req, timeout=30).read()))
req = urllib.request.Request(B + "/js/data.js?v=32", headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
js = urllib.request.urlopen(req, timeout=30).read()
i = js.decode("utf-8", errors="replace").find("const DISHES=")
j = js.decode("utf-8", errors="replace").find("const DISH_BY_ID")
n = js.decode("utf-8", errors="replace")[i + 13:j].count('"id"')
print("菜品实体:", n, "| data.js大小:", len(js) // 1024, "KB")
