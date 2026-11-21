# -*- coding: utf-8 -*-
import sys, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
for f in ["rank", "dine"]:
    req = urllib.request.Request("https://zhishi-cau-ifmv.zai.site/js/" + f + ".js?v=27",
                                 headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
    js = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", errors="replace")
    print(f, "| kwSearch:", "kwSearch" in js, "| kwMatch:", "kwMatch" in js, "| 长度:", len(js))
