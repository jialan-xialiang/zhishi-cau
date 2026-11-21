# -*- coding: utf-8 -*-
"""v10 验收: 无hint vs 带hint 识别对比"""
import sys, json, base64, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
BASE = "https://zhishi-cau-ifmv.zai.site"
IMG = r"D:\wechat\xwechat_files\wxid_blbs3r93fdlj22_da31\temp\RWTemp\2026-11\9e20f478899dc29eb19741386f9343c8\dd0c4417e12088532f666564b74962dc.jpg"
b64 = base64.b64encode(open(IMG, "rb").read()).decode()

PROMPT = ('食堂就餐照片识别任务。请只关注照片中的食物本身,完全忽略筷子、盘子、桌面、手和背景。'
          '{hint}'
          '用大白话描述每个食物(如:金黄酥脆的炸鸡排、一小碗白米饭、几颗小番茄),估计克数,按公开膳食数据算总营养。'
          '直接输出最终JSON(双引号,不要长篇推理):{"foods":[{"food":"食物的通俗描述","g":克数}],"kcal":总热量数字,"protein":克,"fat":克,"carb":克,"sodium":毫克,"tags":["辣"或"清淡"],"desc":"15字内点评"}')

for label, hint in [("无补充说明", ""), ("带补充说明:炸鸡排配小番茄和鱼丸", "用户补充说明:「炸鸡排配小番茄和鱼丸」——这是用户的可信提示,优先按它判断食物种类。")]:
    body = {"image": "data:image/jpeg;base64," + b64,
            "prompt": PROMPT.replace("{hint}", hint), "max_tokens": 4000}
    req = urllib.request.Request(BASE + "/api/vision", data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=240) as r:
        d = json.loads(r.read())
    m = d["choices"][0]["message"]
    content = m.get("content") or ""
    print(f"== {label} ==")
    print("  ", content[:220].replace("\n", " "))
    print()
