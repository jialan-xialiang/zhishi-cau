# -*- coding: utf-8 -*-
"""合成 app/js/data.js v2: 每个菜名×食堂×窗口 = 独立菜品实体(口碑/评价独立)。
营养按菜名共享(同一道菜在哪做营养相近), 锚点校验不受影响。"""
import sys, json, os, glob, hashlib

def guess_cat(name):
    if any(k in name for k in ['粥', '汤', '羹', '豆浆', '脑', '醪糟', '银耳']):
        return '汤粥'
    if any(k in name for k in ['奶茶', '果粒', '茶', '露', '奶昔', '咖啡']):
        return '饮品'
    if any(k in name for k in ['面', '粉', '饭', '盖', '焗', '煲', '馄饨', '水饺', '饺子']):
        return '主食'
    if any(k in name for k in ['包', '饼', '馒头', '花卷', '糕', '粽', '酥', '麻花', '卷', '烧', '汉堡', '三明治', '吐司', '蛋挞', '披萨']):
        return '面点'
    if any(k in name for k in ['串', '丸', '薯', '鸡柳', '鸡米花', '肠']):
        return '小吃甜点'
    return '荤菜'

def fallback(cat):
    return {
        '荤菜': dict(kcal=320, protein=18, fat=22, carb=12, sodium=780, fiber=1, veg=1),
        '素菜': dict(kcal=110, protein=4, fat=6, carb=10, sodium=420, fiber=2.5, veg=2.5),
        '主食': dict(kcal=420, protein=11, fat=9, carb=72, sodium=380, fiber=1.5, veg=0),
        '面点': dict(kcal=340, protein=9, fat=12, carb=48, sodium=340, fiber=1, veg=0),
        '汤粥': dict(kcal=150, protein=6, fat=4, carb=20, sodium=320, fiber=1, veg=1),
        '小吃甜点': dict(kcal=300, protein=8, fat=15, carb=30, sodium=450, fiber=1, veg=0),
        '饮品': dict(kcal=180, protein=3, fat=4, carb=28, sodium=60, fiber=0, veg=0),
        '食材': dict(kcal=80, protein=4, fat=3, carb=9, sodium=180, fiber=2, veg=2),
    }[cat]

def grade_of(n):
    kcal, na, fat = n['kcal'], n['sodium'], n['fat']
    if kcal <= 280 and na <= 650 and fat <= 12: return 'A'
    if kcal <= 450 and na <= 900: return 'B'
    if kcal <= 620 or na <= 1200: return 'C'
    return 'D'

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    menu_path, prog_dir, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    menu = json.load(open(menu_path, encoding='utf-8'))

    nutri = {}
    for f in sorted(glob.glob(os.path.join(prog_dir, 'batch_*.json'))):
        try: nutri.update(json.load(open(f, encoding='utf-8')))
        except Exception as e: print('skip bad batch', f, e)
    print('营养条目:', len(nutri))

    def caf_display(campus, caf):
        # 学生口径: 公四不改名(即研一), 风味=研二(风味), 东区清真称"清真", 西清真为供餐点
        if caf == '风味（研二）': return '研二（风味）'
        if caf == '清真': return ('西·清真' if campus == '西校区' else '清真')
        return caf

    dishes, by_name = [], {}
    for idx, it in enumerate(menu['items']):
        name = it['name']
        caf = caf_display(it['campus'], it['caf'])
        win = it['win']
        n = nutri.get(name)
        cat = (n.get('cat') if n else None) or guess_cat(name)
        if n:
            rec = dict(kcal=n.get('kcal'), protein=n.get('protein'), fat=n.get('fat'),
                       carb=n.get('carb'), sodium=n.get('sodium'), fiber=n.get('fiber'), veg=n.get('veg'))
            fb = fallback(cat)
            clean = {}
            for k, v in rec.items():
                if isinstance(v, (int, float)) and (v > 0 or k == 'veg'):
                    clean[k] = v
                else:
                    clean[k] = fb[k]
            tags = (n.get('tags') or [])[:4]
            allerg = n.get('allergens') or []
            grade = n.get('grade') if n.get('grade') in ('A', 'B', 'C', 'D') else grade_of(clean)
        else:
            clean = fallback(cat); tags, allerg = [], []
            grade = grade_of(clean)
        key = hashlib.md5((name + '|' + caf + '|' + win).encode()).hexdigest()[:10]
        did = 'd' + key
        obj = {'id': did, 'name': name, 'cat': cat, **clean,
               'tags': tags, 'allergens': allerg, 'grade': grade,
               'where': [{'caf': caf, 'win': win}], 'key': name + '|' + caf}
        dishes.append(obj)
        by_name.setdefault(name, []).append(obj)

    campus_of = {}
    for it in menu['items']:
        campus_of[caf_display(it['campus'], it['caf'])] = it['campus']

    name_index = {name: [d['id'] for d in lst] for name, lst in by_name.items()}

    js = ('/* 知食菜品数据库 v2 · 菜名×食堂×窗口=独立实体(口碑独立), 营养按菜名共享 */\n'
          'const DISHES=' + json.dumps(dishes, ensure_ascii=False, separators=(',', ':')) + ';\n'
          'const DISH_BY_ID={};DISHES.forEach(d=>DISH_BY_ID[d.id]=d);\n'
          'const DISH_BY_NAME=' + json.dumps(name_index, ensure_ascii=False, separators=(',', ':')) + ';\n'
          'const CAMPUS_OF=' + json.dumps(campus_of, ensure_ascii=False) + ';\n')
    open(out_path, 'w', encoding='utf-8').write(js)
    print('条目实体:', len(dishes), '| 唯一菜名:', len(by_name), '| 食堂:', len(campus_of))
    print('无营养兜底:', sum(1 for d in dishes if not nutri.get(d['name'])), '道')
    print('saved:', out_path, os.path.getsize(out_path), 'bytes')

if __name__ == '__main__':
    main()
