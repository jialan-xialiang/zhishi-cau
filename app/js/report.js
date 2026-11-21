/* ═══ 知食 · 健康周报 + AI 阿姨聊天 ═══ */
const REPORT = {
  renderToday() {
    const items = STORE.todayDiary();
    const target = STORE.GOAL_MEAL[STORE.profile.goal] || 700;
    const sum = items.reduce((s, x) => s + (x.kcal || 0), 0);
    $('#diary-today').innerHTML = (items.length ? items.map(x => `<div class="diary-item">
      <span class="di-meal">${x.meal}</span>
      <span class="di-name">${esc(x.name)}</span>
      <span class="di-kcal">${Math.round(x.kcal || 0)} kcal</span>
      <button class="di-del" data-id="${x.id}">✕</button>
    </div>`).join('') : '<div class="empty-hint">今天还没有记录 · 点上方「手动添加」去菜单勾选,或去「识菜」拍照</div>')
      + (items.length ? `<div class="combo-sum" style="margin-top:.4rem"><span>今日已 ${Math.round(sum)} kcal</span><span>蛋白质 ${fix(items.reduce((s, x) => s + (x.protein || 0), 0))}g</span><span>钠 ${Math.round(items.reduce((s, x) => s + (x.sodium || 0), 0))}mg</span></div>` : '');
    // 周热力(点击格子查看/编辑当天记录)
    const wk = STORE.weekDiary();
    const selDate = this._selDay || todayStr();
    $('#week-grid').innerHTML = wk.map(d => {
      const kc = d.items.reduce((s, x) => s + (x.kcal || 0), 0);
      const lvl = !d.items.length ? (d.future ? 'future' : '') : kc > 1400 ? 'l3' : kc > 800 ? 'l2' : 'l1';
      const n = d.items.length;
      const sel = d.date === selDate ? ' sel' : '';
      return `<div class="wg-cell${sel}" data-day="${d.date}" style="cursor:pointer">${d.label}<div class="wg-dot ${lvl}${sel}" title="${d.date} ${n}项 ${Math.round(kc)}kcal ${d.future ? '(未到)' : '点击查看'}">${d.future ? '·' : (n || '·')}</div></div>`;
    }).join('');
    $$('#week-grid .wg-cell').forEach(c => c.onclick = () => { this._selDay = c.dataset.day; this.renderToday(); });
    // 选中日详情
    const selItems = STORE.diary[selDate] || [];
    const selSum = selItems.reduce((s, x) => s + (x.kcal || 0), 0);
    const dayLabel = wk.find(d => d.date === selDate);
    const isFuture = dayLabel ? dayLabel.future : false;
    $('#day-detail').innerHTML = `
      <div class="card-title" style="margin:.5rem 0 .2rem"> ${selDate} (周${dayLabel ? dayLabel.label : ''}) · ${Math.round(selSum)} kcal</div>
      ${selItems.length ? selItems.map(x => `<div class="diary-item">
        <span class="di-meal">${x.meal}</span>
        <span class="di-name">${esc(x.name)}</span>
        <span class="di-kcal">${Math.round(x.kcal || 0)} kcal</span>
        <button class="di-del" data-day="${selDate}" data-id="${x.id}">✕</button>
      </div>`).join('') : '<div class="empty-hint">这一天还没有记录,可在下方添加</div>'}
      <div class="day-add-row" style="display:flex;gap:.4rem;margin-top:.5rem">
        <select id="day-add-meal" style="width:auto;flex-shrink:0">
          <option value="早">早</option><option value="午" selected>午</option><option value="晚">晚</option><option value="夜宵">夜宵</option>
        </select>
        <input id="day-add-name" type="text" placeholder="输入菜名,如:红烧牛肉面" style="flex:1">
        <button class="btn" id="day-add-btn" style="flex-shrink:0;padding:.5rem .7rem">＋添加</button>
      </div>
      <div id="day-add-sug" class="menu-list" style="max-height:150px;margin-top:.4rem;position:relative" hidden></div>`;
    // 添加记录: 关键词搜索选实体写入该日
    const mealSel = $('#day-add-meal'), nameInput = $('#day-add-name'), sug = $('#day-add-sug');
    nameInput.oninput = () => {
      const q = (nameInput.value || '').trim();
      if (!q) { sug.hidden = true; return; }
      const hits = kwSearch(DISHES, q, 8);
      sug.hidden = !hits.length;
      sug.innerHTML = hits.map(d => `<div class="menu-item" data-id="${d.id}" data-name="${esc(d.name)}">
        <div class="mi-name">${esc(d.name)}<small> ${d.where.map(w => w.caf).join('/')} · ${d.kcal}kcal</small></div>
        <button class="mi-add">＋</button></div>`).join('') || `<div class="empty-hint">没找到「${esc(q)}」</div>`;
      $$('#day-add-sug .menu-item').forEach(it => it.onclick = () => {
        const d = DISH_BY_ID[it.dataset.id];
        if (!d) return;
        if (!STORE.diary[selDate]) STORE.diary[selDate] = [];
        STORE.diary[selDate].push({ id: Math.random().toString(36).slice(2, 9), date: selDate, meal: mealSel.value,
          name: d.name, dishId: d.id, kcal: d.kcal, protein: d.protein, fat: d.fat, carb: d.carb, sodium: d.sodium, veg: d.veg });
        STORE._save('diary', STORE.diary);
        nameInput.value = ''; sug.hidden = true;
        this.renderToday(); APP.renderTodayChart();
        toast('已添加到 ' + selDate + ' ' + mealSel.value + '餐');
      });
    };
    // 点添加按钮: 若输入框文字精确匹配某菜名, 直接添加
    $('#day-add-btn').onclick = () => {
      const q = (nameInput.value || '').trim();
      if (!q) return toast('输入菜名或从建议中选');
      const d = DISH_BY_NAME[q] ? DISH_BY_ID[DISH_BY_NAME[q][0]] : null;
      if (!d) return toast('没找到这道菜,从建议列表中选');
      if (!STORE.diary[selDate]) STORE.diary[selDate] = [];
      STORE.diary[selDate].push({ id: Math.random().toString(36).slice(2, 9), date: selDate, meal: mealSel.value,
        name: d.name, dishId: d.id, kcal: d.kcal, protein: d.protein, fat: d.fat, carb: d.carb, sodium: d.sodium, veg: d.veg });
      STORE._save('diary', STORE.diary);
      nameInput.value = ''; sug.hidden = true;
      this.renderToday(); APP.renderTodayChart();
      toast(' 已添加');
    };
  },
  bind() {
    // 事件委托: 删除饮食记录(今日卡+任意日详情通用, 重渲染免疫)
    const self = this;
    document.addEventListener('click', e => {
      const del = e.target.closest('.di-del');
      if (!del) return;
      STORE.delDiary(del.dataset.day || todayStr(), del.dataset.id);
      self.renderToday(); APP.renderTodayChart();
    });
    $('#diary-add-btn').onclick = () => { document.querySelector('[data-tab="dine"]').click(); toast('在下方菜单里点「＋」记一餐'); window.scrollTo({ top: 600 }); };
    $('#btn-gen-report').onclick = () => this.gen();
    // 每日目标热量: 自定义数值, 周报评估与首页「今日摄入」共用
    const paintTarget = () => {
      const badge = $('#target-kcal-badge');
      if (badge) badge.textContent = '当前:' + STORE.targetKcal() + ' kcal';
      const inp = $('#target-kcal-input');
      if (inp && document.activeElement !== inp) inp.value = STORE.profile.targetKcal || '';
    };
    paintTarget();
    $('#target-kcal-save').onclick = () => {
      const v = ($('#target-kcal-input').value || '').trim();
      if (!v) { delete STORE.profile.targetKcal; STORE.setProfile(STORE.profile); paintTarget(); APP.renderTodayChart(); toast('已恢复按健康目标自动计算'); return; }
      const n = Math.round(+v);
      if (!(n >= 800 && n <= 5000)) return toast('请输入 800–5000 之间的数值');
      STORE.profile.targetKcal = n;
      STORE.setProfile(STORE.profile);
      paintTarget();
      APP.renderTodayChart();
      toast('每日目标热量已设为 ' + n + ' kcal,周报与首页同步更新');
    };
  },
  async gen() {
    const box = $('#report-result');
    const wk = STORE.weekDiary();
    const days = wk.filter(d => d.items.length);
    if (!days.length) { toast('先记录(或载入演示数据)再来生成报告哦'); return; }
    showLoading('AI 正在分析你这一周的饮食…');
    const prof = STORE.profile;
    const targetD = STORE.targetKcal();
    // 统计
    const st = { days: days.length, kcalAvg: 0, pAvg: 0, fAvg: 0, naAvg: 0, vegAvg: 0, aRate: 0, variety: new Set(), meals: [] };
    days.forEach(d => {
      st.kcalAvg += d.items.reduce((s, x) => s + (x.kcal || 0), 0) / days.length;
      st.pAvg += d.items.reduce((s, x) => s + (x.protein || 0), 0) / days.length;
      st.fAvg += d.items.reduce((s, x) => s + (x.fat || 0), 0) / days.length;
      st.naAvg += d.items.reduce((s, x) => s + (x.sodium || 0), 0) / days.length;
      st.vegAvg += d.items.reduce((s, x) => s + (x.veg || 0), 0) / days.length;
      d.items.forEach(x => {
        st.variety.add(x.name);
        const dish = x.dishId ? DISH_BY_ID[x.dishId] : null;
        if (dish && dish.grade === 'A') st.aRate++;
        st.meals.push(`${d.label}:${x.name}`);
      });
    });
    st.aRate = Math.round(st.aRate / Math.max(1, st.meals.length) * 100);
    const score = Math.max(35, Math.min(97, Math.round(
      50
      + (Math.abs(st.kcalAvg - targetD) / targetD < 0.12 ? 18 : Math.abs(st.kcalAvg - targetD) / targetD < 0.25 ? 8 : -6)
      + Math.min(14, st.pAvg * 0.7)
      + Math.min(10, st.vegAvg * 3.5)
      - (st.naAvg > 3800 ? 12 : st.naAvg > 3000 ? 6 : 0)
      + (st.aRate > 40 ? 8 : st.aRate > 25 ? 4 : 0)
      + Math.min(5, st.variety.size * 0.3)
    )));
    // 图表
    const kcalPts = wk.map(d => ({ label: d.label, v: Math.round(d.items.reduce((s, x) => s + (x.kcal || 0), 0)) }));
    box.innerHTML = `
      <div class="rp-sec"><h4> 一周热量走势(kcal)</h4><canvas id="rp-kcal"></canvas></div>
      <div class="rp-sec"><h4> 日均营养摄入</h4>
        <canvas id="rp-macro"></canvas>
        <div class="combo-sum" style="margin-top:.5rem">
          <span>蛋白质 ${st.pAvg.toFixed(0)}g/日</span><span>脂肪 ${st.fAvg.toFixed(0)}g/日</span>
          <span>钠 ${st.naAvg.toFixed(0)}mg/日</span><span>蔬菜份量 ${st.vegAvg.toFixed(1)}/日</span>
          <span>吃过 ${st.variety.size} 种菜</span><span>A级菜占比 ${st.aRate}%</span>
        </div>
      </div>
      <div class="rp-sec"><h4> 营养均衡度雷达</h4><div class="radar-wrap"><canvas id="rp-radar"></canvas></div></div>
      <div class="rp-sec" id="rp-ai"><div class="skeleton">AI 正在撰写专属报告…</div></div>`;
    CHARTS.line($('#rp-kcal'), kcalPts);
    CHARTS.bars($('#rp-macro'), [
      { label: '蛋白质', v: st.pAvg / 90 * 100, color: st.pAvg >= 55 ? '#e8503a' : '#e67e22', show: st.pAvg.toFixed(0) + 'g' },
      { label: '脂肪', v: st.fAvg / 100 * 100, color: st.fAvg > 100 ? '#e05252' : '#d9a013', show: st.fAvg.toFixed(0) + 'g' },
      { label: '碳水', v: Math.max(0, st.kcalAvg * 0.5 / 4) / 350 * 100, color: '#d9a013', show: (st.kcalAvg * 0.5 / 4).toFixed(0) + 'g' },
      { label: '钠(盐)', v: st.naAvg / 5000 * 100, color: st.naAvg > 3800 ? '#e05252' : st.naAvg > 3000 ? '#e67e22' : '#e8503a', show: (st.naAvg / 1000).toFixed(1) + 'g' },
      { label: '蔬菜份', v: st.vegAvg / 3 * 100, color: st.vegAvg >= 2 ? '#e8503a' : '#e67e22', show: st.vegAvg.toFixed(1) + '份' },
    ]);
    CHARTS.radar($('#rp-radar'), [
      { label: '热量达标', v: Math.max(10, 100 - Math.abs(st.kcalAvg - targetD) / targetD * 160) },
      { label: '蛋白质', v: Math.min(100, st.pAvg * 5) },
      { label: '清淡度', v: Math.max(10, 100 - st.naAvg / 42) },
      { label: '蔬菜纤维', v: Math.min(100, st.vegAvg * 32) },
      { label: '食材多样', v: Math.min(100, st.variety.size * 9) },
      { label: '优质选择', v: Math.min(100, st.aRate * 2.2) },
    ]);
    // AI 报告
    try {
      const j = await API.chatJSON([
        { role: 'system', content: '你是营养师,写一份温暖有梗的大学生饮食周报,中文口语化,不要说教腔。输出JSON。' },
        { role: 'user', content: `学生目标:${prof.goal},忌口:${prof.allergies.join('、') || '无'}。
数据:记录${st.days}天,日均${st.kcalAvg.toFixed(0)}kcal(目标${targetD}),蛋白质${st.pAvg.toFixed(0)}g,钠${st.naAvg.toFixed(0)}mg,蔬菜${st.vegAvg.toFixed(1)}份,吃过${st.variety.size}种菜,A级菜占比${st.aRate}%。
这周吃了:${st.meals.slice(0, 22).join(';')}。
输出:{"headline":"一句话总评≤18字","good":["做得好的一面,2条,各≤28字"],"bad":["需要注意的,2条,各≤28字"],"advice":["下周行动建议,3条,各≤34字,要具体到食堂菜品"],"praise":"一句幽默的表扬≤22字"}` },
      ], { maxTokens: 900, temperature: 0.7 });
      const badges = [];
      if (st.vegAvg >= 2) badges.push(' 蔬菜达人');
      if (st.naAvg <= 2000) badges.push(' 控盐先锋');
      if (st.variety.size >= 18) badges.push(' 干饭探险家');
      if (st.aRate >= 35) badges.push(' 优选食客');
      if (score >= 80) badges.push(' 健康卷王');
      $('#rp-ai').outerHTML = `<div class="rp-sec"><h4> ${esc(j.headline || '本周报告')}</h4>
        <div class="rp-text"> 做得好:\n· ${(j.good || []).map(esc).join('\n· ')}\n\n 注意:\n· ${(j.bad || []).map(esc).join('\n· ')}\n\n 下周这样吃:\n· ${(j.advice || []).map(esc).join('\n· ')}\n\n${esc(j.praise || '')}</div>
        ${badges.length ? `<div class="rp-badges">${badges.map(b => `<span class="rp-badge">${b}</span>`).join('')}</div>` : ''}</div>`;
    } catch (e) {
      $('#rp-ai').outerHTML = `<div class="rp-sec"><h4> 本周小结</h4><div class="rp-text">日均摄入 ${st.kcalAvg.toFixed(0)} kcal(目标 ${targetD}),蛋白质 ${st.pAvg.toFixed(0)}g/日。${st.naAvg > 2000 ? '钠摄入偏高,少选麻辣香锅和卤味。' : '盐分控制不错!'}${st.vegAvg < 2 ? '蔬菜偏少,每天加一份清炒时蔬。' : '蔬菜吃够了,继续保持!'}记住:一日三餐规律吃,比任何补剂都强。</div></div>`;
    }
    hideLoading();
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
};

/* ── AI 阿姨聊天上下文 ── */
const CHAT = {
  mem: [],
  history(q) {
    // 动态检索:问题里提到的菜/食堂  注入精简上下文(省token)
    const hits = [];
    if (q && q.length >= 2) {
      for (const d of DISHES) {
        if (q.includes(d.name) || d.name.includes(q)) { hits.push(`${d.name}(${d.kcal}kcal P${d.protein} F${d.fat} 钠${d.sodium} ${(d.tags || []).join('/')} @${d.where[0] ? d.where[0].caf : ''})`); if (hits.length >= 14) break; }
      }
      for (const caf of Object.keys(CAMPUS_OF)) {
        if (q.includes(caf.replace('（', '').replace('）', '').slice(0, 2))) {
          const ds = DISHES.filter(d => d.where.some(w => w.caf === caf));
          const top = ds.slice().sort((a, b) => (a.grade === 'A' ? -1 : 1) - (b.grade === 'A' ? -1 : 1)).slice(0, 14);
          hits.push(`【${caf}菜单节选】` + top.map(d => d.name).join('、'));
        }
      }
    }
    const prof = STORE.profile;
    const today = STORE.todayDiary().map(x => x.meal + ':' + x.name).join(',') || '还没记录';
    const sys = `你是"阿姨小知",中国农业大学食堂的AI营养阿姨:亲切幽默,懂营养,熟悉全校9食堂近1900道菜(数据库内)。学生档案:目标${prof.goal},忌口/过敏:${prof.allergies.join('、') || '无'}。今日已吃:${today}。${hits.length ? '\n相关菜品数据:\n' + hits.join('\n') : ''}
回答规则:①口语化,≤180字,可用1-2个emoji ②推荐菜必须用真实菜名并带上食堂 ③涉及过敏务必提醒 ④不知道就说不知道,别编造。`;
    const msgs = [{ role: 'system', content: sys }];
    this.mem.slice(-6).forEach(m => msgs.push(m));
    msgs.push({ role: 'user', content: q });
    return msgs;
  },
  remember(q, a) {
    this.mem.push({ role: 'user', content: q }, { role: 'assistant', content: (a || '').slice(0, 400) });
    if (this.mem.length > 12) this.mem = this.mem.slice(-12);
  },
};

/* 启动 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => APP.boot());
} else {
  APP.boot();
}
