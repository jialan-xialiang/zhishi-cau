# -*- coding: utf-8 -*-
"""全量扫描星级/引号残留 + 删除功能终验"""
import sys, re, json
sys.stdout.reconfigure(encoding="utf-8")
import os
DIR = r"D:\大学\农客松\app\js"
bad = []
for f in os.listdir(DIR):
    if not f.endswith(".js"):
        continue
    c = open(os.path.join(DIR, f), encoding="utf-8").read()
    for m in re.finditer(r"''[★☆]", c):
        line_no = c[:m.start()].count("\n") + 1
        bad.append((f, line_no, c.split("\n")[line_no - 1][:80]))
print("引号残留:", bad if bad else "无 ✅")

# 修正残留(如果有)
for f, ln, _ in bad:
    p = os.path.join(DIR, f)
    lines = open(p, encoding="utf-8").read().split("\n")
    l = lines[ln - 1]
    fixed = re.sub(r"'{1,3}(★|☆)'{0,2}\.repeat", lambda m2: "'" + m2.group(1) + "'.repeat", l)
    lines[ln - 1] = fixed
    open(p, "w", encoding="utf-8", newline="\n").write("\n".join(lines))
    print("fixed", f, ln)
print("扫描完成")
