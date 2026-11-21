# -*- coding: utf-8 -*-
import sys, json, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
req = urllib.request.Request("https://zhishi-cau-ifmv.zai.site/js/data.js?v=16",
                             headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
js = urllib.request.urlopen(req, timeout=30).read().decode("utf-8")
i = js.find("const DISHES="); j = js.find("const DISH_MAP")
dishes = json.loads(js[i + 13:j].rstrip().rstrip(";"))
k = js.find("const CAMPUS_OF="); l = js.find(";", k)
campus_of = json.loads(js[k + 16:l])
feng = [d for d in dishes if any(w["caf"] == "风味（研二）" for w in d["where"])]
g4 = [d for d in dishes if any(w["caf"] == "公四" for w in d["where"])]
print("CAMPUS_OF 食堂数:", len(campus_of), "| 含风味:", "风味（研二）" in campus_of)
print("风味(研二)菜数:", len(feng), "| 公四剩:", len(g4))
print("风味窗口:", sorted(set(w["win"] for d in feng for w in d["where"] if w["caf"] == "风味（研二）"))[:8])
print("风味搜'锅':", [d["name"] for d in dishes if "锅" in d["name"] and any(w["caf"] == "风味（研二）" for w in d["where"])][:8])
