/* ═══ 知食 · 主逻辑(启动/路由/设置/首页/识菜) ═══ */
const APP = {
  boot() {
    STORE.init();
    CFG.load();
    STORE.loadCustom();
    const steps = [this.bindTabs, this.bindSettings, this.bindHome, this.bindSnap,
      () => RANK.bind(), () => RANK.bindReviewSearch(), () => DINE.initMenus(), () => REPORT.bind(), () => REPORT.renderToday(), () => this.renderHome(), () => this.bindAddDish()];
    steps.forEach(f => { try { f.call(this); } catch (e) { console.error('[知食] 启动步骤异常:', e); } });
    RANK.detectServer();
  },

  /* ── 路由 ── */
  bindTabs() {
    const go = tab => {
      $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      $$('.tab-view').forEach(v => v.classList.toggle('active', v.id === 'view-' + tab));
      window.scrollTo({ top: 0 });
      if (tab === 'home') this.renderHome();
      if (tab === 'report') REPORT.renderToday();
    };
    $$('.tab').forEach(t => t.onclick = () => go(t.dataset.tab));
    $$('[data-go]').forEach(q => q.onclick = () => go(q.dataset.go));
  },

  /* ── 设置(隐藏入口: 连点左上角 logo 5 次) ── */
  bindSettings() {
    const modal = $('#settings-modal');
    const open = () => {
      $('#set-mode').value = CFG.get('mode');
      $('#set-base').value = CFG.get('base');
      $('#set-key').value = CFG.get('key');
      $('#set-model').value = CFG.get('model');
      $('#set-vmodel').value = CFG.get('vmodel');
      modal.hidden = false;
    };
    let taps = 0, tapTm = null;
    const brand = $('.topbar-brand');
    if (brand) brand.onclick = () => {
      taps++; clearTimeout(tapTm);
      tapTm = setTimeout(() => { taps = 0; }, 1500);
      if (taps >= 5) { taps = 0; open(); toast(' 已打开设置'); }
    };
    if (location.hash === '#settings') open();
    $('#settings-close').onclick = () => modal.hidden = true;
    $('#set-save').onclick = () => {
      CFG.set('mode', $('#set-mode').value);
      CFG.set('base', $('#set-base').value.trim());
      CFG.set('key', $('#set-key').value.trim());
      CFG.set('model', $('#set-model').value.trim());
      CFG.set('vmodel', $('#set-vmodel').value.trim());
      toast(' 已保存'); modal.hidden = true;
    };
        $('#set-test').onclick = async () => {
      CFG.set('mode', $('#set-mode').value);
      CFG.set('base', $('#set-base').value.trim());
      CFG.set('key', $('#set-key').value.trim());
      CFG.set('model', $('#set-model').value.trim());
      CFG.set('vmodel', $('#set-vmodel').value.trim());
      const r = $('#set-test-result');
      r.textContent = '⏳ 测试中…';
      try {
        const t0 = Date.now();
        const reply = await API.chat([{ role: 'user', content: '只回复:OK' }], { maxTokens: 60, temperature: 0 });
        r.textContent = ` 连通正常 (${((Date.now() - t0) / 1000).toFixed(1)}s) 回复:${reply.trim().slice(0, 20)}`;
      } catch (e) {
        r.textContent = ' 失败: ' + e.message.slice(0, 120);
      }
    };
  },

  /* ── 首页 ── */
  bindHome() {
    $('#home-refresh-rec').onclick = () => { CACHE.set('rec', null); this.renderHome(true); };
  },
  /* 服务端就绪后:若首页推荐还卡在骨架屏,自动重渲染一次 */
  _serverReady() {
    const box = $('#home-recommend');
    if (box && box.querySelector('.skeleton') && !CACHE.get('rec')) this.renderHome(true);
  },

  /* ── 手动添加菜品(众包补全手册,如:颐二小火锅) ── */
  bindAddDish() {
    const modal = $('#add-dish-modal');
    if (!modal) return;
    fillSelect($('#add-caf'), Object.keys(CAMPUS_OF));
    let pendingName = '';
    window.OPEN_ADD_DISH = name => {
      pendingName = name || '';
      $('#add-name').value = pendingName;
      $('#add-dish-status').textContent = '添加后立即可搜索、可评价、计入推荐池。';
      modal.hidden = false;
    };
    $('#add-dish-close').onclick = () => modal.hidden = true;
    /* 共享: AI 估算营养并把新菜加入食谱(识菜弹层与榜单"上传并评价新菜"共用) */
    const estimateAndAdd = async (name, caf, win, st) => {
      if (!name) { toast('先填菜名'); return null; }
      st.textContent = ' AI 正在估算营养…';
      try {
        const j = await API.chatJSON([
          { role: 'system', content: '你是营养师,输出JSON。' },
          { role: 'user', content: `估算食堂菜品「${name}」(食堂:${caf}${win ? '·' + win : ''})一份的营养。按公开膳食数据。输出JSON:{"cat":"荤菜/素菜/主食/面点/汤粥/小吃甜点/饮品","kcal":数字,"protein":克,"fat":克,"carb":克,"sodium":毫克,"fiber":克,"veg":0-3,"tags":["辣"等],"allergens":[],"grade":"A/B/C/D","desc":"≤16字"}` },
        ], { maxTokens: 800, temperature: 0.2 });
        const dish = STORE.addCustomDish(name, caf, win, j);
        toast('「' + name + '」已加入' + caf + '菜单');
        DINE.fillDishSelect();
        RANK.refresh();
        return dish;
      } catch (e) {
        st.textContent = ' 估算失败(' + e.message.slice(0, 50) + '),稍后重试或稍后再添加';
        return null;
      }
    };
    window.ESTIMATE_ADD_DISH = estimateAndAdd;
    $('#add-dish-ai').onclick = async () => {
      const dish = await estimateAndAdd($('#add-name').value.trim(), $('#add-caf').value, $('#add-win').value.trim(), $('#add-dish-status'));
      if (dish) { modal.hidden = true; this.showSnapResult({ matched: dish, source: 'menu' }); }
    };
  },
  async renderHome(force) {
    const d = new Date();
    const h = d.getHours();
    const greet = h < 6 ? '夜深了,注意休息' : h < 10 ? '早上好,吃好早餐很重要' : h < 14 ? '午间到了,想吃点什么' : h < 18 ? '下午好,晚饭怎么吃' : '晚上好,别吃太晚哦';
    $('#home-greet').textContent = greet;
    $('#home-date').textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${'日一二三四五六'[d.getDay()]} · 今日菜单覆盖全校 9 个食堂`;
    this.renderTodayChart();
    // 统计
    const streak = this._streak();
    const cnt = STORE.todayDiary().length;
    const revs = STORE.myReviews().length;
    $('#home-stats').innerHTML = `
      <div class="stat-box"><b>${cnt}</b><span>今日已记 ${cnt} 项</span></div>
      <div class="stat-box"><b>${streak}</b><span>连续记录天数</span></div>
      <div class="stat-box" id="stat-reviews"><b>${revs}</b><span>全站评价</span></div>`;
    // 全站评价数从服务端取(共享模式), 本地模式用本机数
    if (window.__ZHISHI_SERVER) {
      fetch('/api/reviews').then(r => r.json()).then(j => {
        const el = $('#stat-reviews');
        if (el) el.innerHTML = `<b>${j.count}</b><span>全站评价</span>`;
      }).catch(() => {});
    }
    // 食安贴士(本地轮换,不花token)
    const tips = SAFETY_TIPS;
    const day = Math.floor(Date.now() / 86400000) % tips.length;
    $('#home-safety-date').textContent = '每日轮换';
    $('#home-safety').innerHTML = `<div class="ai-note" style="border-color:#7fd0a0;background:#f2fbf5;color:#256b43">${tips[day]}</div>`;
    // 推荐
    const box = $('#home-recommend');
    let recs = force ? null : CACHE.get('rec');
    if (!recs) {
      box.innerHTML = '<div class="skeleton">AI 正在结合今日菜单与你的档案挑选…</div>';
      recs = await this._genRecommend();
      CACHE.set('rec', recs);
    }
    if (box.querySelector('.skeleton') || force) {
      box.innerHTML = recs.map((r, i) => `<div class="rec-dish">
        <div class="rec-emoji">${r.emoji || ''}</div>
        <div style="flex:1"><b>${esc(r.name)}</b> <span class="badge-soft">${r.kcal} kcal</span>
        <div class="rd-meta">${esc(r.where || '')}</div>
        <div class="rd-why">${esc(r.why || '')}</div></div>
        <button class="mini-btn" data-rec="${i}">记一餐</button>
      </div>`).join('');
      $$('#home-recommend [data-rec]').forEach(btn => btn.onclick = () => {
        const r = recs[+btn.dataset.rec];
        const dish = DISH_BY_ID[r.id];
        STORE.addDiary(dish ? { name: dish.name, dishId: dish.id, kcal: dish.kcal, protein: dish.protein, fat: dish.fat, carb: dish.carb, sodium: dish.sodium, veg: dish.veg }
                          : { name: r.name, kcal: r.kcal });
        toast('已记入今日饮食'); this.renderTodayChart();
      });
    }
  },
  async _genRecommend() {
    const prof = STORE.profile;
    const cands = DINE.scoreAll(prof).slice(0, 30);
    if (!cands.length) return [];
    // 洗牌: "换一换"真正换花样(否则AI总从同一批高分菜里挑,来回就两批)
    for (let i = cands.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cands[i], cands[j]] = [cands[j], cands[i]];
    }
    // 同名菜多食堂实体去重(每个菜名只出最高分条目),避免AI挑重名
    const seenName = new Set();
    const candsUnique = cands.filter(d => !seenName.has(d.name) && seenName.add(d.name));
    const sample = candsUnique.map(d => `${d.name}|${d.kcal}kcal|P${d.protein}|${(d.tags || []).join('/')}`).join('\n');
    try {
      const j = await API.chatJSON([
        { role: 'system', content: '你是食堂推荐助手。只输出JSON。' },
        { role: 'user', content: `用户画像:${prof.goal === '无' ? '不设目标' : '目标' + prof.goal},忌口:${prof.allergies.join('、') || '无'},食堂偏好:${prof.campus === '全部' ? '不限' : '只去' + prof.campus}。候选菜品:\n${sample}\n从中挑4道组成今日推荐(多样:尽量覆盖主食/荤/素),name必须从候选中原样复制,不得改写。每道给一句15字内推荐理由。输出JSON数组:[{"name":"原菜名","why":"理由","emoji":"一个合适emoji"}]` },
      ], { maxTokens: 700 });
      const out = (Array.isArray(j) ? j : []).slice(0, 4).map(x => {
        const d = (DISH_BY_NAME[x.name] || []).map(id => DISH_BY_ID[id])[0] || matchDish(x.name);
        if (!d) return null;
        return { id: d.id, name: d.name, why: x.why, emoji: x.emoji || '', kcal: d.kcal,
          where: d.where.map(w => w.caf + '·' + w.win).slice(0, 2).join(' / ') };
      }).filter(Boolean);
      if (out.length) return out;
    } catch (e) { /* 落到本地兜底 */ }
    // 兜底:本地确定性推荐
    return cands.slice(0, 4).map(d => ({ id: d.id, name: d.name, why: '符合你的' + (prof.goal === '无' ? '均衡' : prof.goal) + '目标', kcal: d.kcal, emoji: '',
      where: d.where.map(w => w.caf + '·' + w.win).slice(0, 2).join(' / ') }));
  },
  _streak() {
    let n = 0; const now = new Date();
    for (let i = 0; i < 60; i++) {
      const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const ds = todayStr(dt);
      if ((STORE.diary[ds] || []).length) n++;
      else if (i > 0) break;
    }
    return n;
  },
  renderTodayChart() {
    const items = STORE.todayDiary();
    const target = STORE.targetKcal();
    const cur = items.reduce((s, x) => s + (x.kcal || 0), 0);
    $('#home-kcal-badge').textContent = `${Math.round(cur)} / 目标 ${target} kcal`;
    $('#home-today-empty').hidden = items.length > 0;
    const meals = [['早', 0], ['午', 0], ['晚', 0]];
    items.forEach(x => { const m = meals.find(m => m[0] === x.meal); if (m) m[1] += x.kcal || 0; });
    CHARTS.bars($('#home-today-chart'), meals.map(m => ({
      label: m[0] + '餐', v: m[1], color: m[1] > target * 0.45 ? '#e67e22' : '#e8503a', show: Math.round(m[1]) + ' kcal'
    })));
  },

  /* ── 识菜 ── */
  bindSnap() {
    const pre = $('#snap-preview');
    const handleFile = f => {
      if (!f || !f.type.startsWith('image/')) return;
      this._imgFile = f;
      compressImage(f, 1280, 0.9).then(url => {
        this._imgData = url;
        pre.innerHTML = `<img src="${url}">`;
        $('#btn-snap-run').disabled = false;
      }).catch(() => toast('图片读取失败,换一张试试'));
    };
    $('#btn-snap-camera').onclick = e => { e.stopPropagation(); $('#file-camera').click(); };
    $('#btn-snap-upload').onclick = e => { e.stopPropagation(); $('#file-upload').click(); };
    // 整个预览区点击 = 触发相册上传(扩大点击区,部分浏览器按钮点击无效时仍可用)
    pre.onclick = () => $('#file-upload').click();
    $('#file-camera').onchange = e => handleFile(e.target.files[0]);
    $('#file-upload').onchange = e => handleFile(e.target.files[0]);
    pre.addEventListener('dragover', e => { e.preventDefault(); pre.classList.add('drag'); });
    pre.addEventListener('dragleave', () => pre.classList.remove('drag'));
    pre.addEventListener('drop', e => { e.preventDefault(); pre.classList.remove('drag'); handleFile(e.dataTransfer.files[0]); });
    $('#btn-snap-run').onclick = () => this.runSnap();
    $('#btn-snap-pick').onclick = () => {
      const id = $('#snap-pick-dish').value;
      if (!id) return toast('先选一个菜哦');
      const dish = DISH_BY_ID[id];
      if (dish) this.showSnapResult({ matched: dish, source: 'menu' });
    };
    // 菜单点选联动
    $('#snap-pick-caf').onchange = () => DINE.fillDishSelect();
    // 关键词搜索
    const searchBox = $('#snap-search'), results = $('#snap-search-results');
    searchBox.oninput = () => {
      const q = (searchBox.value || '').trim();
      if (!q) { results.hidden = true; results.innerHTML = ''; return; }
      const hits = kwSearch(DISHES, q, 40);
      results.hidden = !hits.length;
      results.innerHTML = hits.map(d => `<div class="menu-item" data-id="${d.id}">
        <div class="mi-name">${esc(d.name)}<small> ${d.where.map(w => w.caf + '·' + w.win).join(' / ')} · ${d.kcal}kcal · ${d.grade}级</small></div>
        <button class="mi-add">查看</button></div>`).join('')
        || `<div class="empty-hint">没找到「${esc(q)}」——手册可能没收录<br><button class="btn" id="btn-add-from-search" style="margin:.5rem auto 0;font-size:0.925rem"> 把它添加进菜单库</button></div>`;
      const addBtn = $('#btn-add-from-search');
      if (addBtn) addBtn.onclick = () => { if (window.OPEN_ADD_DISH) window.OPEN_ADD_DISH(q); };
      $$('#snap-search-results .menu-item').forEach(it => it.onclick = () => {
        const dish = DISH_BY_ID[it.dataset.id];
        if (dish) { this.showSnapResult({ matched: dish, source: 'menu' }); results.hidden = true; searchBox.value = ''; }
      });
    };
  },
  async runSnap() {
    if (!this._imgData) return;
    if (!API.hasVision()) {
      toast('当前 AI 无视觉能力,已切换为菜单点选模式');
      $('#snap-pick-caf').focus();
      return;
    }
    showLoading('AI 正在端详这道菜…');
    try {
      const hint = ($('#snap-hint').value || '').trim().slice(0, 60);
      const j = await API.vision(this._imgData,
        '食堂就餐照片识别任务。请只关注照片中的食物本身,完全忽略筷子、盘子、桌面、手和背景。'
        + (hint ? '用户补充说明:「' + hint + '」——这是用户的可信提示,优先按它判断食物种类。' : '')
        + '用大白话描述每个食物(如:金黄酥脆的炸鸡排、一小碗白米饭、几颗小番茄),估计克数,按公开膳食数据(食物成分表口径)算总营养。'
        + '直接输出最终JSON(双引号,不要长篇推理):{"foods":[{"food":"食物的通俗描述","g":克数}],"kcal":总热量数字,"protein":克,"fat":克,"carb":克,"sodium":毫克,"tags":["辣"或"清淡"],"desc":"15字内点评,拿不准的注明估算"}',
        { maxTokens: 6000 });
      const data = API.extractJSON(j);
      if (!data || (!data.foods && !data.items)) throw new Error('AI 没能看清这张图。技巧:对准食物拍特写、光线充足、一次别拍太多菜');
      if (!data.items && data.foods) data.items = data.foods;
      this._lastSnap = { ai: data, matched: null, source: 'photo' };
      this.showSnapResult(this._lastSnap);
    } catch (e) {
      if (e.message === API.NO_VISION) { toast('无视觉模型,请用上方菜单点选'); return; }
      const msg = String(e.message);
      const hint = /429|限流|Too Many|502/i.test(msg) ? 'AI 正忙(限流),等 30 秒再试' : msg.slice(0, 70);
      toast('识别失败:' + hint + ' 或用上方菜单点选');
    } finally { hideLoading(); }
  },
  showSnapResult(r) {
    const box = $('#snap-result');
    box.hidden = false;
    const d = r.matched, ai = r.ai || {};
    const n = d || { kcal: ai.kcal, protein: ai.protein, fat: ai.fat, carb: ai.carb, sodium: ai.sodium, veg: 1, fiber: 2 };
    const grade = nutriGrade(n);
    const kcal = Math.round(n.kcal || 0);
    const src = r.source === 'menu' ? '来自今日菜单库' : 'AI 看图按食材估算 · 公开膳食数据口径(±25%)';
    const where = d ? `<div class="sr-where"> 可在:${d.where.map(w => `${w.caf}·${w.win}`).join(' / ')}</div>` : '';
    // 拍照模式标题: 食材清单拼接(不硬起菜名)
    const foodsList = (ai.items || ai.foods || []);
    const title = d ? d.name : (foodsList.length
      ? foodsList.map(x => `${x.food}${x.g ? '(' + x.g + 'g)' : ''}`).join(' + ')
      : (ai.name || 'AI 识别结果'));
    box.innerHTML = `
      <div class="sr-head">
        <div style="flex:1"><div class="sr-name" style="font-size:1.175rem">${esc(title)}</div>
        <div class="sr-where">${src} · 识别耗时 ${((Date.now() - (this._t0 || Date.now())) / 1000).toFixed(0)}s</div></div>
        <span class="grade-tag grade-${grade.g}">${grade.g}级</span>
      </div>
      ${where}
      ${!d && foodsList.length ? `<div class="sr-where"> AI 看到的:${foodsList.map(x => `${esc(x.food)}约${x.g}g`).join(' · ')}</div>` : ''}
      <div class="nutri-grid">
        <div class="nutri-cell"><b>≈${kcal}<em> kcal</em></b><span>热量·估算</span></div>
        <div class="nutri-cell"><b>${fix(n.protein)}<em> g</em></b><span>蛋白质</span></div>
        <div class="nutri-cell"><b>${fix(n.fat)}<em> g</em></b><span>脂肪</span></div>
        <div class="nutri-cell"><b>${fix(n.carb)}<em> g</em></b><span>碳水</span></div>
        <div class="nutri-cell"><b>${Math.round(n.sodium || 0)}<em> mg</em></b><span>钠(盐)</span></div>
        <div class="nutri-cell"><b>${fix(n.fiber, n.fiber == null ? '-' : n.fiber + 'g')}<em></em></b><span>膳食纤维</span></div>
      </div>
      <div class="mini-note" style="text-align:center">营养为 AI 按食堂常规份量估算(通常±25%),受窗口实际用油盐影响,供决策参考非精确计量</div>
      <div class="radar-wrap"><canvas id="snap-radar"></canvas></div>
      ${grade.tip}
      ${ai.desc ? `<div class="ai-note"> ${esc(ai.desc)}</div>` : ''}
      <div class="combo-swaps">过敏原:${(d && d.allergens || ai.allergens || []).join('、') || '未检出'} · 搭配建议:${pairAdvice(n)}</div>
      <button class="btn btn-primary btn-block" id="btn-snap-log"> 记入今日饮食</button>`;
    CHARTS.radar($('#snap-radar'), radarVals(n));
    $('#btn-snap-log').onclick = () => {
      STORE.addDiary({ name: d ? d.name : (ai.name || '拍照菜品'), dishId: d ? d.id : null,
        kcal: n.kcal, protein: n.protein, fat: n.fat, carb: n.carb, sodium: n.sodium, veg: n.veg });
      toast('已记入今日饮食');
      this.renderTodayChart();
    };
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },
};

/* ── 通用营养工具 ── */
function fix(v, dv) { return v == null ? '—' : (typeof dv === 'string' ? dv : Math.round(v * 10) / 10); }
function nutriGrade(n) {
  const kcal = n.kcal || 0, na = n.sodium || 0, fat = n.fat || 0;
  let g = 'B', tip = '';
  if (kcal <= 280 && na <= 650 && fat <= 12) { g = 'A'; tip = '低负担,放心吃 '; }
  else if (kcal <= 450 && na <= 900) { g = 'B'; tip = '热量适中,注意搭配蔬菜 '; }
  else if (kcal <= 600 || na <= 1200) { g = 'C'; tip = '油盐偏高,建议分一半给同学 '; }
  else { g = 'D'; tip = '高油高盐,浅尝辄止 '; }
  return { g, tip: `<div class="ai-note" style="border-color:${{A:'#6fd09a',B:'#e5c26b',C:'#eda35c',D:'#e58c8c'}[g]}"> ${tip}</div>` };
}
function radarVals(n) {
  return [
    { label: '热量', v: Math.min(100, (n.kcal || 0) / 8) },
    { label: '蛋白质', v: Math.min(100, (n.protein || 0) * 3.2) },
    { label: '脂肪', v: Math.min(100, (n.fat || 0) * 3.6) },
    { label: '碳水', v: Math.min(100, (n.carb || 0) * 1.4) },
    { label: '盐分', v: Math.min(100, (n.sodium || 0) / 12) },
    { label: '纤维', v: Math.min(100, (n.fiber || 0) * 12 + (n.veg || 0) * 15) },
  ];
}
function pairAdvice(n) {
  if ((n.kcal || 0) > 550) return '配一份清炒时蔬 + 无糖茶';
  if ((n.sodium || 0) > 900) return '多喝水,下一餐清淡些';
  if ((n.protein || 0) < 10) return '加个鸡蛋或豆制品补蛋白';
  if ((n.veg || 0) === 0) return '加一份绿叶菜更均衡';
  return '搭配一杯豆浆/酸奶很棒 ';
}
function matchDish(name) {
  if (!name) return null;
  const s = String(name).replace(/\s/g, '');
  // 精确菜名: 返回第一个实体(后续按食堂筛选)
  if ((DISH_BY_NAME[s] || []).length) return DISH_BY_ID[DISH_BY_NAME[s][0]];
  // 包含匹配:优先长菜名
  const hits = DISHES.filter(d => d.name.includes(s) || s.includes(d.name));
  if (hits.length) return hits.sort((a, b) => b.name.length - a.name.length)[0];
  // 关键词匹配
  const keys = s.split('').filter(c => '炒烧蒸煮炖拌烤炸鱼鸡肉牛猪羊豆腐土豆'.includes(c));
  let best = null, bs = 0;
  for (const d of DISHES) {
    let sc = keys.filter(k => d.name.includes(k)).length;
    if (sc > bs) { bs = sc; best = d; }
  }
  return bs >= 2 ? best : null;
}
function compressImage(file, maxSide, quality) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width: w, height: h } = img;
      const scale = Math.min(1, maxSide / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      res(cv.toDataURL('image/jpeg', quality || 0.8));
    };
    img.onerror = rej;
    img.src = url;
  });
}
function fillSelect(sel, arr) { sel.innerHTML = ''; arr.forEach(v => { const o = document.createElement('option'); o.value = o.textContent = v; sel.appendChild(o); }); }

/* 本地食安贴士库(不花 token) */
const SAFETY_TIPS = [
  ' 绿叶菜当餐买当餐吃,隔夜亚硝酸盐升高,食堂现炒的更安全。',
  ' 米饭放凉再冷藏,抗性淀粉增加,升糖更慢——控糖同学的小技巧。',
  ' 禽类务必全熟,看到带血丝的鸡排鸡腿要果断放弃。',
  ' 海鲜过敏的同学小心"仿蟹棒",它是鱼糜做的,同样可能致敏。',
  ' 一日盐摄入建议<5g,一份麻辣香锅可能就占掉一天份额。',
  ' 奶茶+蛋糕组合糖分爆炸,控糖日请选无糖茶或豆浆。',
  ' 半熟蛋(溏心)虽香,但食堂大锅出品建议选全熟,沙门氏菌风险低。',
  ' 冬季火锅汤嘌呤高,痛风体质少喝汤多吃菜。',
  ' 发芽变绿的土豆含龙葵碱,食堂土豆若发苦,立即停筷。',
  ' 柠檬水不能减肥,但餐前喝水确实能帮你少吃两口。',
  ' 豆浆必须煮沸,未煮沸的豆浆皂苷会刺激肠胃。',
  ' 野蘑菇不采不吃,食堂的菌菇都是种植菇,放心。',
  ' 加工肉(香肠午餐肉)每周别超过2次,腌制增加血压负担。',
  ' 花生坚果过敏的同学,注意宫保鸡丁、夫妻肺片里藏的花生碎!',
  ' 每天1500ml水,食堂就餐前先喝口水,有助控制食量。',
  ' 饭后立即吃大量水果会胀气,间隔20分钟更好。',
  ' 早餐别只吃碳水,加个鸡蛋/一盒牛奶,上午上课不犯困。',
  ' 泡面类汤底钠含量惊人,汤能不喝就不喝。',
  ' 虾头发黑不新鲜,选虾仁菜品时留意颜色发灰发暗的要避开。',
  ' 油炸食品配冰饮料,肠胃双重打击,减脂期尤其要避开。',
];
