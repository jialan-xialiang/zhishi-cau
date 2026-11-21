# -*- coding: utf-8 -*-
import sys, json, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
req = urllib.request.Request("https://zhishi-cau-ifmv.zai.site/js/data.js?v=18",
                             headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
js = urllib.request.urlopen(req, timeout=30).read().decode("utf-8")
i = js.find("const DISHES="); j = js.find("const DISH_MAP")
dishes = json.loads(js[i + 13:j].rstrip().rstrip(";"))
hp = next((x for x in dishes if x["name"] == "小火锅"), None)
print("公网小火锅:", json.dumps(hp, ensure_ascii=False)[:250] if hp else "❌ 未找到")
print("公网总菜数:", len(dishes))
