# -*- coding: utf-8 -*-
"""测试各 AI 平台的 CORS 支持(浏览器直连可行性)。仅标准库,无需 key。"""
import sys, urllib.request, urllib.error

TARGETS = [
    ("蚂蚁MaaS", "https://maas-api.antdigital.com/v1/chat/completions"),
    ("智谱GLM", "https://open.bigmodel.cn/api/paas/v4/chat/completions"),
    ("DeepSeek官方", "https://api.deepseek.com/chat/completions"),
    ("SiliconFlow", "https://api.siliconflow.cn/v1/chat/completions"),
    ("月之暗面Moonshot", "https://api.moonshot.cn/v1/chat/completions"),
    ("阿里百炼", "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"),
]

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    for name, url in TARGETS:
        req = urllib.request.Request(url, method="OPTIONS", headers={
            "Origin": "https://example-demo.pages.dev",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization, content-type",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126",
        })
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                st, hd = r.status, dict(r.headers)
        except urllib.error.HTTPError as e:
            st, hd = e.code, dict(e.headers)
        except Exception as e:
            print(f"[{name}] EXC: {str(e)[:80]}")
            continue
        acao = hd.get("Access-Control-Allow-Origin") or hd.get("access-control-allow-origin")
        acam = hd.get("Access-Control-Allow-Methods") or hd.get("access-control-allow-methods")
        acah = hd.get("Access-Control-Allow-Headers") or hd.get("access-control-allow-headers")
        verdict = "✅ 支持浏览器直连" if acao else "❌ 不支持CORS"
        print(f"[{name}] status={st} ACAO={acao} methods={acam} headers={acah}  -> {verdict}")

if __name__ == "__main__":
    main()
