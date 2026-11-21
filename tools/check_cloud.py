# -*- coding: utf-8 -*-
import sys, json, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
B = "https://zhishi-cau-ifmv.zai.site"
req = urllib.request.Request(B + "/api/reviews", headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
d = json.loads(urllib.request.urlopen(req, timeout=30).read())
print("云端评价数:", d.get("count"))
for r in (d.get("reviews") or []):
    print("  -", (r.get("dish") or "")[:14], "|", (r.get("text") or "")[:22], "| dishId:", (r.get("dishId") or "(无)")[:14], "| uid:", (r.get("uid") or "")[:10])
req2 = urllib.request.Request(B + "/api/nicks", headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
n = json.loads(urllib.request.urlopen(req2, timeout=30).read())
print("昵称表:", len(n.get("nicks", {})), "个")
for nick, uid in n.get("nicks", {}).items():
    print("  ", nick, "->", uid)
