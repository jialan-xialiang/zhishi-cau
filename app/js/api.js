/* ═══ 知食 · AI 客户端 ═══
   direct: 浏览器直连(DeepSeek/硅基流动/百炼/Kimi,均支持CORS)
   proxy : 经本地 server.py 转发(蚂蚁MaaS,路演模式)
   - 429/网络错误自动重试(退避)
   - SSE 流式解析(含 reasoning_content 推理模型)
   - JSON 容错提取 + 一次修复重试
   - 视觉独立路由(无视觉模型时抛 NO_VISION)
*/
const API = {
  _last: 0,
  _gate() {
    const gap = 450, now = Date.now();
    if (now - this._last < gap) return new Promise(r => setTimeout(r, gap - (now - this._last))).then(() => { this._last = Date.now(); });
    this._last = now;
    return Promise.resolve();
  },

  endpoint() { return CFG.get('mode') === 'proxy' ? '/api/chat' : (CFG.get('base').replace(/\/+$/, '') + '/chat/completions'); },
  hasVision() {
    if (CFG.get('mode') === 'proxy') return true;
    return !!CFG.get('vmodel');
  },
  NO_VISION: 'NO_VISION',

  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (CFG.get('mode') !== 'proxy' && CFG.get('key')) h.Authorization = 'Bearer ' + CFG.get('key');
    return h;
  },

  /* 主入口: chat(messages, opts)
     opts: {maxTokens, temperature, stream(fn), model, json} */
  async chat(messages, opts) {
    opts = opts || {};
    const maxRetry = 3;
    let lastErr = null;
    for (let a = 0; a <= maxRetry; a++) {
      try {
        await this._gate();
        const body = {
          model: opts.model || CFG.get('model'),
          messages,
          max_tokens: opts.maxTokens || 1500,
          temperature: opts.temperature == null ? 0.5 : opts.temperature,
          stream: !!opts.stream,
        };
        const resp = await fetch(this.endpoint(), { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
        if (resp.status === 429 || resp.status === 502 || resp.status === 503) {
          lastErr = new Error('HTTP ' + resp.status);
          await new Promise(r => setTimeout(r, 900 * Math.pow(2, a) + Math.random() * 400));
          continue;
        }
        if (!resp.ok) {
          let msg = 'HTTP ' + resp.status;
          try { const j = await resp.json(); msg = (j.error && j.error.message) || msg; } catch (e) {}
          throw new Error(msg);
        }
        if (opts.stream && resp.body) {
          return await this._readSSE(resp, opts.stream);
        }
        const data = await resp.json();
        const m = data.choices && data.choices[0] && data.choices[0].message;
        let txt = (m && m.content) || '';
        if (!txt && m && m.reasoning_content) txt = m.reasoning_content; // 输出被截断的推理模型兜底
        return txt;
      } catch (e) {
        lastErr = e;
        if (String(e.message).indexOf('Failed to fetch') >= 0 || String(e.message).indexOf('NetworkError') >= 0) {
          await new Promise(r => setTimeout(r, 700 * (a + 1)));
          continue;
        }
        if (a >= maxRetry) throw e;
      }
    }
    throw lastErr || new Error('AI 调用失败');
  },

  async _readSSE(resp, onDelta) {
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '', full = '', think = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith('data:')) continue;
        const payload = s.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const j = JSON.parse(payload);
          const d = j.choices && j.choices[0] && j.choices[0].delta || {};
          if (d.reasoning_content) { think += d.reasoning_content; if (onDelta) onDelta({ think }, full); }
          if (d.content) { full += d.content; if (onDelta) onDelta(null, full); }
        } catch (e) {}
      }
    }
    return full;
  },

  /* JSON 任务: 生成→解析失败自动重试一次 */
  async chatJSON(messages, opts) {
    opts = Object.assign({ temperature: 0.3, maxTokens: 1600 }, opts || {});
    const sys = (messages[0] && messages[0].role === 'system') ? messages[0].content : '';
    const insist = (sys ? sys + '\n' : '') + '【重要】只输出一个合法JSON(双引号,无注释),不要markdown代码块,不要解释文字。';
    const msgs = sys ? [{ role: 'system', content: insist }, ...messages.slice(1)] : messages;
    for (let i = 0; i < 2; i++) {
      const txt = await this.chat(msgs, opts);
      const parsed = this.extractJSON(txt);
      if (parsed != null) return parsed;
      msgs.push({ role: 'assistant', content: txt.slice(0, 600) });
      msgs.push({ role: 'user', content: '上面的输出不是合法JSON。请重新输出,只输出JSON本身,不要任何其他文字。' });
    }
    throw new Error('AI 未返回合法 JSON');
  },

  extractJSON(txt) {
    if (!txt) return null;
    let s = String(txt).trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    const tryParse = (str) => { try { return JSON.parse(str); } catch (e) { return null; } };
    let v = tryParse(s);
    if (v != null) return v;
    for (const [a, b] of [['[', ']'], ['{', '}']]) {
      const i = s.indexOf(a), j = s.lastIndexOf(b);
      if (i >= 0 && j > i) { v = tryParse(s.slice(i, j + 1)); if (v != null) return v; }
    }
    // 常见修复: 尾部多余逗号
    v = tryParse(s.replace(/,\s*([\]}])/g, '$1'));
    return v;
  },

  /* 视觉识别: imageDataUrl → 文本(推理模型思考过长时,从思考内容兜底提取JSON) */
  async vision(imageDataUrl, prompt, opts) {
    opts = opts || {};
    if (CFG.get('mode') === 'proxy') {
      const resp = await fetch('/api/vision', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageDataUrl, prompt, max_tokens: opts.maxTokens || 4000 }) });
      if (!resp.ok) throw new Error('视觉服务 HTTP ' + resp.status);
      const j = await resp.json();
      const m = j.choices && j.choices[0] && j.choices[0].message || {};
      let txt = m.content || '';
      if (!txt && m.reasoning_content) txt = m.reasoning_content;
      return txt;
    }
    if (!CFG.get('vmodel')) throw new Error(this.NO_VISION);
    const messages = [{ role: 'user', content: [
      { type: 'image_url', image_url: { url: imageDataUrl } },
      { type: 'text', text: prompt },
    ] }];
    return this.chat(messages, { model: CFG.get('vmodel'), maxTokens: opts.maxTokens || 4000, temperature: 0.2 });
  },
};

/* 按天缓存(省钱): key → {date, data} */
const CACHE = {
  get(k, maxAgeH) {
    try {
      const v = JSON.parse(localStorage.getItem('zhishi_cache_' + k) || 'null');
      if (!v) return null;
      if (v.date !== todayStr()) return null;
      return v.data;
    } catch (e) { return null; }
  },
  set(k, data) {
    try { localStorage.setItem('zhishi_cache_' + k, JSON.stringify({ date: todayStr(), data })); } catch (e) {}
  },
};
