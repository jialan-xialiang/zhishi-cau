# -*- coding: utf-8 -*-
"""批量生成菜品营养数据库。断点续传:每批写入 tools/nutri_progress/batch_NNN.json
用法: python -I gen_nutrition.py <api_key> <menu_parsed.json> <progress_dir>
"""
import sys, json, os, time, socket, urllib.request, urllib.error, random

socket.setdefaulttimeout(45)  # 硬超时兜底:防止慢速连接无限挂起

# 可用环境变量切换平台: GEN_BASE(默认蚂蚁) / GEN_MODEL(默认蚂蚁主力) / GEN_KEY_MODE(0=用ANT参数key)
BASE = os.environ.get('GEN_BASE', 'https://maas-api.antdigital.com/v1')

BASE = "https://maas-api.antdigital.com/v1"
MODELS = ["deepseek-v4.1-flash-1017", "deepseek-flash", "qwen3.8-flash", "deepseek-v4-pro-0813"]
BATCH = 18
MAXTOK = 5000

SYS = "你是食堂菜品营养数据库生成器。严格只输出一个JSON数组,不要markdown代码块,不要任何解释文字。JSON必须使用双引号。"
USER_TMPL = """对下列 {n} 个中国农业大学食堂菜品,按"食堂一份常规份量"估算营养数据。输出JSON数组,顺序与输入一致,菜名必须原样使用,不得增删。
每项字段:
- name: 菜名(原样)
- cat: 类别,从[荤菜,素菜,主食,面点,汤粥,小吃甜点,饮品,食材]选(麻辣烫/香锅的自选食材用"食材")
- kcal: 千卡(数字)  protein: 克  fat: 克  carb: 克  sodium: 毫克  fiber: 克(0-10)  veg: 蔬菜份量(0-3,数字,纯蔬菜2-3,有配菜1,几乎没有0)
- price: 农大食堂常见价格,元,数字(素菜2-6,荤菜5-14,主食1-6,汤粥2-5,小吃3-10,饮品2-8)
- tags: 从[辣,微辣,油炸,高油,高糖,清淡,高蛋白,蒸,卤,凉菜,酸辣,烧烤,素食,奶香,海鲜,带汤]选0-3个,数组
- allergens: 从[蛋,奶,花生,坚果,海鲜,大豆,麸质]选,没有则空数组
- grade: A(推荐均衡)/B(适量)/C(油盐糖偏高注意)/D(高油高盐油炸少选),综合评估单字符
- desc: 一句话点评,不超过16个字
菜品清单: {names}
只输出JSON数组。"""

def call(model, key, names, timeout=120):
    body = {"model": model,
            "messages": [{"role": "system", "content": SYS},
                         {"role": "user", "content": USER_TMPL.format(n=len(names), names=json.dumps(names, ensure_ascii=False))}],
            "max_tokens": MAXTOK, "temperature": 0.15}
    req = urllib.request.Request(BASE + "/chat/completions", data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key}, method="POST")

    with urllib.request.urlopen(req, timeout=timeout) as r:
        d = json.loads(r.read())
    msg = d["choices"][0]["message"]
    return msg.get("content", "")

def parse_json(content, names):
    s = content.strip()
    if s.startswith("```"):
        s = s.strip("`")
        if s.startswith("json"):
            s = s[4:]
    i, j = s.find("["), s.rfind("]")
    if i < 0 or j <= i:
        raise ValueError("no json array")
    arr = json.loads(s[i:j + 1])
    out, missing = {}, []
    for want in names:
        hit = None
        for it in arr:
            if not isinstance(it, dict) or "name" not in it:
                continue
            got = str(it.get("name", "")).strip()
            if got == want or got.replace(" ", "") == want.replace(" ", ""):
                hit = it; break
        if hit is None:
            missing.append(want)
        else:
            out[want] = hit
    return out, missing

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    flags = [a for a in sys.argv[1:] if a.startswith('--')]
    key, menu_path, prog_dir = args[0], args[1], args[2]
    # --base=<url> --model=<name> 命令行参数优先于环境变量
    for f in flags:
        if f.startswith('--base='):
            globals()['BASE'] = f.split('=', 1)[1]
        if f.startswith('--model='):
            globals()['_MODEL_OPT'] = f.split('=', 1)[1]
    model_opt = globals().get('_MODEL_OPT', '') or os.environ.get('GEN_MODEL', '')
    models = [model_opt] if model_opt else MODELS
    print("平台:", BASE, "| 模型:", models, flush=True)
    os.makedirs(prog_dir, exist_ok=True)
    names = json.load(open(menu_path, encoding="utf-8"))["unique_names"]
    print("total unique:", len(names), "| 平台:", BASE, "| 模型:", models, flush=True)
    batches = [names[i:i + BATCH] for i in range(0, len(names), BATCH)]
    print("batches:", len(batches), flush=True)
    fails = []
    t_start = time.time()
    for bi, chunk in enumerate(batches):
        pfile = os.path.join(prog_dir, "batch_%03d.json" % bi)
        if os.path.exists(pfile):
            continue
        got, attempt = None, 0
        while attempt < 6 and got is None:
            attempt += 1
            model = models[(bi + attempt - 1) % len(models)]
            try:
                content = call(model, key, chunk)
                res, missing = parse_json(content, chunk)
                if missing:
                    # 一次补漏
                    try:
                        time.sleep(1.5)
                        c2 = call(model, key, missing)
                        r2, m2 = parse_json(c2, missing)
                        res.update(r2)
                        for x in m2:
                            fails.append(x)
                    except Exception:
                        for x in missing:
                            fails.append(x)
                got = res
            except urllib.error.HTTPError as e:
                wait = 8 + attempt * 7 + random.random() * 3
                print(f"  batch {bi} HTTP{e.code} {model} -> wait {wait:.0f}s (attempt {attempt})", flush=True)
                time.sleep(wait)
            except Exception as e:
                print(f"  batch {bi} err {model}: {str(e)[:90]} -> retry", flush=True)
                time.sleep(4)
        if got is None:
            fails.extend(chunk)
            json.dump({}, open(pfile, "w", encoding="utf-8"), ensure_ascii=False)
            print(f"batch {bi} FAILED entirely", flush=True)
            continue
        json.dump(got, open(pfile, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        done = len([f for f in os.listdir(prog_dir) if f.startswith("batch_")])
        print(f"batch {bi+1}/{len(batches)} done ({len(got)} dishes) elapsed={time.time()-t_start:.0f}s", flush=True)
        time.sleep(1.2)
    print("ALL DONE. fails:", len(fails), flush=True)
    if fails:
        json.dump(sorted(set(fails)), open(os.path.join(prog_dir, "_fails.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("fail list:", sorted(set(fails))[:50], flush=True)

if __name__ == "__main__":
    main()
