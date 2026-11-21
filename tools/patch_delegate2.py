# -*- coding: utf-8 -*-
"""删除按钮改事件委托(根治动态内容丢绑定)"""
import sys
sys.stdout.reconfigure(encoding="utf-8")
p = r"D:\大学\农客松\app\js\report.js"
c = open(p, encoding="utf-8").read()
n = 0

# 1. 删 renderToday 里两处直接绑定
old1 = '''    $$('#diary-today .di-del').forEach(b => b.onclick = () => {
      STORE.delDiary(todayStr(), b.dataset.id); this.renderToday(); APP.renderTodayChart();
    });
'''
if old1 in c:
    c = c.replace(old1, "", 1); n += 1
old2 = '''    $$('#day-detail .di-del').forEach(b => b.onclick = () => {
      STORE.delDiary(b.dataset.day, b.dataset.id); this.renderToday(); APP.renderTodayChart();
    });
'''
if old2 in c:
    c = c.replace(old2, "", 1); n += 1

# 2. bind() 里加事件委托(一次绑定, 重渲染免疫)
old3 = '''  bind() {
    $('#diary-add-btn').onclick'''
new3 = '''  bind() {
    // 事件委托: 删除饮食记录(今日卡+任意日详情通用, 重渲染免疫)
    document.addEventListener('click', e => {
      const del = e.target.closest('.di-del');
      if (!del) return;
      STORE.delDiary(del.dataset.day || todayStr(), del.dataset.id);
      this.renderToday(); APP.renderTodayChart();
    }.bind(this));
    $('#diary-add-btn').onclick'''
if old3 in c:
    c = c.replace(old3, new3, 1); n += 1

open(p, "w", encoding="utf-8", newline="\n").write(c)
print("report.js:", n, "处修改")
