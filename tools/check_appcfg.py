# -*- coding: utf-8 -*-
import urllib.request, sys
sys.stdout.reconfigure(encoding="utf-8")
B = "https://zhishi-cau-ifmv.zai.site"
for p in ["/js/appcfg.js?v=3", "/js/main.js?v=3", "/index.html", "/js/config.js"]:
    try:
        r = urllib.request.urlopen(urllib.request.Request(B + p, headers={"User-Agent": "Mozilla/5.0"}), timeout=20)
        body = r.read()
        print(p, "->", r.status, len(body), "字节", body[:50].decode(errors="replace").replace("\n", " ")[:40])
    except Exception as e:
        print(p, "->", str(e)[:60], getattr(e, "code", ""))
