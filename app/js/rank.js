/* ═══ 知食 · 食堂红黑榜 ═══
   三源评价:种子数据(两周真实感样本) + 本机评价 + 共享评价(同源 server.py / 存储互通)
   AI 口碑提炼按天缓存,省 token */
const RANK = {
  SERVER: false,
  remote: [],
  nicks: {},      // uid  最新昵称(改名全站同步)
  seg: 'red',
  stars: 0,
  pickedTags: [],
  _revCache: null,
  /* 显示昵称: 自己用实时名,他人按uid映射最新名,无映射用快照 */
  nickOf(r) {
    if (r.uid === STORE.uid) return STORE.nick;
    return (r.uid && this.nicks[r.uid]) || r.nick || '同学';
  },

  async detectServer() {
    for (let i = 0; i < 2 && !this.SERVER; i++) {
      try {
        const ctl = new AbortController();
        setTimeout(() => ctl.abort(), 4500);   // 云端冷启动可能较慢
        const r = await fetch('/api/ping', { signal: ctl.signal });
        if (r.ok) {
          this.SERVER = true;
          window.__ZHISHI_SERVER = true;
          CFG.set('mode', 'proxy');   // 有服务端  自动走代理模式(蚂蚁额度/共享评价)
          STORE.registerNick();
          this.syncRemote();
          this.syncNicks();
        }
      } catch (e) { /* 无服务器:纯本地模式 */ }
      if (!this.SERVER && i === 0) await new Promise(r => setTimeout(r, 1200));
    }
    this._hint();
    if (this.SERVER) {
      // 探测成功后停掉重试循环; 失败则保持30秒重试直到共享模式恢复
      if (this._watchTimer) { clearInterval(this._watchTimer); this._watchTimer = null; }
      this._pushLocalPending();
      this.startPoll();
      if (typeof APP !== 'undefined' && APP._serverReady) APP._serverReady();
    } else {
      this._startServerWatch();
    }
  },
  /* 探测失败期间落本机的评价,在共享模式恢复后自动批量上云(按内容去重,不产生重复) */
  async _pushLocalPending() {
    if (!this.SERVER) return;
    try {
      const remoteKeys = new Set((this.remote || []).map(r => r.dish + '|' + r.time + '|' + (r.text || '')));
      for (const r of STORE.myReviews()) {
        const k = r.dish + '|' + r.time + '|' + (r.text || '');
        if (remoteKeys.has(k)) continue;
        await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dish: r.dish, stars: r.stars, tags: r.tags, text: r.text, time: r.time,
                                 caf: r.caf || '', win: r.win || '', nick: r.nick || '', uid: r.uid || '' }) });
      }
      this.syncRemote();
    } catch (e) {}
  },
  /* 冷启动/网络抖动导致的探测失败: 每30秒自动重试,恢复后评价自动上云 */
  _startServerWatch() {
    if (this._watchTimer) return;
    this._watchTimer = setInterval(() => {
      if (this.SERVER) { clearInterval(this._watchTimer); this._watchTimer = null; return; }
      this.detectServer();
    }, 30000);
  },
  async syncNicks() {
    if (!this.SERVER) return;
    try {
      const r = await fetch('/api/nicks');
      if (r.ok) { const j = await r.json(); this.nicks = j.nicks || {}; this.refresh(); }
    } catch (e) {}
  },
  _hint() {
    $('#review-share-hint').textContent = this.SERVER
      ? ' 共享模式:评价已接入云端榜单,全站同学实时可见(路演/线上均生效)'
      : ' 本地模式:评价保存在本机;接入服务端后自动升级为全站共享榜单';
  },
  async syncRemote() {
    if (!this.SERVER) return;
    try {
      const r = await fetch('/api/reviews');
      if (r.ok) { const j = await r.json(); this.remote = j.reviews || []; this.refresh(); }
    } catch (e) {}
  },
  /* 每60秒自动拉取云端评价+昵称表: 任何设备提交后, 其他设备一分钟内可见 */
  _pollTimer: null,
  startPoll() {
    if (this._pollTimer) return;
    this._pollTimer = setInterval(() => {
      if (document.hidden) return; // 页面在后台不轮询,省流量
      if (this.SERVER) { this.syncRemote(); this.syncNicks(); }
      else { this.detectServer(); }
    }, 60000);
  },
  allReviews() {
    if (this._revCache) return this._revCache;
    const rem = (this.remote || []).map(r => Object.assign({}, r, { remote: true }));
    const seen = new Set(), merged = [];
    for (const r of [...STORE.myReviews(), ...rem]) {
      // 旧格式评价(无 dishId 实体键)已淘汰: 不再显示, 避免"点不进去"的僵尸条目
      if (!r.dishId || !DISH_BY_ID[r.dishId]) continue;
      const k = r.dishId + '|' + r.time + '|' + (r.text || '');
      if (seen.has(k)) continue;
      seen.add(k); merged.push(r);
    }
    this._revCache = merged;
    return this._revCache;
  },

  agg() {
    // 按菜品实体(dishId=菜名×食堂×窗口)聚合——不同食堂同名菜是不同实体,口碑独立
    const by = {};
    for (const r of this.allReviews()) {
      const dishId = r.dishId && DISH_BY_ID[r.dishId] ? r.dishId : r.dish;
      const ent = DISH_BY_ID[dishId];
      const label = ent ? ent.name : r.dishName || r.dish;
      if (!by[dishId]) by[dishId] = { key: dishId, name: label, where: ent ? ent.where : [], n: 0, sum: 0, tags: {}, texts: [], mine: 0 };
      if (!r.replyTo) { by[dishId].n++; by[dishId].sum += r.stars || 0; } // 回复不计分,只作楼层
      (r.tags || []).forEach(t => by[dishId].tags[t] = (by[dishId].tags[t] || 0) + 1);
      if (r.text && by[dishId].texts.length < 6) by[dishId].texts.push({ text: r.text, time: r.time, seed: !!r.seed, caf: r.caf || '', win: r.win || '', nick: r.nick || '', uid: r.uid || '' });
      if (!r.seed && !r.remote) by[dishId].mine++;
    }
    const arr = Object.values(by);
    arr.forEach(x => x.avg = x.n ? x.sum / x.n : 0);
    return arr;
  },

  refresh() {
    this._revCache = null;
    this.renderSeg(this.seg);
  },
  /* 评价选菜: 模糊搜索输入(菜品实体=菜名×食堂×窗口, 直接选到具体那家) */
  pickedDishId: '',
  pickedDishName: '',
  _paintPicked() {
    const el = $('#review-dish-picked');
    const ent = DISH_BY_ID[this.pickedDishId];
    if (ent) {
      const w = ent.where[0] || {};
      el.hidden = false;
      el.innerHTML = ` 已选:<b>${esc(ent.name)}</b> ${esc(w.caf || '')}${w.win ? '·' + esc(w.win) : ''} (点搜索框可重选)`;
    } else { el.hidden = true; }
  },
  bindReviewSearch() {
    const input = $('#review-dish'), sug = $('#review-suggest');
    input.oninput = () => {
      this.pickedDishId = '';
      this._paintPicked();
      const q = (input.value || '').trim();
      if (!q) { sug.hidden = true; return; }
      const hits = kwSearch(DISHES, q, 30);
      sug.hidden = !hits.length;
      sug.innerHTML = hits.map(d => {
        const w = d.where[0] || {};
        return `<div class="menu-item" data-id="${d.id}">
        <div class="mi-name">${esc(d.name)}
        <small> ${esc(w.caf || '')}·${esc(w.win || '')} · ${d.kcal}kcal · ${d.grade}级</small></div>
        <button class="mi-add">评这家</button></div>`;
      }).join('') || `<div class="empty-hint">没找到「${esc(q)}」——手册可能没收录<br><button class="btn" id="btn-add-from-review" style="margin:.5rem auto 0;font-size:0.925rem"> 手动添加这道菜</button></div>`;
      $$('#review-suggest .menu-item').forEach(it => {
        it.onmousedown = e => {
          e.preventDefault();
          this.pickedDishId = it.dataset.id;
          const ent = DISH_BY_ID[this.pickedDishId];
          input.value = ent ? ent.name : '';
          sug.hidden = true;
          this._paintPicked();
        };
      });
      const addBtn = $('#btn-add-from-review');
      if (addBtn) addBtn.onmousedown = e => { e.preventDefault(); if (window.OPEN_ADD_DISH) window.OPEN_ADD_DISH(q); };
    };
    // 不在blur时关闭(输入法/误触); 点击弹窗和输入框以外的区域才关闭
    document.addEventListener('click', e => {
      if (!sug.hidden && !sug.contains(e.target) && e.target !== input) sug.hidden = true;
    });
  },

  renderSeg(seg) {
    this.seg = seg;
    $$('#rank-seg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.k === seg));
    const agg = this.agg();
    // 真实 vs 样例 统计
    const realTotal = this.allReviews().filter(r => !r.seed).length;
    // 贝叶斯加权平均(IMDb/豆瓣同款): 评价越多越可信,小样本向全局均分收缩,防"一条5星霸榜"
    const totalN = agg.reduce((s, x) => s + x.n, 0);
    const globalAvg = totalN ? agg.reduce((s, x) => s + x.avg * x.n, 0) / totalN : 3.5;
    const M = 3; // 先验权重 = 3条中性评价
    const bayes = x => (x.n / (x.n + M)) * x.avg + (M / (x.n + M)) * globalAvg;
    agg.forEach(x => x.score = bayes(x));
    let list = [];
    if (seg === 'red') {
      list = agg.filter(x => x.n >= 1 && x.avg >= 3.8).sort((a, b) => b.score - a.score).slice(0, 12);
    } else if (seg === 'black') {
      list = agg.filter(x => x.n >= 1 && (x.avg < 3.4 || (x.tags['踩雷'] || 0) >= 1)).sort((a, b) => a.score - b.score).slice(0, 12);
    } else {
      // 重油重盐预警: 评价标签 + 营养库数据双通道
      list = agg.filter(x => (x.tags['太咸'] || 0) + (x.tags['太油'] || 0) >= 1)
        .sort((a, b) => ((b.tags['太咸'] || 0) + (b.tags['太油'] || 0)) - ((a.tags['太咸'] || 0) + (a.tags['太油'] || 0))).slice(0, 10);
      const dbWarn = DISHES.filter(d => d.grade === 'D' && !list.find(x => x.key === d.id))
        .slice().sort((a, b) => b.sodium - a.sodium).slice(0, 6)
        .map(d => ({ key: d.id, name: d.name, where: d.where, n: 0, avg: 0, tags: { 'AI数据预警': 1 }, texts: [], db: d, mine: 0 }));
      list = list.concat(dbWarn).slice(0, 12);
    }
    const medal = ['', '', ''];
    $('#rank-list').innerHTML = list.length ? list.map((x, i) => {
      const d = DISH_BY_ID[x.key];
      const kcal = d ? d.kcal + 'kcal' : '';
      const tags = Object.entries(x.tags).sort((a, b) => b[1] - a[1]).slice(0, 4)
        .map(([t, n]) => `<span class="tag ${['太咸', '太油', '踩雷'].includes(t) ? 'hot' : t === 'AI数据预警' ? 'fry' : 'fresh'}">${t}${n > 1 ? '×' + n : ''}</span>`).join('');
      const w0 = (x.where || [])[0] || {};
      const where = w0.caf ? w0.caf + '·' + w0.win : '';
      const shown = x.texts.slice(0, 1);
      return `<div class="rank-item" data-open-dish="${esc(x.key)}" style="cursor:pointer">
        <div class="ri-head">
          <span class="ri-rank">${seg === 'red' && i < 3 ? medal[i] : i + 1}</span>
          <span class="ri-name">${esc(x.name)}</span>
          ${x.avg ? `<span class="ri-score ${x.avg < 3 ? 'bad' : ''}">${'★'.repeat(Math.round(x.avg))}${'☆'.repeat(5 - Math.round(x.avg))} ${x.avg.toFixed(1)}</span>` : `<span class="ri-score bad">数据预警</span>`}
        </div>
        <div class="ri-where"> ${esc(where)}${kcal ? ' · ' + kcal : ''} · ${x.n} 条真实评价${x.mine ? `(含你${x.mine}条)` : ''}</div>
        ${shown.map(t => `<div class="review-item"><b></b> ${esc(t.text.slice(0, 90))} <span class="rv-time">${esc(this.nickOf(t))} · ${this._ago(t.time)}</span></div>`).join('')}
        ${tags ? `<div class="ri-tags">${tags}</div>` : ''}
        <div class="ri-btns">
          <button class="btn" data-open-reviews="${esc(x.key)}">查看评论区(${x.n})</button>
          <button class="btn" data-review="${esc(x.key)}" data-review-name="${esc(x.name)}">我也评</button>
          ${d ? '<button class="btn" data-nutri="' + esc(x.key) + '">营养详情</button>' : ''}
        </div>
        <div data-open-reviews-card="${esc(x.key)}" style="display:none"></div>
      </div>`;
    }).join('') : '<div class="empty-hint">榜单虚位以待——写下第一条真实评价</div>';
    $$('#rank-list [data-review]').forEach(b => b.onclick = () => {
      this.pickedDishId = b.dataset.review;
      this._paintPicked();
      document.querySelector('[data-tab="rank"]').click();
      const form = $('#review-dish');
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('已选中「' + b.dataset.reviewName + '」,写评价吧');
    });
        $$('#rank-list .rank-item').forEach(item => {
      item.onclick = e => {
        // 点了"查看评论区"按钮 → 直接打开
        const openBtn = e.target.closest('[data-open-reviews]');
        if (openBtn) { this.openDishReviews(openBtn.dataset.openReviews); return; }
        // 其他按钮(我也评/营养详情)有自己的处理,不触发卡片点击
        if (e.target.closest('button') || e.target.closest('.mini-btn')) return;
        // 点卡片其他区域 → 也打开评论区
        this.openDishReviews(item.dataset.openDish);
      };
    });
    $$('#rank-list [data-nutri]').forEach(b => b.onclick = () => SNAP_VIEW(DISH_BY_ID[b.dataset.nutri]));
  },
  /* ── 菜品评论区抽屉: 全部评价 + 楼层回复(按菜品实体分组) ── */
  replyTarget: null,
  openDishReviews(dishId) {
    const drawer = $('#dish-reviews');
    if (!drawer) return;
    const ent = DISH_BY_ID[dishId];
    if (!ent) return;
    // 升序: 先发的在上, 回复永远在下面
    const revs = this.allReviews().filter(r => r.dishId === dishId).sort((a, b) => a.time - b.time);
    const aggX = this.agg().find(x => x.key === dishId);
    const avg = aggX && aggX.n ? aggX.avg : 0;
    const w0 = (ent.where || [])[0] || {};
    $('#dr-title').textContent = `${ent.name} ${w0.caf || ''}·${w0.win || ''} · ${revs.length} 条真实评价${avg ? ` · 均分${avg.toFixed(1)}` : ''}`;
    // 顶层+折叠回复树: 回复默认折叠, 点" N 条回复"展开
    const nickById = {};
    revs.forEach(r => { if (r.id) nickById[r.id] = this.nickOf(r); });
    const tops = revs.filter(r => !r.replyTo);
    const renderReview = (r) => {
      const target = r.replyTo ? (nickById[r.replyTo] ? '@' + esc(nickById[r.replyTo]) : '@已删除的评价') : '';
      return `<div class="review-item" style="padding:.55rem .2rem">
        ${'★'.repeat(Math.round(r.stars || 0))}
        <span class="rv-time" style="margin-left:.3rem">${esc(this.nickOf(r))} · ${this._ago(r.time)}</span>
        ${r.text ? `<div style="font-size:0.945rem;color:var(--ink);margin-top:.15rem">${target ? '<span style="color:#7fb3ff">' + target + ' </span>' : ''}${esc(r.text)}</div>` : '<div style="font-size:0.885rem;color:var(--ink3)">(只有星级)</div>'}
        ${(r.tags || []).length ? `<div class="ri-tags" style="margin-top:.25rem">${r.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        <button class="mini-btn" data-reply-id="${esc(r.id || '')}" data-reply-nick="${esc(this.nickOf(r))}" style="margin-top:.3rem"> 回复</button>
      </div>`;
    };
    const blocks = tops.map(t => {
      const kids = revs.filter(r => r.replyTo === t.id || (r.replyTo && nickById[r.replyTo] && revs.some(k => k.id === r.replyTo && k.replyTo === t.id)));
      const direct = revs.filter(r => r.replyTo === t.id);
      const indirect = kids.filter(k => k.replyTo !== t.id);
      const allKids = direct.concat(indirect).sort((a, b) => a.time - b.time);
      if (!allKids.length) return renderReview(t);
      return renderReview(t) +
        `<div class="ri-replies" hidden style="margin-left:1.2rem;border-left:2.5px solid var(--g3);padding-left:.5rem">${allKids.map(renderReview).join('')}</div>` +
        `<button class="mini-btn" data-toggle-replies style="margin:.2rem 0 .5rem"> 展开 ${allKids.length} 条回复</button>`;
    });
    $('#dr-body').innerHTML = tops.length ? blocks.join('') : '<div class="empty-hint">还没有文字评价——点下方按钮写下第一条</div>';
    $$('#dr-body [data-toggle-replies]').forEach(b => b.onclick = () => {
      const box = b.previousElementSibling;
      if (box && box.classList.contains('ri-replies')) {
        box.hidden = !box.hidden;
        b.textContent = box.hidden ? ` 展开 ${box.querySelectorAll('.review-item').length} 条回复` : ' 收起回复';
      }
    });
    drawer.hidden = false;
    // 注意: 抽屉头只有 #dr-back(返回), 没有 #dr-close 元素。
    // 绑不存在的元素会抛 TypeError, 使下面回复/写评价的绑定全部跳过(线上三故障根因)。
    const drClose = $('#dr-close');
    if (drClose) drClose.onclick = () => { drawer.hidden = true; };
    $('#dr-back').onclick = () => { drawer.hidden = true; };
    drawer.onclick = e => { if (e.target === drawer) drawer.hidden = true; }; // 点背景也可关闭
    $$('#dr-body [data-reply-id]').forEach(b => b.onclick = () => {
      this.replyTarget = { id: b.dataset.replyId, nick: b.dataset.replyNick };
      drawer.hidden = true;
      this.pickedDishId = dishId;
      document.querySelector('[data-tab="rank"]').click();
      this._showReplyBar();
      const ta = $('#review-text');
      if (ta) ta.focus();
    });
    $('#dr-write').onclick = () => {
      drawer.hidden = true;
      this.pickedDishId = dishId;
      this._paintPicked();
      document.querySelector('[data-tab="rank"]').click();
      const form = $('#review-dish');
      if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  },
  _showReplyBar() {
    const bar = $('#review-reply-bar');
    if (!bar || !this.replyTarget) return;
    bar.hidden = false;
    // 回复模式: 隐藏星级和标签(回复就是纯文字讨论)
    const starRow = $('#review-stars'), tagGroup = $('#review-tags');
    if (starRow) starRow.hidden = true;
    if (tagGroup) tagGroup.hidden = true;
    bar.innerHTML = ` 正在回复 <b>@${esc(this.replyTarget.nick)}</b> <span class="mini-note" style="margin:0">(写入内容将作为该条评价的回复)</span> <button class="mini-btn" id="reply-cancel">取消</button>`;
    $('#reply-cancel').onclick = () => { this.replyTarget = null; this._hideReplyBar(); };
  },
  _hideReplyBar() {
    const bar = $('#review-reply-bar');
    if (bar) bar.hidden = true;
    const starRow = $('#review-stars'), tagGroup = $('#review-tags');
    if (starRow) starRow.hidden = false;
    if (tagGroup) tagGroup.hidden = false;
  },
  _ago(t) {
    const d = Math.floor((Date.now() - t) / 86400000);
    if (d <= 0) return '今天'; if (d === 1) return '昨天'; if (d < 30) return d + '天前';
    return new Date(t).getMonth() + 1 + '-' + new Date(t).getDate();
  },

  async insight() {
    const box = $('#rank-insight');
    CACHE.set('rank_insight', null);
    const agg = this.agg().filter(x => x.n >= 1);
    if (agg.length < 2) { box.innerHTML = '<div class="empty-hint">至少需要 2 道菜有真实评价才能提炼口碑——先去写几条吧</div>'; return; }
    const total = agg.reduce((s, x) => s + x.n, 0);
    // 数据量分级: 少样本也能出洞察, 但标注可信度
    const depth = total >= 15 ? '样本充足(15+条),洞察可信度高' : total >= 6 ? '样本中等(6-14条),趋势仅供参考' : '样本较少(<6条),先看风向,随评价积累自动变准';
    const red = agg.slice().sort((a, b) => b.avg - a.avg).slice(0, 5);
    // 真差评: 均分<3.4 或带踩雷标签; 没有就传空(AI输出"暂无差评"), 不再把高分好评当差评
    const black = agg.filter(x => x.avg < 3.4 || (x.tags['踩雷'] || 0) >= 1).sort((a, b) => a.avg - b.avg).slice(0, 5);
    box.innerHTML = '<div class="skeleton">AI 正在阅读 ' + total + ' 条评价…</div>';
    const pack = xs => xs.map(x => `${x.name}(均分${x.avg.toFixed(1)},${Object.entries(x.tags).map(([t, n]) => t + 'x' + n).join('/')})`).join(';');
    try {
      const j = await API.chatJSON([
        { role: 'system', content: '你是食堂口碑分析员,输出JSON。评价样本可能较少,结论要保守措辞,不要夸大。' },
        { role: 'user', content: `基于学生评价总结当前食堂口碑(样本:${total}条,涉及${agg.length}道菜,${depth})。好评:${pack(red)}。差评:${pack(black)}。输出:{"summary":"口碑风向≤70字","black":"避雷提示≤70字","trend":""}` },
      ], { maxTokens: 700, temperature: 0.6 });
      const html = `<div class="mini-note" style="margin-bottom:.35rem">※ 样本 ${total} 条 · ${depth} · 全部来自真实评价,无预置数据</div><div class="ai-note"> 口碑风向:${esc(j.summary || '')}</div>
        <div class="ai-note" style="border-color:#e58c8c;background:#fdf3f3;color:#8c3a3a;margin-top:.4rem"> 避雷提示:${esc(j.black || '')}</div>
`;
      box.innerHTML = html;
    } catch (e) {
      box.innerHTML = `<div class="ai-note"> 当前呼声最高:${esc(red[0] ? red[0].name : '')} 等; 需要改进:${esc(black.slice(0, 3).map(x => x.name).join('、'))}</div>`;
    }
  },

  bind() {
    $$('#rank-seg .seg-btn').forEach(b => b.onclick = () => this.renderSeg(b.dataset.k));
    $('#rank-insight-btn').onclick = () => this.insight();
    // 上传并评价新菜(帮食堂更新食谱): AI 估算营养入食谱 → 自动选中到写评价表单
    fillSelect($('#rank-add-caf'), Object.keys(CAMPUS_OF));
    $('#rank-add-btn').onclick = async () => {
      const name = $('#rank-add-name').value.trim();
      const caf = $('#rank-add-caf').value;
      const win = $('#rank-add-win').value.trim();
      if (!name) return toast('先填菜名');
      if (!caf) return toast('先选食堂');
      const st = $('#rank-add-status');
      const dish = window.ESTIMATE_ADD_DISH ? await window.ESTIMATE_ADD_DISH(name, caf, win, st) : null;
      if (!dish) return;
      st.textContent = ` 已加入「${name}(${caf}${win ? '·' + win : ''})」,在上方写评价即可上榜,也会出现在点餐菜单里。`;
      $('#rank-add-name').value = ''; $('#rank-add-win').value = '';
      this.pickedDishId = dish.id;
      this._paintPicked();
      const form = $('#review-dish');
      if (form) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('已加入食谱,写评价吧');
    };
    // 游客身份条
    const id = STORE.identity();
    const idBar = $('#my-identity');
    if (idBar) {
      const paint = () => idBar.innerHTML = ` 我的身份:<b>${esc(STORE.nick)}</b> <span class="mini-note" style="margin:0">(点此改名 · 全站唯一 · )</span>`;
      paint();
      idBar.onclick = async () => {
        const n = prompt('给自己起个名字吧(≤12字,全站唯一,评价上榜时展示):', STORE.nick);
        if (!n || n.trim() === STORE.nick) return;
        const res = await STORE.setNick(n.trim());
        if (!res.ok) {
          toast(res.error === 'taken' ? ' 这个名字已被别的同学占用,换一个吧' : ' 保存失败:' + (res.error || ''));
          return;
        }
        paint(); STORE.registerNick();
        toast('昵称已更新,你的历史评价全部同步改名');
        this.refresh(); this.syncNicks(); CACHE.set('rank_insight', null);
      };
    }
    const starsEl = $('#review-stars .stars');
    const paint = v => starsEl.textContent = '★'.repeat(v) + '☆'.repeat(5 - v);
    starsEl.parentElement.onclick = e => {
      const r = starsEl.getBoundingClientRect();
      const v = Math.ceil(((e.clientX || r.right) - r.left) / (r.width / 5));
      this.stars = Math.max(1, Math.min(5, v)); paint(this.stars);
    };
    $$('#review-tags .chip').forEach(c => c.onclick = () => {
      c.classList.toggle('on');
      const v = c.dataset.v;
      const i = this.pickedTags.indexOf(v);
      i >= 0 ? this.pickedTags.splice(i, 1) : this.pickedTags.push(v);
    });
    $('#btn-review-submit').onclick = async () => {
      const typed = $('#review-dish').value.trim();
      // 未点建议但输入了文字: 按关键词匹配到具体实体
      if (!this.pickedDishId && typed) {
        const hits = kwRank(DISHES.filter(d => kwMatch(d, typed)), typed);
        if (hits.length) this.pickedDishId = hits[0].id;
      }
      if (!this.pickedDishId) return toast('先搜索并选择要评价的菜(点建议项)');
      const ent = DISH_BY_ID[this.pickedDishId];
      if (!ent) return toast('菜品数据异常,重新搜索');
      // 回复不需要星级(回复就是回复); 首次评价才需要
      if (!this.stars && !this.replyTarget) return toast('给个星级评分吧');

      const text = $('#review-text').value.trim();
      const id = STORE.identity();
      const w0 = (ent.where || [])[0] || {};
      // 提交前最后一次探测重试(冷启动/抖动场景),保证评价尽量上云共享
      if (!this.SERVER) await this.detectServer();
      const replyTo = this.replyTarget ? this.replyTarget.id : '';
      const r = STORE.addReview({ dishId: this.pickedDishId, dish: ent.name, caf: w0.caf || '', win: w0.win || '',
        stars: this.stars, tags: this.replyTarget ? [] : [...this.pickedTags], text, nick: id.nick, uid: id.uid, replyTo });
      const dishId = this.pickedDishId;
      this.stars = 0; paint(0); this.pickedTags = []; this.pickedDishId = ''; this.replyTarget = null;
      this._hideReplyBar();
      $$('#review-tags .chip').forEach(c => c.classList.remove('on'));
      $('#review-text').value = ''; $('#review-dish').value = '';
      this._paintPicked();
      // 不看 SERVER 标志, 直接尝试 POST (失败自动落本地)
      try {
        await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: r.id, replyTo, dishId: r.dishId, dishName: r.dish, caf: r.caf, win: r.win,
            stars: r.stars, tags: r.tags, text: r.text, time: r.time, nick: id.nick, uid: id.uid }) });
        toast('已提交,全站共享榜单已更新');
        STORE.clearMyReviews();
        this._revCache = null;
        await this.syncRemote();
        this.openDishReviews(dishId);
        return;
      } catch (e) { /* 服务器不可达 → 本地 */ }
      toast('已保存(本地,联网后自动同步)'); this.refresh(); CACHE.set('rank_insight', null);
      this.openDishReviews(dishId);
    };
  },
};

/* 种子评价: 已按要求清空——榜单全部来自真实评价(共享模式下多端汇入) */
const SEED_REVIEWS = [];
