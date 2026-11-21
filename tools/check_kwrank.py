# -*- coding: utf-8 -*-
import sys, urllib.request
sys.stdout.reconfigure(encoding="utf-8")
for f in ["rank", "main", "dine"]:
    req = urllib.request.Request("https://zhishi-cau-ifmv.zai.site/js/" + f + ".js?v=99",
                                 headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
    js = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", errors="replace")
    marks = []
    if "kwRank" in js: marks.append("kwRank排序")
    if f == "rank" and "bayes" in js: marks.append("贝叶斯")
    if f == "rank" and "/api/nick" in js: marks.append("昵称注册")
    if f == "dine" and "pickCafeteria" in js: marks.append("单食堂约束")
    if f == "main" and "snap-hint" in js: marks.append("补充说明栏")
    print(f, "->", " | ".join(marks))
