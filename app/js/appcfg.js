/* ═══ 知食 · 配置与 AI 通道 ═══
   统一走蚂蚁MaaS: 免费ling模型 + 积分deepseek模型,由代理模式(server.py/云端)接管。
   公开仓库不含密钥;服务端密钥经 ant_key.txt 注入(不入库)。 */

window.DEPLOY_KEY = null;

const CFG = {
  PRESETS: [],
  defaults: {
    mode: 'proxy',
    base: '',
    key: '',
    model: '',
    vmodel: '',
  },
  s: null,
  load() {
    try { this.s = JSON.parse(localStorage.getItem('zhishi_cfg') || 'null') || {}; }
    catch (e) { this.s = {}; }
    if (window.DEPLOY_KEY && !this.s.key) { Object.assign(this.s, window.DEPLOY_KEY, { mode: 'direct' }); }
    this.s = Object.assign({}, this.defaults, this.s);
    return this.s;
  },
  save() { localStorage.setItem('zhishi_cfg', JSON.stringify(this.s)); },
  get(k) { if (!this.s) this.load(); return this.s[k]; },
  set(k, v) { if (!this.s) this.load(); this.s[k] = v; this.save(); },
};

/* 全局工具 */
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function toast(msg, ms) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(t._tm); t._tm = setTimeout(() => { t.hidden = true; }, ms || 2400);
}
function showLoading(text) { $('#loading-text').textContent = text || 'AI 思考中…'; $('#loading').hidden = false; }
function hideLoading() { $('#loading').hidden = true; }
