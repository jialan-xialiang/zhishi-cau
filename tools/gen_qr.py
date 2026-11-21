# -*- coding: utf-8 -*-
"""生成公网链接二维码 PNG(使用 qrserver 免费API下载)"""
import sys, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
url = "https://zhishi-cau-ifmv.zai.site"
api = ("https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=2&color-1-808080&data=" +
       urllib.parse.quote(url))
req = urllib.request.Request(api, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=30) as r:
    data = r.read()
out = r"D:\大学\农客松\docs\知食_公网链接二维码.png"
open(out, "wb").write(data)
print("二维码已保存:", out, len(data), "bytes, 指向", url)
