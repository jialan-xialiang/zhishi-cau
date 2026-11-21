/* ═══ 知食 · 本地数据仓库(档案/饮食日记/评价/打卡) ═══ */
const STORE = {
  GOAL_KCAL: { '无': 2000, '减脂': 1500, '增肌': 2600, '控糖': 1800, '均衡': 2100 },
  GOAL_MEAL: { '无': 700, '减脂': 520, '增肌': 900, '控糖': 620, '均衡': 700 },

  profile: null,
  diary: null,     // { 'YYYY-MM-DD': [entries] }
  reviews: null,   // 本机提交的评价
  flags: null,     // checkins / badges 等
  uid: '',         // 游客设备稳定ID(首次访问生成,持久)
  nick: '',        // 昵称(可改)

  /* ── 游客身份:一台设备 = 一个稳定身份 ── */
  identity() {
    let uid = localStorage.getItem('zhishi_uid');
    if (!uid) {
      uid = 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('zhishi_uid', uid);
    }
    this.uid = uid;
    let nick = localStorage.getItem('zhishi_nick');
    if (!nick) {
      nick = '干饭' + ['小熊', '小鹅', '小禾', '小谷', '小鹿', '小鲤', '小雀'][Math.floor(Math.random() * 7)] + '#' + String(Math.floor(Math.random() * 9000) + 1000);
      localStorage.setItem('zhishi_nick', nick);
    }
    this.nick = nick;
    return { uid, nick };
  },
  setNick(n) {
    n = (n || '').trim().slice(0, 12);
    if (!n) return Promise.resolve({ ok: false, error: 'empty' });
    const old = this.nick;
    this.nick = n;
    localStorage.setItem('zhishi_nick', n);
    if (!window.__ZHISHI_SERVER) return Promise.resolve({ ok: true });
    // 服务端昵称注册(全站唯一,冲突则回滚)
    return fetch('/api/nick', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: this.uid, nick: n }) })
      .then(r => r.json())
      .then(j => {
        if (j.ok) return { ok: true };
        this.nick = old; localStorage.setItem('zhishi_nick', old);
        return { ok: false, error: j.error || 'fail' };
      })
      .catch(() => ({ ok: true })); // 服务端不可达时本地生效(下次联网注册)
  },
  /* 服务端就绪后注册当前昵称;重名自动加随机后缀 */
  registerNick() {
    if (!window.__ZHISHI_SERVER) return;
    return fetch('/api/nick', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: this.uid, nick: this.nick }) })
      .then(r => r.json())
      .then(j => {
        if (j.ok) return true;
        // 昵称被占用: 加随机后缀重试
        const n2 = this.nick.slice(0, 8) + '#' + String(Math.floor(Math.random() * 9000) + 1000);
        return fetch('/api/nick', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: this.uid, nick: n2 }) })
          .then(r => r.json())
          .then(j2 => {
            if (j2.ok) { this.nick = n2; localStorage.setItem('zhishi_nick', n2); }
            return !!j2.ok;
          });
      })
      .catch(() => false);
  },

  _load(k, def) {
    try { return JSON.parse(localStorage.getItem('zhishi_' + k) || 'null') ?? def; }
    catch (e) { return def; }
  },
  _save(k, v) { localStorage.setItem('zhishi_' + k, JSON.stringify(v)); },

  init() {
    this.profile = this._load('profile', { goal: '均衡', allergies: [], campus: '全部', dislike: [] });
    this.diary = this._load('diary', {});
    this.reviews = this._load('reviews', []);
    this.flags = this._load('flags', { demoLoaded: false });
  },
  setProfile(p) { this.profile = p; this._save('profile', p); },
  /* 每日目标热量: 用户自定义优先, 否则按健康目标档位自动计算 */
  targetKcal() { const t = Math.round(+this.profile.targetKcal); return t > 0 ? t : (this.GOAL_KCAL[this.profile.goal] || 2100); },

  /* ── 饮食日记 ── */
  mealNow() { const h = new Date().getHours(); return h < 10 ? '早' : (h < 15 ? '午' : (h < 21 ? '晚' : '夜宵')); },
  addDiary(entry) {
    const d = todayStr();
    if (!this.diary[d]) this.diary[d] = [];
    entry.id = Date.now() + Math.random().toString(16).slice(2, 6);
    entry.date = d;
    entry.meal = entry.meal || this.mealNow();
    this.diary[d].push(entry);
    this._save('diary', this.diary);
    return entry;
  },
  delDiary(date, id) {
    if (this.diary[date]) { this.diary[date] = this.diary[date].filter(x => x.id !== id); this._save('diary', this.diary); }
  },
  todayDiary() { return this.diary[todayStr()] || []; },
  dayKcal(d) { return (this.diary[d] || []).reduce((s, x) => s + (x.kcal || 0), 0); },
  weekDiary() {
    // 自然周: 本周一  周日(未来几天为空)
    const now = new Date();
    const dow = (now.getDay() + 6) % 7; // 周一=0
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
    const out = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const ds = todayStr(dt);
      const isFuture = dt.getTime() > now.getTime() && ds !== todayStr();
      out.push({ date: ds, label: ['一', '二', '三', '四', '五', '六', '日'][i], future: isFuture, items: isFuture ? [] : (this.diary[ds] || []) });
    }
    return out;
  },
  clearDiary() { this.diary = {}; this._save('diary', this.diary); },
  loadDemo() {
    // 生成一周"真实感"演示饮食: 控钠筛选(单餐钠≤1300,全日≤2400,真实但可改善)
    const pick = (cat, lo, hi, naMax) => {
      let pool = DISHES.filter(d => d.cat === cat && d.kcal >= lo && d.kcal <= hi && d.grade !== 'D' && (d.sodium || 0) <= naMax);
      if (!pool.length) pool = DISHES.filter(d => d.cat === cat && d.grade !== 'D' && (d.sodium || 0) <= naMax);
      if (!pool.length) return null;
      return pool[Math.floor(Math.random() * Math.min(pool.length, 14))];
    };
    const plan = () => {
      const mains = [pick('主食', 250, 480, 380), pick('面食', 350, 650, 500)];
      const meats = [pick('荤菜', 90, 380, 600), pick('素菜', 40, 220, 300), pick('素菜', 30, 200, 300)];
      const soup = [pick('汤粥', 60, 240, 380)];
      return [mains, meats, soup].flat().filter(Boolean);
    };
    const now = new Date();
    const dow = (now.getDay() + 6) % 7; // 周一=0
    // 覆盖本周一  昨天(自然周)
    for (let i = dow; i >= 1; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const ds = todayStr(dt);
      if (this.diary[ds] && this.diary[ds].length) continue;
      const entries = [];
      // 早: 主食+蛋
      const brPool = DISHES.filter(d => d.cat === '主食' && d.kcal < 300);
      const br = brPool[Math.floor(Math.random() * Math.min(brPool.length, 8))];
      if (br) entries.push({ name: br.name, dishId: br.id, kcal: br.kcal, protein: br.protein, fat: br.fat, carb: br.carb, sodium: br.sodium, veg: br.veg, meal: '早' });
      const eggIds = DISH_BY_NAME['茶叶蛋'] || [];
      const egg = DISH_BY_ID[eggIds[0]] || DISHES.filter(d => d.name.includes('蛋') && d.kcal < 120)[0];
      if (egg) entries.push({ name: egg.name, dishId: egg.id, kcal: egg.kcal, protein: egg.protein, fat: egg.fat, carb: egg.carb, sodium: egg.sodium, veg: egg.veg, meal: '早' });
      // 午晚: 各一顿完整组合
      for (const meal of ['午', '晚']) {
        const seenN = new Set();
        plan('均衡').forEach(d => {
          if (seenN.has(d.id)) return;
          seenN.add(d.id);
          entries.push({ name: d.name, dishId: d.id, kcal: d.kcal, protein: d.protein, fat: d.fat, carb: d.carb, sodium: d.sodium, veg: d.veg, meal });
        });
      }
      this.diary[ds] = entries.map(e => Object.assign({ id: Math.random().toString(36).slice(2, 9), date: ds }, e));
    }
    // 今天: 只预置早餐+午餐(晚上还没吃,更真实)
    const td = todayStr();
    if (!this.diary[td] || !this.diary[td].length) {
      const entries = [];
      const brPool = DISHES.filter(d => d.cat === '主食' && d.kcal < 300);
      const br = brPool[Math.floor(Math.random() * Math.min(brPool.length, 8))];
      if (br) entries.push({ meal: '早', name: br.name, dishId: br.id, kcal: br.kcal, protein: br.protein, fat: br.fat, carb: br.carb, sodium: br.sodium, veg: br.veg });
      const lunch = plan('均衡').slice(0, 4);
      lunch.forEach(d => entries.push({ meal: '午', name: d.name, dishId: d.id, kcal: d.kcal, protein: d.protein, fat: d.fat, carb: d.carb, sodium: d.sodium, veg: d.veg }));
      this.diary[td] = entries.map(e => Object.assign({ id: Math.random().toString(36).slice(2, 9), date: td }, e));
    }
    this._save('diary', this.diary);
  },

  /* ── 评价(本机) ── */
  addReview(r) {
    r.id = Date.now() + Math.random().toString(16).slice(2, 6);
    r.time = Date.now();
    r.local = true;
    this.reviews.unshift(r);
    if (this.reviews.length > 400) this.reviews.length = 400;
    this._save('reviews', this.reviews);
    return r;
  },
  /* 只清本地评价副本(云端已有主副本); 档案/日记/身份/自定义菜一律不动 */
  clearMyReviews() {
    this.reviews = [];
    this._save('reviews', []);
  },
  myReviews() { return this.reviews; },

  /* ── 打卡徽章 ── */
  setFlag(k, v) { this.flags[k] = v; this._save('flags', this.flags); },

  /* ── 用户手动添加的菜品(众包补全手册) ── */
  custom: [],
  loadCustom() {
    this.custom = this._load('custom', []);
    this.custom.forEach(d => this._mergeDish(d));
  },
  _mergeDish(d) {
    if (DISH_BY_ID[d.id]) return; // 已存在不重复加(同名菜不同食堂是不同实体)
    DISHES.push(d); DISH_BY_ID[d.id] = d;
    (DISH_BY_NAME[d.name] = DISH_BY_NAME[d.name] || []).push(d.id);
  },
  addCustomDish(name, caf, win, nutri) {
    const d = nutri || {};
    const obj = {
      id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name, cat: d.cat || '荤菜',
      kcal: Math.round(d.kcal || 350), protein: Math.round((d.protein || 15) * 10) / 10,
      fat: Math.round((d.fat || 15) * 10) / 10, carb: Math.round((d.carb || 40) * 10) / 10,
      sodium: Math.round(d.sodium || 600), fiber: d.fiber || 1.5, veg: d.veg || 1,
      tags: (d.tags || []).slice(0, 4), allergens: d.allergens || [],
      grade: d.grade || 'B', desc: d.desc || '用户添加菜品',
      where: [{ caf, win: win || '自添加窗口' }],
      custom: true,
    };
    this.custom.push(obj);
    this._save('custom', this.custom);
    this._mergeDish(obj);
    return obj;
  },
};
