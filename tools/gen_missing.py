# -*- coding: utf-8 -*-
"""补齐缺失营养的菜(从data.js找出无营养项,单批送AI,写回progress)"""
import sys, json, os, time, random, socket, urllib.request, urllib.error
sys.stdout.reconfigure(encoding="utf-8")
socket.setdefaulttimeout(60)

BASE = "https://maas-api.antdigital.com/v1"
KEY = sys.argv[1]

data_js = open(r"D:\大学\农客松\app\js\data.js", encoding="utf-8").read()
i = data_js.find("const DISHES="); j = data_js.find("const DISH_MAP")
dishes = json.loads(data_js[i + len("const DISHES="):j].rstrip().rstrip(";"))
# 无营养判定: fiber/veg/kcal 等于类别兜底且在 missing 清单里——直接用 build 的 missing 逻辑: 重新对比 nutri_progress
prog = {}
for f in os.listdir(r"D:\大学\农客松\tools\nutri_progress"):
    if f.startswith("batch_"):
        try: prog.update(json.load(open(r"D:\大学\农客松\tools\nutri_progress" + "\\" + f, encoding="utf-8")))
        except Exception: pass
menu = json.load(open(r"D:\大学\农客松\tools\menu_parsed.json", encoding="utf-8"))
missing = [n for n in menu["unique_names"] if n not in prog]
print("缺失营养的菜:", len(missing), missing[:8], flush=True)

SYS = "你是食堂菜品营养数据库生成器。严格只输出一个JSON数组,不要markdown,不要解释。"
USER = """对下列 {n} 个中国农业大学食堂菜品,按"食堂一份常规份量"估算营养。输出JSON数组,顺序与输入一致,菜名原样。每项: name, cat(荤菜/素菜/主食/面点/汤粥/小吃甜点/饮品/食材), kcal, protein, fat, carb, sodium, fiber(0-10), veg(0-3), tags(从[辣,微辣,油炸,高油,高糖,清淡,高蛋白,蒸,卤,凉菜,酸辣,烧烤,素食,奶香,海鲜,带汤]选0-3), allergens(从[蛋,奶,花生,坚果,海鲜,大豆,麸质]选,无则[]), grade(A/B/C/D), desc(≤16字)。
菜品: {names}
只输出JSON数组。"""

def call(model, names):
    body = {"model": model, "messages": [{"role": "system", "content": SYS},
            {"role": "user", "content": USER.format(n=len(names), names=json.dumps(names, ensure_ascii=False))}],
            "max_tokens": 6000, "temperature": 0.15}
    req = urllib.request.Request(BASE + "/chat/completions", data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + KEY}, method="POST")
    with urllib.request.urlopen(req, timeout=180) as r:
        d = json.loads(r.read())
    return d["choices"][0]["message"].get("content", "")

def parse(content, names):
    s = content.strip()
    i, j = s.find("["), s.rfind("]")
    if i < 0 or j <= i: raise ValueError("no json")
    arr = json.loads(s[i:j + 1])
    out = {}
    for want in names:
        for it in arr:
            if isinstance(it, dict) and str(it.get("name", "")).strip().replace(" ", "") == want.replace(" ", ""):
                out[want] = it; break
    return out

for attempt in range(6):
    model = ["deepseek-v4.1-flash-1017", "deepseek-flash", "qwen3.8-flash"][attempt % 3]
    try:
        c = call(model, missing)
        got = parse(c, missing)
        if got:
            fn = os.path.join(r"D:\大学\农客松\tools\nutri_progress", "batch_900_missing.json")
            json.dump(got, open(fn, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print(f"✅ 补齐 {len(got)}/{len(missing)} 道 (模型:{model}), 已写入 batch_900_missing.json")
            break
    except urllib.error.HTTPError as e:
        print(f"attempt{attempt} {model} HTTP{e.code} -> 等待", flush=True)
        time.sleep(10 + attempt * 10)
    except Exception as e:
        print(f"attempt{attempt} {model}: {str(e)[:80]}", flush=True)
        time.sleep(8)
else:
    print("❌ 仍有失败,稍后再试")
