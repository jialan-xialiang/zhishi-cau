/* ═══ 知食 · AI 个性化点餐 ═══
   双引擎:本地算法保证"永远有结果",AI 精修提升"懂你程度"(失败自动降级) */
const DINE = {
  _tagFilter: '',
  _shown: 80,
  initMenus() {
    this._syncChips();
    // 目标
    $$('#profile-goal .chip').forEach(c => c.onclick = () => {
      STORE.profile.goal = c.dataset.v; STORE.setProfile(STORE.profile); this._syncChips();
    });
    // 过敏/忌口
    $$('#profile-allergy .chip').forEach(c => c.onclick = () => {
      const a = STORE.profile.allergies;
      const i = a.indexOf(c.dataset.v);
      i >= 0 ? a.splice(i, 1) : a.push(c.dataset.v);
      STORE.setProfile(STORE.profile); this._syncChips();
    });
    // 食堂(东区+西区+不限, 三组统一绑定)
    $$('#profile-extra .chip, #profile-extra2 .chip, #profile-extra0 .chip').forEach(c => c.onclick = () => {
      STORE.profile.campus = c.dataset.v; STORE.setProfile(STORE.profile); this._syncChips();
    });
    $('#btn-dine-run').onclick = () => this.recommend();
    // 菜单浏览器
    const cfs = ['全部食堂', ...Object.keys(CAMPUS_OF)];
    fillSelect($('#menu-filter-caf'), cfs);
    fillSelect($('#snap-pick-caf'), cfs);
    this.fillDishSelect();
    $('#menu-filter-caf').onchange = () => this.renderMenu();
    $('#menu-search').oninput = () => this.renderMenu();
    $$('#menu-filter-tags .ftag').forEach(b => b.onclick = () => {
      $$('#menu-filter-tags .ftag').forEach(x => { if (x !== b) x.classList.remove('on'); });
      b.classList.toggle('on');
      this._tagFilter = b.classList.contains('on') ? b.dataset.t : '';
      this.renderMenu();
    });
    $('#menu-more').onclick = () => { this._shown += 80; this.renderMenu(true); };
    $('#menu-count').textContent = DISHES.length + ' 道菜';
    this.renderMenu();
  },
  _syncChips() {
    $$('#profile-goal .chip').forEach(c => c.classList.toggle('on', c.dataset.v === STORE.profile.goal));
    $$('#profile-allergy .chip').forEach(c => c.classList.toggle('on', STORE.profile.allergies.includes(c.dataset.v)));
    $$('#profile-extra .chip, #profile-extra2 .chip, #profile-extra0 .chip')
      .forEach(c => c.classList.toggle('on', c.dataset.v === STORE.profile.campus));
  },
  fillDishSelect() {
    const caf = $('#snap-pick-caf').value;
    let list = DISHES;
    if (caf && caf !== '全部食堂') list = DISHES.filter(d => d.where.some(w => w.caf === caf));
    const sel = $('#snap-pick-dish');
    sel.innerHTML = '';
    if (!list.length) { const o = document.createElement('option'); o.textContent = '该食堂暂无数据'; sel.appendChild(o); return; }
    list.forEach(d => {
      const o = document.createElement('option');
      o.value = d.id;
      o.textContent = d.name + ' (' + d.kcal + 'kcal·' + d.grade + '级)';
      sel.appendChild(o);
    });
  },

  /* ── 口味需求解析: "想吃鱼,不想吃太辣" → {terms:[鱼], avoid:[太辣], noSpicy, wantSoup} ── */
  _parseCraving(craving) {
    if (!craving) return { terms: [], avoid: [], noSpicy: false, wantSoup: false };
    const terms = [], avoid = [];
    let noSpicy = false, wantSoup = false;
    for (let p of craving.split(/[,,，、 ]+/)) {
      p = (p || '').trim();
      if (!p) continue;
      if (/不辣|别太辣|不要辣|忌辣/.test(p)) { noSpicy = true; continue; }
      const neg = p.replace(/^(不想吃|不想来点|不想来|不爱吃|不喜欢吃|不喜欢|不要|不吃|别吃|别来|别放|别|讨厌|忌)/, '');
      if (neg !== p && neg.length >= 1 && neg.length <= 8) { avoid.push(neg.replace(/(一点|一些|的菜|的|嘛|吧|哦|哈)$/, '')); continue; }
      if (/^有?汤/.test(p) && p.length <= 4) { wantSoup = true; continue; }
      p = p.replace(/^(想吃|想吃点|想来点|想来份|想吃些|想|要|点个|点|有点|来点|来份|来)/, '').replace(/(一点|一些|的菜|的东西|的|嘛|吧|哦|哈)$/, '');
      if (p.length >= 1 && p.length <= 8) terms.push(p);
    }
    return { terms, avoid, noSpicy, wantSoup };
  },

  /* ── 打分与过滤 ── */
  scoreAll(prof, craving) {
    prof = prof || STORE.profile;
    const al = prof.allergies;
    const cr = this._parseCraving(craving);
    const noSpicy = al.includes('辣') || cr.noSpicy;
    /* 不想吃: 菜名含该词直接排除; 辣/油腻/高糖类按标签联动排除 */
    const avoidHit = d => cr.avoid.some(t => d.name.includes(t)
      || (t.includes('辣') && (d.tags || []).includes('辣'))
      || ((t.includes('油') || t.includes('腻')) && ['油炸', '高油'].some(x => (d.tags || []).includes(x)))
      || ((t.includes('甜') || t.includes('糖')) && (d.tags || []).includes('高糖')));
    let pool = DISHES.filter(d => {
      if ((d.allergens || []).some(a => al.includes(a))) return false;
      if (noSpicy && (d.tags || []).includes('辣')) return false;
      if (prof.campus !== '全部' && !(d.where || []).some(w => w.caf === prof.campus)) return false;
      if (prof.dislike && prof.dislike.some(x => d.name.includes(x))) return false;
      if (cr.avoid.length && avoidHit(d)) return false;
      return true;
    });
    const goal = prof.goal === '无' ? '均衡' : prof.goal;
    const score = d => {
      let s = 0;
      const kcal = d.kcal || 0, p = d.protein || 0, fat = d.fat || 0, na = d.sodium || 0;
      const has = t => (d.tags || []).includes(t);
      if (goal === '减脂') s = p * 1.6 + (d.veg || 0) * 8 + (d.fiber || 0) * 2 - kcal * 0.05 - fat * 1.2 - na * 0.006 - (has('油炸') ? 18 : 0) - (has('高油') ? 12 : 0) + (has('清淡') ? 6 : 0);
      else if (goal === '增肌') s = p * 2.2 + (kcal >= 280 && kcal <= 650 ? 14 : 0) - (has('高糖') ? 10 : 0) + (has('清淡') ? 3 : 0);
      else if (goal === '控糖') s = (d.fiber || 0) * 3 + (d.veg || 0) * 7 - (has('高糖') ? 25 : 0) - (has('油炸') ? 10 : 0) - kcal * 0.03 + (has('蒸') ? 6 : 0) - (d.cat === '主食' && kcal > 400 ? 10 : 0);
      else s = (d.grade === 'A' ? 12 : d.grade === 'B' ? 5 : d.grade === 'D' ? -15 : 0) + (d.veg || 0) * 5 + p * 0.6 - na * 0.008;
      if (cr.terms.some(t => d.name.includes(t))) s += 70;
      if (cr.wantSoup && d.cat === '汤粥') s += 40;
      return s;
    };
    return pool.map(d => ({ d, s: score(d) })).sort((a, b) => b.s - a.s).map(x => x.d);
  },

  /* ── 选定本餐食堂: 指定了就用它;没指定则必须选"有你点名菜"的食堂 ── */
  pickCafeteria(prof, craving) {
    const all = this.scoreAll(prof, craving);
    if (prof.campus !== '全部') return { pool: all, caf: prof.campus, all };
    const cr = this._parseCraving(craving);
    const crHit = cr.terms.length ? all.filter(d => cr.terms.some(t => d.name.includes(t))) : [];
    if (crHit.length) {
      const cafCnt = {};
      crHit.slice(0, 6).forEach(d => (d.where || []).forEach(w => { cafCnt[w.caf] = (cafCnt[w.caf] || 0) + 2; }));
      const cands = Object.entries(cafCnt).sort((a, b) => b[1] - a[1]).slice(0, 3);
      const pick0 = cands[Math.floor(Math.random() * cands.length)][0];
      const pool = all.filter(d => (d.where || []).some(w => w.caf === pick0));
      if (pool.length >= 6) return { pool, caf: pick0, all };
    }
    const cnt = {};
    all.slice(0, 40).forEach(d => (d.where || []).forEach(w => { cnt[w.caf] = (cnt[w.caf] || 0) + 1; }));
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (!top.length) return { pool: all, caf: '', all };
    const caf = top[Math.floor(Math.random() * top.length)][0];
    const pool = all.filter(d => (d.where || []).some(w => w.caf === caf));
    return { pool: pool.length >= 8 ? pool : all, caf: pool.length >= 8 ? caf : '', all };
  },

  /* ── AI 推荐 ── */
  async recommend() {
    const prof = STORE.profile;
    const craving = ($('#dine-craving').value || '').trim();
    const box = $('#dine-result');
    const target = STORE.GOAL_MEAL[prof.goal === '无' ? '均衡' : prof.goal] || 700;
    showLoading('AI 正在为你搭配这一餐…');
    const { pool, caf, all: allPool } = this.pickCafeteria(prof, craving);
    const thisCaf = caf || (prof.campus !== '全部' ? prof.campus : '全校');
    let missNote = '';
    const cr0 = this._parseCraving(craving);
    if (cr0.terms.length && prof.campus !== '全部') {
      const hitAll = allPool.filter(d => cr0.terms.some(t => d.name.includes(t)));
      const hitHere = hitAll.filter(d => (d.where || []).some(w => w.caf === thisCaf));
      if (hitAll.length && !hitHere.length) {
        missNote = `⚠️ ${esc(thisCaf)}没有「${esc(cr0.terms.join('、'))}」相关的菜(它在:${hitAll[0].where.map(w => w.caf).join('/')}),已按忌口正常搭配,或换食堂再试。`;
      }
    }
    const combo = this._buildComboFromPool(pool, prof, target, craving);
    box.innerHTML = this._comboHTML(combo, prof, target, false, thisCaf) + (missNote ? `<div class="ai-note" style="border-color:#eda35c;margin-top:.5rem">${missNote}</div>` : '') + '<div class="skeleton" style="margin-top:.7rem">AI 正在精修方案…</div>';
    this.bindComboSolo(box);
    try {
      const cr = this._parseCraving(craving);
      const mustHave = cr.terms.length ? pool.filter(d => cr.terms.some(t => d.name.includes(t))).slice(0, 3).map(d => d.name) : [];
      const shortlist = kind => pool.filter(d => kind === '主食' ? d.cat === '主食' : kind === '荤' ? d.cat === '荤菜' : kind === '素' ? d.cat === '素菜' : d.cat === '汤粥')
        .slice(0, 8).map(d => `${d.name}(${d.kcal}kcal P${d.protein})`);
      const j = await API.chatJSON([
        { role: 'system', content: '你是高校食堂营养配餐师。只输出JSON。' },
        { role: 'user', content: `用户:目标${prof.goal === '无' ? '不设目标(正常吃)' : prof.goal},过敏/忌口:${prof.allergies.join('、') || '无'}${prof.allergies.includes('辣') ? '(不吃辣)' : ''}。本餐热量目标约${target}kcal。${craving ? `\n额外口味需求:「${craving}」${mustHave.length ? `\n【硬性要求】组合中必须包含这几道菜(用户点名):${mustHave.join('、')}` : '(尽量满足,但不得违背过敏忌口)'}${cr.avoid.length ? `\n【不想吃】${cr.avoid.join('、')}:组合里不得出现名称含这些词的菜,也要避开辣/油腻/高糖等与之冲突的菜` : ''}` : ''}
本餐固定在【${thisCaf}】食堂打饭,候选全部来自该食堂(不要选用户过敏/忌口的):
主食: ${shortlist('主食').join('、')}
荤: ${shortlist('荤').join('、')}
素: ${shortlist('素').join('、')}
汤: ${shortlist('汤').join('、')}
请组成一餐(主食1+荤1+素1~2+汤0~1,合计接近目标热量),输出JSON:{"items":["菜名",...],"why":"≤60字搭配理由","swaps":"≤40字替换建议,如不喜欢X可换成Y"}` },
      ], { maxTokens: 800, temperature: 0.5 });
      const aiCombo = this._resolveCombo(j.items || [], thisCaf, pool);
      if (aiCombo.length >= 3) {
        const sum = aiCombo.reduce((s, d) => s + d.kcal, 0);
        box.innerHTML = (missNote ? `<div class="ai-note" style="border-color:#eda35c;margin-bottom:.5rem">${missNote}</div>` : '') + this._comboHTML({ items: aiCombo, sum }, prof, target, true, thisCaf, j.why, j.swaps) + this._altsHTML(pool);
        this.bindComboSolo(box);
      } else {
        box.innerHTML = this._comboHTML(combo, prof, target, false, thisCaf) + this._altsHTML(pool);
        this.bindComboSolo(box);
      }
    } catch (e) {
      box.innerHTML = this._comboHTML(combo, prof, target, false, thisCaf) + this._altsHTML(pool);
      this.bindComboSolo(box);
      toast('AI 精修失败,已展示本地算法方案(' + e.message.slice(0, 40) + ')');
    } finally { hideLoading(); }
  },
  bindComboSolo(box) {
    // 每道菜的"＋单录"按钮: 只把这一道记入今日饮食
    $$(box.querySelectorAll ? '#dine-result [data-solo]' : []).forEach(b => b.onclick = () => {
      const dish = DISH_BY_ID[b.dataset.solo];
      if (!dish) return;
      STORE.addDiary({ name: dish.name, dishId: dish.id, kcal: dish.kcal, protein: dish.protein, fat: dish.fat,
        carb: dish.carb, sodium: dish.sodium, veg: dish.veg });
      b.textContent = '已记';
      b.disabled = true;
      toast('「' + dish.name + '」已单独记入今日');
      if (typeof APP !== 'undefined') APP.renderTodayChart();
    });
    const full = $('#btn-combo-log');
    if (full && full._bound !== true) {
      full._bound = true;
      full.onclick = () => {
        const items = $$('#dine-result .combo-item [data-solo]');
        if (!items.length) return;
        items.forEach(b => {
          const dish = DISH_BY_ID[b.dataset.solo];
          if (dish && !b.disabled) {
            STORE.addDiary({ name: dish.name, dishId: dish.id, kcal: dish.kcal, protein: dish.protein, fat: dish.fat,
              carb: dish.carb, sodium: dish.sodium, veg: dish.veg });
            b.textContent = '已记'; b.disabled = true;
          }
        });
        toast('整餐已记入今日饮食');
        if (typeof APP !== 'undefined') APP.renderTodayChart();
      };
    }
  },
  _resolveCombo(names, caf, pool) {
    const seen = new Set(), out = [];
    for (const n of names) {
      let d = (DISH_BY_NAME[String(n).trim()] || []).map(id => DISH_BY_ID[id]).find(x => !caf || caf === '全校' || (x.where || []).some(w => w.caf === caf))
              || matchDish(n);
      if (d && caf && caf !== '全校' && !(d.where || []).some(w => w.caf === caf)) d = null;
      if (d && !seen.has(d.id)) { seen.add(d.id); out.push(d); }
    }
    const byCat = cat => out.some(d => d.cat === cat);
    const need = [];
    if (!byCat('主食') && !byCat('面点')) need.push('主食');
    if (!byCat('荤菜')) need.push('荤菜');
    if (out.length < 3 && !byCat('素菜')) need.push('素菜');
    for (const cat of need) {
      const cand = (pool || []).find(d => d.cat === cat && !seen.has(d.id));
      if (cand) { seen.add(cand.id); out.push(cand); }
    }
    return out;
  },
  _buildComboFromPool(pool, prof, target, craving) {
    const cr = this._parseCraving(craving);
    const crHit = cr.terms.length ? pool.filter(d => cr.terms.some(t => d.name.includes(t))) : [];
    const by = cat => pool.filter(d => d.cat === cat);
    const pick = (arr, lo, hi) => {
      const c = arr.filter(d => d.kcal >= lo && d.kcal <= hi);
      return (c.length ? c : arr)[Math.floor(Math.random() * Math.min(c.length || arr.length, 8))] || null;
    };
    const locked = [];
    const lockedIds = new Set();
    for (const d of crHit.slice(0, 3)) {
      if (!lockedIds.has(d.id)) { lockedIds.add(d.id); locked.push(d); }
    }
    const lockedKcal = locked.reduce((s, d) => s + d.kcal, 0);
    const lockedCats = new Set(locked.map(d => d.cat));
    const notLocked = arr => arr.filter(d => !lockedIds.has(d.id));
    const stapleLocked = locked.find(d => d.cat === '主食' || d.cat === '面点');
    const staple = stapleLocked || pick(notLocked(by('主食').concat(by('面点'))), target * 0.32, target * 0.55);
    const remain = target - lockedKcal - (staple && !lockedIds.has(staple.id) ? staple.kcal : 0);
    const meatLocked = locked.find(d => d.cat === '荤菜');
    const meat = meatLocked || pick(notLocked(by('荤菜')).filter(d => d.kcal < remain * 0.8), remain * 0.25, remain * 0.62) || pick(notLocked(by('荤菜')), 0, 9999);
    const vegLocked = locked.filter(d => d.cat === '素菜');
    const veg = vegLocked.length >= 1 ? vegLocked[0] : pick(notLocked(by('素菜')).filter(d => prof.goal === '减脂' ? d.kcal < 120 : d.kcal < 220), 30, 250);
    const veg2 = vegLocked.length >= 2 ? vegLocked[1] : (veg && vegLocked.length ? null : (locked.length <= 1 ? pick(notLocked(by('素菜')), 30, 250) : null));
    const soupLocked = locked.find(d => d.cat === '汤粥');
    const soup = soupLocked || (cr.wantSoup ? pick(notLocked(by('汤粥')), 60, 300) : (prof.goal === '减脂' ? null : pick(notLocked(by('汤粥')), 60, 260)));
    const items = [staple, meat, veg, veg2, soup, ...locked.filter(d => !lockedCats.has(d.cat))].filter(Boolean);
    const seen = new Set(); const uniq = items.filter(d => !seen.has(d.id) && seen.add(d.id));
    return { items: uniq, sum: uniq.reduce((s, d) => s + d.kcal, 0) };
  },
  _comboHTML(combo, prof, target, isAI, thisCaf, why, swaps) {
    const sum = combo.sum;
    const diff = Math.round(sum - target);
    const catName = d => d.cat === '荤菜' ? '荤' : d.cat === '素菜' ? '素' : d.cat === '汤粥' ? '汤' : d.cat === '面点' ? '主食' : '主食';
    return `<div class="card dine-combo">
      <div class="combo-head"><b>${isAI ? 'AI 为你搭配' : '知食算法搭配'}(${prof.goal === '无' ? '不设目标' : '目标' + prof.goal})</b>
      <span class="combo-kcal">共 ${Math.round(sum)} kcal · 目标 ${target}</span></div>
      ${thisCaf && thisCaf !== '全校' ? `<div class="sr-where" style="margin:.2rem 0 .4rem">📍 本餐全部出自:<b>${esc(thisCaf)}</b>${prof.campus === '全部' ? '(AI 自动为你选定)' : ''}</div>` : ''}
      ${combo.items.map(d => `<div class="combo-item">
        <span class="ci-cat">${catName(d)}</span>
        <span class="ci-name">${esc(d.name)}</span>
        <span class="ci-nut">${d.kcal}kcal · P${d.protein} F${d.fat}</span>
        <button class="mini-btn" data-solo="${d.id}" title="只记这一道">＋单录</button>
      </div>`).join('')}
      <div class="combo-sum">
        <span>蛋白质 ${fix(combo.items.reduce((s, d) => s + d.protein, 0))}g</span>
        <span>脂肪 ${fix(combo.items.reduce((s, d) => s + d.fat, 0))}g</span>
        <span>钠 ${Math.round(combo.items.reduce((s, d) => s + d.sodium, 0))}mg</span>
        <span style="${Math.abs(diff) <= 120 ? '' : 'background:#fdeeea;color:#c0392b'}">${diff >= 0 ? '超出' : '还差'} ${Math.abs(diff)} kcal</span>
      </div>
      ${why ? `<div class="combo-why">${esc(why)}</div>` : '<div class="combo-why">依据你的目标与忌口,从今日菜单实时搭配,避开过敏原。</div>'}
      ${swaps ? `<div class="combo-swaps">${esc(swaps)}</div>` : ''}
      <button class="btn btn-primary btn-block" id="btn-combo-log">一餐全记入</button>
    </div>`;
  },
  _altsHTML(cands) {
    const alts = cands.filter(d => d.cat === '荤菜' || d.cat === '素菜').slice(0, 6)
      .map(d => `${d.name}(${d.kcal})`).join('、');
    return `<div class="dine-alt">其他高分候选:${alts}</div>`;
  },
  bindDine() { /* 由 initMenus 承担 */ },

  /* ── 菜单浏览器 ── */
  renderMenu(append) {
    if (!append) this._shown = 80;
    const q = ($('#menu-search').value || '').trim();
    const caf = $('#menu-filter-caf').value;
    const tf = this._tagFilter;
    let list = DISHES;
    if (caf && caf !== '全部食堂') list = list.filter(d => d.where.some(w => w.caf === caf));
    if (q) { list = list.filter(d => kwMatch(d, q)); list = kwRank(list, q); }
    if (tf === 'A级') list = list.filter(d => d.grade === 'A');
    else if (tf) list = list.filter(d => (d.tags || []).includes(tf));
    const shown = list.slice(0, this._shown);
    const allCafs = d => {
      const cfs = d.where.map(w => w.caf);
      const show = cfs.slice(0, 3).join('/');
      return show + (cfs.length > 3 ? ` 等${cfs.length}处` : '');
    };
    $('#menu-list').innerHTML = shown.map(d => `<div class="menu-item" data-d="${d.id}">
      <div class="mi-name">${esc(d.name)}<small>📍 ${allCafs(d)} · ${d.cat}</small></div>
      <span class="mi-grade grade-${d.grade}">${d.grade}</span>
      <span class="mi-kcal">${d.kcal}kcal</span>
      <button class="mi-add" title="记入今日">＋</button>
    </div>`).join('') || `<div class="empty-hint">没有找到——手册可能没收录<br><button class="btn" id="btn-add-from-menu" style="margin:.5rem auto 0;font-size:0.925rem">手动添加这道菜</button></div>`;
    const addFromMenu = $('#btn-add-from-menu');
    if (addFromMenu) addFromMenu.onclick = () => { if (window.OPEN_ADD_DISH) window.OPEN_ADD_DISH(($('#menu-search').value || '').trim()); };
    $('#menu-more').hidden = list.length <= this._shown;
    $$('#menu-list .mi-add').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const d = DISH_BY_ID[b.closest('.menu-item').dataset.d];
      STORE.addDiary({ name: d.name, dishId: d.id, kcal: d.kcal, protein: d.protein, fat: d.fat, carb: d.carb, sodium: d.sodium, veg: d.veg });
      toast('已记入今日饮食'); APP.renderTodayChart();
    });
    $$('#menu-list .menu-item').forEach(it => it.onclick = () => {
      const d = DISH_BY_ID[it.dataset.d];
      SNAP_VIEW(d);
    });
  },
};

/* 从菜单浏览器跳转到识菜页展示详情 */
function SNAP_VIEW(dish) {
  document.querySelector('[data-tab="snap"]').click();
  APP.showSnapResult({ matched: dish, source: 'menu' });
  window.scrollTo({ top: 200, behavior: 'smooth' });
}

/* 关键词模糊匹配 */
function kwMatch(dish, q) {
  const hay = (dish.name + ',' + (dish.tags || []).join(',') + ',' + dish.cat).toLowerCase();
  return q.toLowerCase().split(/[\s,,，、]+/).filter(t => t).every(t => hay.includes(t));
}

/* 命中结果按匹配质量排序 */
function kwRank(hits, q) {
  const terms = q.toLowerCase().split(/[\s,,，、]+/).filter(t => t);
  const score = d => {
    const name = d.name.toLowerCase();
    let s = 0;
    for (const t of terms) {
      if (name === t) s += 100;
      else if (name.startsWith(t)) s += 50;
      else if (name.includes(t)) s += 30;
      else if ((d.tags || []).join(',').toLowerCase().includes(t) || d.cat.includes(t)) s += 8;
    }
    s -= name.length * 0.2;
    return s;
  };
  return hits.slice().sort((a, b) => score(b) - score(a));
}

/* 模糊搜索: AND优先 → OR降级 → 2~4字滑动子串 */
function kwSearch(dishes, q, limit) {
  const terms = q.toLowerCase().split(/[\s,,，、]+/).filter(t => t);
  if (!terms.length) return [];
  const ql = q.toLowerCase();
  const scored = [];
  const seen = new Set();
  const push = (d, s, t) => { if (!seen.has(d.id)) { seen.add(d.id); scored.push({ d, s, t: t || 3 }); } };
  for (const d of dishes) {
    const hay = (d.name + ',' + (d.tags || []).join(',') + ',' + d.cat).toLowerCase();
    let hits = 0;
    for (const t of terms) if (hay.includes(t)) hits++;
    if (hits === 0) continue;
    const name = d.name.toLowerCase();
    let tier = 3, bonus = 0;
    if (name === ql) { tier = 0; bonus = 100; }
    else if (name.startsWith(ql)) { tier = 1; bonus = 50; }
    else if (name.includes(ql)) { tier = 2; bonus = 30; }
    push(d, hits * 10 + bonus - name.length * 0.2, tier);
  }
  if (!scored.length) {
    for (let len = Math.min(4, q.length); len >= 2 && !scored.length; len--) {
      for (let i = 0; i + len <= q.length; i++) {
        const sub = q.slice(i, i + len).toLowerCase();
        for (const d of dishes) {
          if (d.name.toLowerCase().includes(sub)) push(d, len * 5);
        }
      }
    }
  }
  scored.sort((a, b) => b.t - a.t || b.s - a.s);
  // 前缀命中过多时(如"牛肉"有33道前缀菜且跨食堂同名重复), 把"菜名含关键词"的菜提前穿插, 避免永远搜不到
  const exact = scored.filter(x => x.t === 0), prefix = scored.filter(x => x.t === 1),
        contain = scored.filter(x => x.t === 2), rest = scored.filter(x => x.t >= 3);
  const out = (prefix.length > 12 && contain.length)
    ? exact.concat(prefix.slice(0, 12), contain, prefix.slice(12), rest)
    : exact.concat(prefix, contain, rest);
  return out.slice(0, limit || 12).map(x => x.d);
}
