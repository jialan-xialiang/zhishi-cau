# -*- coding: utf-8 -*-
"""打包"可公开提交"的代码仓库副本:剥离密钥/本地数据/进度缓存。
用法: python -I make_public_repo.py [输出目录,默认 D:\\大学\\农客松_公开版]
之后把输出目录 git init + push 即可作为比赛代码仓库(私密提交也可用)。"""
import sys, os, shutil, re

SRC = r"D:\大学\农客松"

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    dst = sys.argv[1] if len(sys.argv) > 1 else SRC + "_公开版"
    if os.path.exists(dst):
        shutil.rmtree(dst)
    os.makedirs(dst)
    # 复制 app/ tools/ docs/ README .gitignore
    for item in ("app", "tools", "docs", "README.md", ".gitignore"):
        s = os.path.join(SRC, item)
        d = os.path.join(dst, item)
        if os.path.isfile(s):
            shutil.copy2(s, d)
        elif os.path.isdir(s):
            shutil.copytree(s, d)
    # 剥离敏感与本地数据
    removed = []
    STRIP = (
        "app/ant_key.txt",
        "app/_data",
        "app/js/deploy_key.js",
        "tools/nutri_progress",
        "tools/api_probe.txt",
        "tools/menu_raw.txt",
        "tools/check_quota_and_405.py",
        "tools/run_gen_deepseek.cmd",
        "tools/test_ds41.py",
        "tools/test_dstext.py",
        "tools/test_dsvision.py",
        "tools/scan_leak.py",
        "tools/inspect_batch30.py",
        "tools/inspect_gen.py",
        "tools/fix_admin_token.py",
        "tools/peek_settings.py",
        "tools/peek_agg.py",
        "tools/peek_bind.py",
        "tools/peek_chips.py",
        "tools/peek_deldiary.py",
        "tools/peek_dine_dup.py",
        "tools/peek_tabbar.py",
        "tools/fix_line265.py",
        "tools/fix_quotes2.py",
        "tools/fix_quotes3.py",
        "tools/fix_quotes4.py",
        "tools/fix_paren.py",
        "tools/patch_delegate1.py",
        "tools/patch_poll.py",
        "tools/patch_reply_score.py",
        "tools/patch_clear_local.py",
        "tools/add_clear_btn.py",
        "tools/batch_fix_v29.py",
        "tools/retheme.py",
        "tools/retheme2.py",
        "tools/retheme3.py",
        "tools/retheme4.py",
        "tools/strip_emoji.py",
        "tools/apply_new_css.py",
        "tools/fix_rank_html.py",
        "tools/fix_logo.py",
        "tools/restore_symbols.py",
        "tools/patch_insight.py",
        "tools/fix_deploy.py",
        "tools/verify_deploy_cmd.py",
        "tools/check_deploy_cmd.py",
        "tools/expand_strip.py",
        "tools/fix_quotes.py",
        "tools/fix_quotes_final.py",
        "tools/fix_admin_token.py",
        "tools/verify_v33.py",
        "tools/fix_v33.py",
        "tools/patch_v33_batch.py",
        "tools/patch_v33_batch2.py",
        "tools/patch_v33_full.py",
        "tools/clear_and_check.py",
        "tools/fix_admin.py",
    )
    for rel in STRIP:
        p = os.path.join(dst, rel)
        if os.path.isfile(p):
            os.remove(p); removed.append(rel)
        elif os.path.isdir(p):
            shutil.rmtree(p); removed.append(rel)
    # 兜底扫描: 复制后仍有密钥特征的文件一律删除
    for dp, dn, fn in os.walk(dst):
        for f in fn:
            p = os.path.join(dp, f)
            if f.endswith((".png", ".jpg")):
                continue
            try:
                c = open(p, encoding="utf-8", errors="ignore").read()
                if "sk-" in c and ("api" in c.lower() or "key" in c.lower() or "Bearer" in c):
                    # 占位提示(如 sk-...)不算泄漏: 只删含真实长密钥模式的
                    if re.search(r"sk-[A-Za-z0-9]{20,}", c):
                        os.remove(p); removed.append(os.path.relpath(p, dst))
            except Exception:
                pass
    # 占位文件提示
    open(os.path.join(dst, "app", "ant_key.txt"), "w", encoding="utf-8").write("把你的蚂蚁MaaS API Key 放在这个文件(不要提交到公开仓库)\n")
    open(os.path.join(dst, "SECRET_NOTE.md"), "w", encoding="utf-8").write(
        "# 密钥安全\n\n本副本已剥离所有密钥与本地数据(剥离清单见下)。\n"
        "运行前请自行在 app/ant_key.txt 放入你的蚂蚁百灵 Key,或在设置面板填直连 Key。\n\n已剥离: "
        + ", ".join(removed) + "\n")
    total = sum(len(f) for _, _, f in os.walk(dst))
    print("公开版已生成:", dst, f"({total} 个文件)")
    print("已剥离:", ", ".join(removed))
    print("下一步: cd 到该目录 → git init → git add . → git commit → 推送到 GitHub/Gitee(可设为私密仓库)")

if __name__ == "__main__":
    main()
