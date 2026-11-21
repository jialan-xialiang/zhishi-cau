# -*- coding: utf-8 -*-
"""把「小火锅」加入研二(风味)菜单库: AI估算营养 → 写入数据源 → 重建data.js"""
import sys, json, time, socket, urllib.request, urllib.error
sys.stdout.reconfigure(encoding="utf-8")
socket.setdefaulttimeout(90)
KEY = sys.argv[1]
BASE = "https://maas-api.antdigital.com/v1"

NAME = "小火锅"
CAF = "研二（风味）"
WIN = "小火锅窗口"

# 1. AI 估算营养
body = {"model": "deepseek-v4.1-flash-1017",
        "messages": [{"role": "system", "content": "你是营养师,只输出JSON。"},
                     {"role": "user", "content": '估算食堂「小火锅」一份的营养(锅底+常见涮菜:丸子/午餐肉/豆腐/青菜/粉丝等,一人份)。按公开膳食数据。输出JSON:{"cat":"荤菜","kcal":数字,"protein":克,"fat":克,"carb":克,"sodium":毫克,"fiber":克,"veg":0-3,"tags":["辣"或"清淡"等],"allergens":[],"grade":"A/B/C/D","desc":"≤16字"}'}],
        "max_tokens": 2500, "temperature": 0.2}
nutri = None
for attempt in range(4):
    model = ["deepseek-v4.1-flash-1017", "deepseek-flash", "qwen3.8-flash", "ling-3.2-flash"][attempt % 4]
    req = urllib.request.Request(BASE + "/chat/completions", data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + KEY}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            d = json.loads(r.read())
        m = d["choices"][0]["message"]
        txt = (m.get("content") or m.get("reasoning_content", "")[-600:])
        i, j = txt.find("{"), txt.rfind("}")
        nutri = json.loads(txt[i:j + 1])
        print(f"✅ 营养估算成功(模型:{model}):", json.dumps(nutri, ensure_ascii=False)[:200])
        break
    except urllib.error.HTTPError as e:
        print(f"attempt{attempt} {model} HTTP{e.code},等待重试", flush=True)
        time.sleep(12 + attempt * 8)
    except Exception as e:
        print(f"attempt{attempt} {model}: {str(e)[:80]}", flush=True)
        time.sleep(6)
if not nutri:
    print("❌ 估算失败"); sys.exit(1)

# 2. 写入营养progress(build会读取)
prog_path = r"D:\大学\农客松\tools\nutri_progress\batch_901_custom.json"
json.dump({NAME: nutri}, open(prog_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# 3. 加入 menu_parsed.json
mp = json.load(open(r"D:\大学\农客松\tools\menu_parsed.json", encoding="utf-8"))
if not any(i["name"] == NAME and i["caf"] == CAF for i in mp["items"]):
    mp["items"].append({"campus": "东校区", "caf": CAF, "win": WIN, "name": NAME})
    if NAME not in mp["unique_names"]:
        mp["unique_names"].append(NAME)
    json.dump(mp, open(r"D:\大学\农客松\tools\menu_parsed.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("menu_parsed.json 已加入小火锅条目")

# 4. 重建 data.js
import subprocess
r = subprocess.run(["python", "-I", r"D:\大学\农客松\tools\build_data.py",
                    r"D:\大学\农客松\tools\menu_parsed.json",
                    r"D:\大学\农客松\tools\nutri_progress",
                    r"D:\大学\农客松\app\js\data.js"], capture_output=True, text=True, encoding="utf-8")
print(r.stdout[-500:])

# 5. 验证
js = open(r"D:\大学\农客松\app\js\data.js", encoding="utf-8").read()
i = js.find("const DISHES="); j = js.find("const DISH_MAP")
dishes = json.loads(js[i + 13:j].rstrip().rstrip(";"))
hp = next((x for x in dishes if x["name"] == NAME), None)
print("data.js 中的小火锅:", json.dumps(hp, ensure_ascii=False)[:300] if hp else "❌ 未找到")
print("总菜数:", len(dishes))
