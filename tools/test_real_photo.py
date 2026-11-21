# -*- coding: utf-8 -*-
"""用用户的真实食堂照片实测公网 /api/vision,定位失败原因"""
import sys, json, base64, urllib.request, urllib.error, os
sys.stdout.reconfigure(encoding="utf-8")

IMG = r"D:\wechat\xwechat_files\wxid_blbs3r93fdlj22_da31\temp\RWTemp\2026-11\9e20f478899dc29eb19741386f9343c8\dd0c4417e12088532f666564b74962dc.jpg"
raw = open(IMG, "rb").read()
print("原图大小:", len(raw), "bytes =", round(len(raw)/1024), "KB")

b64 = base64.b64encode(raw).decode()
print("base64后:", len(b64), "chars =", round(len(b64)/1024), "KB")

body = {"image": "data:image/jpeg;base64," + b64,
        "prompt": '看这张图片,直接说出你看到的食物(不要猜测具体菜名,不要对应任何菜单),按公开膳食数据快速估算营养。要求:不要长篇推理,直接输出最终JSON(双引号):{"name":"看到的食物简述(≤14字)","items":[{"food":"食材","g":克数估算}],"kcal":总热量数字,"protein":克,"fat":克,"carb":克,"sodium":毫克,"tags":["辣"或"清淡"],"desc":"15字内点评,模糊处注明估算"}',
        "max_tokens": 4000}

for host in ["https://zhishi-cau-ifmv.zai.site", "http://localhost:3000"]:
    print("\n===== 测试", host, "=====")
    try:
        req = urllib.request.Request(host + "/api/vision", data=json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
        t0 = __import__("time").time()
        with urllib.request.urlopen(req, timeout=240) as r:
            d = json.loads(r.read())
        dt = __import__("time").time() - t0
        m = d["choices"][0]["message"]
        content = m.get("content") or ""
        reasoning = m.get("reasoning_content") or ""
        print(f"耗时 {dt:.0f}s | content长度={len(content)} | reasoning长度={len(reasoning)} | finish={d['choices'][0].get('finish_reason')}")
        print("content:", content[:200].replace("\n", " "))
        if not content and reasoning:
            print("reasoning尾部:", reasoning[-200:].replace("\n", " "))
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, ":", e.read()[:300].decode(errors="replace"))
    except Exception as e:
        print("FAIL:", str(e)[:150])
