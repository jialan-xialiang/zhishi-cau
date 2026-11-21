/* ═══ 知食 · 手写 Canvas 图表(零依赖) ═══ */
const CHARTS = {
  _prep(cv, h) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || cv.parentNode.clientWidth || 320;
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.height = h + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  },

  /* 雷达图: vals = [{label, v(0-100)}] */
  radar(cv, vals, color) {
    const h = 210;
    const { ctx, w } = this._prep(cv, h);
    color = color || '#e8503a';
    const cx = w / 2, cy = h / 2 + 4, R = Math.min(w, h) / 2 - 34;
    const n = vals.length;
    const ang = i => -Math.PI / 2 + i * 2 * Math.PI / n;
    ctx.strokeStyle = '#dbe7de'; ctx.lineWidth = 1;
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const r = R * ring / 4;
        const x = cx + r * Math.cos(ang(i)), y = cy + r * Math.sin(ang(i));
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(ang(i)), cy + R * Math.sin(ang(i))); ctx.stroke();
    }
    // 数据区
    ctx.beginPath();
    vals.forEach((v, i) => {
      const r = R * Math.max(0.04, Math.min(1, v.v / 100));
      const x = cx + r * Math.cos(ang(i)), y = cy + r * Math.sin(ang(i));
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(31,157,85,.18)'; ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
    vals.forEach((v, i) => {
      const r = R * Math.max(0.04, Math.min(1, v.v / 100));
      const x = cx + r * Math.cos(ang(i)), y = cy + r * Math.sin(ang(i));
      ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fillStyle = color; ctx.fill();
    });
    // 标签
    ctx.fillStyle = '#5a6f63'; ctx.font = '13px -apple-system,PingFang SC,sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    vals.forEach((v, i) => {
      const lx = cx + (R + 18) * Math.cos(ang(i)), ly = cy + (R + 14) * Math.sin(ang(i));
      ctx.fillText(v.label, lx, ly);
    });
  },

  /* 折线: pts=[{label,v}] */
  line(cv, pts) {
    const h = 190;
    const { ctx, w } = this._prep(cv, h);
    const pad = { l: 34, r: 10, t: 14, b: 24 };
    const vals = pts.map(p => p.v);
    let mx = Math.max(...vals, 1), mn = Math.min(...vals, 0);
    mx += (mx - mn) * 0.12;
    const X = i => pad.l + (w - pad.l - pad.r) * i / Math.max(1, pts.length - 1);
    const Y = v => pad.t + (h - pad.t - pad.b) * (1 - (v - mn) / (mx - mn || 1));
    ctx.strokeStyle = '#e3ece6'; ctx.fillStyle = '#8fa398'; ctx.font = '12px sans-serif';
    for (let g = 0; g <= 3; g++) {
      const v = mn + (mx - mn) * g / 3, y = Y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(Math.round(v), pad.l - 4, y + 3);
    }
    // 面积
    const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
    grad.addColorStop(0, 'rgba(31,157,85,.25)'); grad.addColorStop(1, 'rgba(31,157,85,0)');
    ctx.beginPath();
    pts.forEach((p, i) => { const x = X(i), y = Y(p.v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.lineTo(X(pts.length - 1), h - pad.b); ctx.lineTo(X(0), h - pad.b); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    // 线
    ctx.beginPath();
    pts.forEach((p, i) => { const x = X(i), y = Y(p.v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = '#e8503a'; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.fillStyle = '#e8503a';
    ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    pts.forEach((p, i) => {
      const x = X(i), y = Y(p.v);
      ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#5a6f63'; ctx.fillText(p.label, x, h - 8);
      ctx.fillStyle = '#e8503a';
    });
  },

  /* 柱状: bars=[{label,v,color}], 横向 */
  bars(cv, bars) {
    const h = bars.length * 30 + 14;
    const { ctx, w } = this._prep(cv, h);
    const mx = Math.max(...bars.map(b => Math.abs(b.v)), 1);
    const bw = (h - 14) / bars.length;
    bars.forEach((b, i) => {
      const y = 8 + i * bw;
      ctx.fillStyle = '#eef4ef';
      this._rr(ctx, 92, y + 3, w - 100, bw - 9, 7); ctx.fill();
      const W = (w - 100) * Math.min(1, Math.abs(b.v) / mx);
      ctx.fillStyle = b.color || '#e8503a';
      this._rr(ctx, 92, y + 3, Math.max(6, W), bw - 9, 7); ctx.fill();
      ctx.fillStyle = '#1c2b24'; ctx.font = '14px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(b.label, 0, y + bw / 2 - 1);
      ctx.fillStyle = '#5a6f63'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(b.show != null ? b.show : Math.round(b.v) + (b.unit || ''), 88, y + bw / 2 - 1);
    });
  },
  _rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },
};
