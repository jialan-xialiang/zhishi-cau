# -*- coding: utf-8 -*-
"""把 menu_raw.txt 解析成结构化 JSON: 校区-食堂-窗口-菜品。"""
import sys, json, re

CAMPUSES = ("西校区", "东校区")
CAFS = {"和园（和一、和二）", "颐一", "颐二", "颐三", "公一", "公二", "公三", "公四"}
SKIP_NAMES = {"素食类", "肉类", ""}
STOP_PREFIX = ("编辑：", "责编：", "Ps:", "小编", "使用时", "快速")

def split_name(n):
    n = n.strip()
    if n in SKIP_NAMES:
        return []
    if n.startswith("或自选"):
        n = n.replace("或自选：", "").replace("或自选:", "")
        return [x.strip() for x in re.split(r"[，,]", n) if x.strip()]
    if "，" in n:
        return [x.strip() for x in n.split("，") if x.strip()]
    return [n]

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    src, dst = sys.argv[1], sys.argv[2]
    lines = [l.strip() for l in open(src, encoding="utf-8").read().splitlines()]
    campus = caf = None
    win = None
    sub_prefix = ""   # 公四下的"风味"子食堂前缀
    items, cafs, windows = [], [], []
    seen_caf, seen_win = set(), set()
    unique, seen_uniq = [], set()

    for line in lines:
        if not line or line.startswith(STOP_PREFIX) or line == "----TABLE-END----":
            continue
        if line in CAMPUSES:
            campus, caf, win, sub_prefix = line, None, None, ""
            continue
        if line in CAFS or line == "清真":
            caf, win, sub_prefix = line, None, ""
            if caf not in seen_caf:
                seen_caf.add(caf)
                cafs.append({"campus": campus, "name": caf})
            continue
        if caf == "公四" and line == "风味":
            # "风味"是独立的风味餐厅(学生俗称"研二"),不归公四
            caf, win, sub_prefix = "风味（研二）", None, ""
            if caf not in seen_caf:
                seen_caf.add(caf)
                cafs.append({"campus": campus, "name": caf})
            continue
        if "【" in line:
            # 行首窗口名前缀(如 "特色菜【...】")
            m = re.match(r"^([^【]+)【", line)
            if m and win is None:
                win = m.group(1).strip()
            if win is None:
                win = "窗口"
            win_full = sub_prefix + win
            wkey = (caf, win_full)
            if wkey not in seen_win:
                seen_win.add(wkey)
                windows.append({"caf": caf, "name": win_full})
            for raw in re.findall(r"【([^】]*)】", line):
                for name in split_name(raw):
                    items.append({"campus": campus, "caf": caf, "win": win_full, "name": name})
                    if name not in seen_uniq:
                        seen_uniq.add(name)
                        unique.append(name)
        else:
            # 窗口行
            if caf == "公四" and line == "风味":
                sub_prefix = "风味·"
                win = None
                continue
            win = line
    # 去掉完全重复项(同窗口同名)保留多食堂归属
    data = {"campuses": ["西校区", "东校区"], "cafs": cafs, "windows": windows,
            "items": items, "unique_names": unique}
    json.dump(data, open(dst, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("items:", len(items), "unique:", len(unique), "cafs:", len(cafs), "windows:", len(windows))
    for c in cafs:
        print("  caf:", c["campus"], "/", c["name"])

if __name__ == "__main__":
    main()
