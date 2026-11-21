# -*- coding: utf-8 -*-
"""营养库锚点校验: 用营养学常识基准核对 AI 生成值,输出偏差报告(并可自动修正)。
用法: python -I verify_nutrition.py <nutri_progress目录> [--fix]
锚点基准为《中国食物成分表》常见值的食堂份量近似,允许 ±40% 合理波动。"""
import sys, json, os, glob

# 菜名关键词 -> (kcal, protein, fat, carb, sodium_mg) 食堂一份的合理基准
ANCHORS = [
    ('米饭', (240, 6, 1, 52, 8)),
    ('馒头', (235, 7, 1, 47, 160)),
    ('小米粥', (120, 3, 1.2, 24, 60)),
    ('皮蛋瘦肉粥', (250, 9, 5, 38, 480)),
    ('宫保鸡丁', (330, 21, 19, 16, 780)),
    ('红烧肉', (520, 14, 44, 9, 720)),
    ('西红柿炒鸡蛋', (210, 9, 14, 10, 520)),
    ('西红柿鸡蛋', (210, 9, 14, 10, 520)),
    ('西红柿鸡蛋盖饭', (450, 12, 15, 55, 550)),
    ('西红柿炒鸡蛋盖饭', (460, 12, 15, 58, 560)),
    ('黄焖鸡米饭', (580, 25, 18, 65, 950)),
    ('清炒油麦菜', (100, 2, 7, 5, 380)),
    ('香菇油菜', (110, 3, 7, 6, 420)),
    ('麻婆豆腐', (250, 13, 16, 10, 880)),
    ('红烧牛肉面', (600, 25, 18, 72, 1100)),
    ('牛肉面', (560, 24, 16, 70, 1000)),
    ('茶叶蛋', (88, 7, 5.5, 1, 420)),
    ('豆浆', (105, 7, 4, 9, 25)),
    ('水煮肉片', (450, 25, 31, 8, 1150)),
    ('鱼香肉丝', (290, 14, 18, 15, 860)),
    ('清蒸鱼块', (200, 25, 8, 2, 480)),
    ('蛋炒饭', (560, 12, 18, 76, 640)),
    ('酸辣粉', (450, 8, 14, 66, 1200)),
    ('麻辣香锅', (720, 26, 46, 32, 1300)),
    ('烤鸭', (480, 22, 34, 8, 760)),
    ('炸鸡排', (460, 28, 27, 18, 620)),
    # 盖饭/炒饭/面类 = 菜 + 主食(米饭/面条 ≈230-280 kcal)
    ('宫保鸡丁盖饭', (570, 24, 22, 62, 800)),
    ('红烧肉炒饭', (760, 17, 40, 88, 700)),
    ('西红柿鸡蛋面', (480, 16, 14, 66, 840)),
    ('鱼香肉丝盖饭', (530, 17, 21, 60, 860)),
    ('鱼香肉丝炒饭', (530, 14, 20, 72, 700)),
]

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    prog = sys.argv[1]
    fix = '--fix' in sys.argv
    nutri = {}
    for f in sorted(glob.glob(os.path.join(prog, 'batch_*.json'))):
        try: nutri.update(json.load(open(f, encoding='utf-8')))
        except Exception: pass
    print('载入 AI 营养条目:', len(nutri))
    problems, fixed, used = [], 0, set()
    # 长键优先,避免"宫保鸡丁"误匹配"宫保鸡丁盖饭"
    for key, base in sorted(ANCHORS, key=lambda x: -len(x[0])):
        exact = [n for n in nutri if n == key]
        hits = exact or [n for n in nutri if key in n and n not in used]
        if not hits:
            print(f'  [缺] {key}: 库中未生成(可能尚未跑到)')
            continue
        for name in hits[:3]:
            used.add(name)
            n = nutri[name]
            dk = n.get('kcal') or 0
            lo, hi = base[0] * 0.6, base[0] * 1.45
            if not (lo <= dk <= hi):
                problems.append((name, dk, base[0]))
                if fix:
                    n['kcal'] = base[0]; n['protein'] = base[1]; n['fat'] = base[2]
                    n['carb'] = base[3]; n['sodium'] = base[4]
                    n['grade'] = 'C' if base[0] >= 450 else ('B' if base[0] >= 300 else 'A')
                    fixed += 1
    print()
    if problems:
        print(f'偏差超±40%的锚点菜 {len(problems)} 个:')
        for name, dk, base in problems:
            print(f'  {name}: AI={dk} vs 基准≈{base}')
        if fix:
            for f in sorted(glob.glob(os.path.join(prog, 'batch_*.json'))):
                data = json.load(open(f, encoding='utf-8'))
                ch = False
                for k in data:
                    for name, dk, base in problems:
                        if k == name and data[k].get('kcal') == dk:
                            n = nutri[name]
                            data[k].update({x: n[x] for x in ('kcal', 'protein', 'fat', 'carb', 'sodium', 'grade')})
                            ch = True
                if ch:
                    json.dump(data, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            print(f'已修正 {fixed} 条(写回批次文件)')
    else:
        print('全部锚点菜在 ±40% 合理区间内 ✔')
    # 抽样统计整体分布合理性
    kcals = [n.get('kcal') for n in nutri.values() if isinstance(n.get('kcal'), (int, float))]
    if kcals:
        import statistics
        print(f'库内热量分布: 中位数 {statistics.median(kcals):.0f} kcal, 均值 {statistics.mean(kcals):.0f}, 最大 {max(kcals):.0f}')
        weird = [k for k, v in nutri.items() if isinstance(v.get('kcal'), (int, float)) and (v['kcal'] <= 5 or v['kcal'] > 1600)]
        if weird:
            print('离谱值(≤5或>1600 kcal):', weird[:20])

if __name__ == '__main__':
    main()
