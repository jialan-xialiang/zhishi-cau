# -*- coding: utf-8 -*-
import sys, json, re
sys.stdout.reconfigure(encoding="utf-8")
data_js = open(r"D:\大学\农客松\app\js\data.js", encoding="utf-8").read()
dishes = json.loads(re.search(r"const DISHES=(\[.*?\]);\n", data_js, re.S).group(1))

d = next((x for x in dishes if x["name"] == "红烧牛肉面"), None)
print("红烧牛肉面:", json.dumps(d, ensure_ascii=False, indent=1)[:600] if d else "不在库中!")

# 公三的全部含'面'的菜
g3 = [x["name"] for x in dishes if any(w["caf"] == "公三" for w in x["where"]) and "牛肉面" in x["name"]]
print("公三的牛肉面类:", g3)

# 原文公三区块里的红烧牛肉面确认
raw = open(r"D:\大学\农客松\tools\menu_raw.txt", encoding="utf-8").read()
idx = raw.find("红烧牛肉面")
while idx >= 0:
    seg = raw[max(0, idx - 400):idx]
    caf = "未知"
    for key in ["公三", "公二", "公一", "公四", "颐二", "颐三", "和园", "公四·风味", "风味"]:
        p = seg.rfind(key)
        if p >= 0 and p > len(seg) - 380: caf = key
    print(f"原文出现: ...{raw[max(0,idx-30):idx+10]}...  最近食堂标记: {caf}")
    idx = raw.find("红烧牛肉面", idx + 1)
