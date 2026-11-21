# -*- coding: utf-8 -*-
"""快速测试候选模型可用性/输出格式。仅标准库。"""
import sys, json, time, urllib.request, urllib.error

BASE = "https://maas-api.antdigital.com/v1"
KEY = sys.argv[1]

def chat(model, messages, max_tokens=600, temperature=0.2):
    body = {"model": model, "messages": messages, "max_tokens": max_tokens,
            "temperature": temperature}
    req = urllib.request.Request(BASE + "/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + KEY},
        method="POST")
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            dt = time.time() - t0
            d = json.loads(r.read())
            msg = d["choices"][0]["message"]
            return True, dt, msg.get("content", ""), msg.get("finish_reason") or d["choices"][0].get("finish_reason"), d.get("usage", {})
    except urllib.error.HTTPError as e:
        return False, time.time() - t0, e.read()[:200].decode(errors="replace"), "HTTP%d" % e.code, {}
    except Exception as e:
        return False, time.time() - t0, str(e)[:200], "ERR", {}

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    models = ["ling-3.2-flash", "deepseek-v4.1-flash-1017", "glm-5.3-flash", "qwen3.8-flash",
              "minimax-m3.1-flash", "deepseek-flash", "ling-3.1-flash", "kimi-k3"]
    prompt = [{"role": "system", "content": "你是营养数据库生成器。只输出JSON,不要输出任何解释或markdown代码块以外的内容。"},
              {"role": "user", "content": '为以下食堂菜品估算营养(一份的量)。输出JSON数组,每项字段: name, cat(荤菜/素菜/主食/面点/汤粥/小吃甜点/饮品/食材), kcal, protein, fat, carb, sodium(mg), price(食堂估算价,元,数字), tags(数组,从[辣,油炸,高油,高糖,清淡,高蛋白,蒸,卤,凉菜,烧烤,素食,奶香,海鲜]中选), allergens(数组,从[蛋,奶,花生,坚果,海鲜,大豆,麸质]选,无则[]), grade(A/B/C/D), desc(一句话≤15字)。\n菜品: ["宫保鸡丁", "蒜蓉油麦菜", "小米粥"]\n只输出JSON数组。'}]
    for m in models:
        ok, dt, content, fin, usage = chat(m, prompt)
        status = "OK " if ok else "FAIL"
        tail = ""
        if ok:
            tail = content[-160:].replace("\n", " ")
            # 简单验证 JSON 可解析
            try:
                s = content.strip()
                if s.startswith("```"):
                    s = s.split("```")[1].replace("json", "", 1)
                arr = json.loads(s)
                tail += f"  <JSON验证:{len(arr)}项>"
            except Exception as e:
                tail += f"  <JSON解析失败:{str(e)[:60]}>"
        print(f"[{status}] {m}  {dt:.1f}s  finish={fin}  usage={usage.get('total_tokens')}  tail: {tail}")

if __name__ == "__main__":
    main()
