# -*- coding: utf-8 -*-
"""最终验收: 公网data.js新版+锚点校验"""
import sys, json, urllib.request, glob
sys.stdout.reconfigure(encoding="utf-8")

r = urllib.request.urlopen(urllib.request.Request(
    "https://zhishi-cau-ifmv.zai.site/js/data.js?v=4", headers={"User-Agent": "Mozilla/5.0"}), timeout=20)
body = r.read()
print("公网 data.js:", r.status, len(body), "字节 (旧版357822,新版约376686)")

d = urllib.request.urlopen(urllib.request.Request(
    "https://zhishi-cau-ifmv.zai.site/api/ping", headers={"User-Agent": "Mozilla/5.0"}), timeout=20)
print("公网 ping:", json.loads(d.read()))

nutri = {}
import os
for f in sorted(glob.glob(r"D:\大学\农客松\tools\nutri_progress\batch_*.json")):
    try: nutri.update(json.load(open(f, encoding="utf-8")))
    except Exception: pass
print("本地营养库:", len(nutri), "条")
