# -*- coding: utf-8 -*-
"""菜品库覆盖率核对: 手册原文 → 解析JSON → 前端data.js 三层对照"""
import sys, json, re
sys.stdout.reconfigure(encoding="utf-8")

# 1. 从原始文本提取全部【】菜名
raw = open(r"D:\大学\农客松\tools\menu_raw.txt", encoding="utf-8").read()
raw_names = re.findall(r"【([^】]*)】", raw)
raw_clean = []
for n in raw_names:
    n = n.strip()
    if n in ("", "素食类", "肉类"):
        continue
    if n.startswith("或自选"):
        for x in re.split(r"[，,]", n.replace("或自选：", "").replace("或自选:", "")):
            if x.strip(): raw_clean.append(x.strip())
    elif "，" in n:
        raw_clean.extend([x.strip() for x in n.split("，") if x.strip()])
    else:
        raw_clean.append(n)
print("原文【】条目:", len(raw_names), "→ 拆分清洗后:", len(raw_clean))

# 2. 解析JSON(items)
parsed = json.load(open(r"D:\大学\农客松\tools\menu_parsed.json", encoding="utf-8"))
parsed_names = set(i["name"] for i in parsed["items"])
print("解析后条目:", len(parsed["items"]), "唯一菜名:", len(parsed_names))

# 3. data.js 中的菜名集合
data_js = open(r"D:\大学\农客松\app\js\data.js", encoding="utf-8").read()
m = re.search(r"const DISHES=(\[.*?\]);\n", data_js, re.S)
dishes = json.loads(m.group(1))
dish_names = set(d["name"] for d in dishes)
print("data.js 菜品数:", len(dishes))

# 4. 原文每样菜是否都能在库里找到
missing = [n for n in dict.fromkeys(raw_clean) if n not in dish_names]
print("\n原文菜名(去重)", len(dict.fromkeys(raw_clean)), "个,其中在库中:", len(dict.fromkeys(raw_clean)) - len(missing))
if missing:
    print("❌ 未入库", len(missing), "个:")
    for x in missing: print("   -", x)
else:
    print("✅ 原文所有菜品 100% 已入库")

# 5. 抽查用户可能关心的菜
spot = ["馋嘴牛蛙", "裸奔烤冷面", "亚麻子馕", "锅仔关东煮", "石锅金枪鱼拌饭", "椰子鸡单人套餐", "超级夏威夷披萨", "佛跳墙", "芝士拉丝棒", "小龙虾"]
hit = [(s, s in dish_names) for s in spot]
print("\n抽查:", ", ".join(f"{s}{'✓' if h else '✗'}" for s, h in hit))

# 6. 食堂分组说明
cafs = {}
for i in parsed["items"]:
    cafs.setdefault(i["caf"], set()).add(i["name"])
print("\n食堂分组与菜数:")
for caf, names in cafs.items():
    print(f"   {caf}: {len(names)} 道")
