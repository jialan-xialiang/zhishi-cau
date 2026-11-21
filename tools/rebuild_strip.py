# -*- coding: utf-8 -*-
"""重建 make_public_repo.py 的 STRIP 清单"""
import sys, re
sys.stdout.reconfigure(encoding="utf-8")
p = r"D:\大学\农客松\tools\make_public_repo.py"
lines = open(p, encoding="utf-8").read().split("\n")
# 找 STRIP = (...) 块的起止
start = end = None
for i, l in enumerate(lines):
    if l.startswith("    STRIP = ("):
        start = i
    elif start is not None and l.strip().endswith(")"):
        end = i
        break
assert start is not None, "STRIP块未找到"
print("原块行", start + 1, "到", end + 1)
strip_items = [
    "app/ant_key.txt", "app/_data", "app/js/deploy_key.js",
    "tools/nutri_progress", "tools/api_probe.txt", "tools/menu_raw.txt",
    "tools/check_quota_and_405.py", "tools/run_gen_deepseek.cmd",
    "tools/test_ds41.py", "tools/test_dstext.py", "tools/test_dsvision.py",
    "tools/scan_leak.py", "tools/inspect_batch30.py", "tools/inspect_gen.py",
    "tools/fix_admin_token.py", "tools/peek_settings.py", "tools/peek_agg.py",
    "tools/peek_bind.py", "tools/peek_chips.py", "tools/peek_deldiary.py",
    "tools/peek_dine_dup.py", "tools/peek_tabbar.py", "tools/fix_line265.py",
    "tools/fix_quotes2.py", "tools/fix_quotes3.py", "tools/fix_quotes4.py",
    "tools/fix_paren.py", "tools/patch_delegate1.py", "tools/patch_poll.py",
    "tools/patch_reply_score.py", "tools/patch_clear_local.py",
    "tools/add_clear_btn.py", "tools/batch_fix_v29.py", "tools/retheme.py",
    "tools/retheme2.py", "tools/retheme3.py", "tools/retheme4.py",
    "tools/strip_emoji.py", "tools/apply_new_css.py", "tools/fix_rank_html.py",
    "tools/fix_logo.py", "tools/restore_symbols.py", "tools/patch_insight.py",
    "tools/fix_deploy.py", "tools/verify_deploy_cmd.py",
    "tools/check_deploy_cmd.py", "tools/expand_strip.py",
    "tools/fix_quotes.py", "tools/fix_quotes_final.py",
    "tools/fix_admin_token.py", "tools/verify_v33.py", "tools/fix_v33.py",
    "tools/patch_v33_batch.py", "tools/patch_v33_batch2.py",
    "tools/patch_v33_full.py", "tools/clear_and_check.py", "tools/fix_admin.py",
]
block = "    STRIP = (\n" + "".join(f'        "{item}",\n' for item in strip_items) + "    )"
lines[start:end + 1] = [block]
open(p, "w", encoding="utf-8", newline="\n").write("\n".join(lines))
print("✅ STRIP清单重建完成")
# 语法验证
import ast
ast.parse(open(p, encoding="utf-8").read())
print("✅ make_public_repo.py 语法OK")
