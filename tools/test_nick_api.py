# -*- coding: utf-8 -*-
"""验证昵称注册接口: 注册/查重/改名同步"""
import sys, json, urllib.request, urllib.error
sys.stdout.reconfigure(encoding="utf-8")
B = "http://localhost:3000"

def post(p, body):
    req = urllib.request.Request(B + p, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

# 1. A注册昵称
print("A注册:", post("/api/nick", {"uid": "utestA", "nick": "测试同学甲"}))
# 2. B注册同名 → 应拒绝
st, j = post("/api/nick", {"uid": "utestB", "nick": "测试同学甲"})
print("B同名注册(应409):", st, j)
# 3. B换个名
print("B改名:", post("/api/nick", {"uid": "utestB", "nick": "测试同学乙"}))
# 4. A改名(释放旧名)
print("A改名:", post("/api/nick", {"uid": "utestA", "nick": "甲总"}))
# 5. B现在可以用"测试同学甲"了(已被A释放)
print("B捡起旧名:", post("/api/nick", {"uid": "utestB", "nick": "测试同学甲"}))
# 6. 查映射
req = urllib.request.Request(B + "/api/nicks")
print("映射表:", json.loads(urllib.request.urlopen(req, timeout=20).read()))
