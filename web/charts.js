// Small canvas chart kit: sparklines, time-series (crosshair + tooltip), stacked bars, histograms.

export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function setup(canvas) {
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, r.width), h = Math.max(1, r.height);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function alpha(color, a) {
  if (color.startsWith("#")) {
    const n = parseInt(color.slice(1).padEnd(6, "0").slice(0, 6), 16);
    return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
  }
  return color;
}

export function niceTicks(lo, hi, n = 4) {
  if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
  if (hi - lo < 1e-9) hi = lo + 1;
  const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let v = Math.floor(lo / step + 1e-9) * step; v < hi + step * 0.999; v += step) out.push(+v.toFixed(8));
  if (out.length < 2) out.push(out[0] + step);
  return out;
}

const TIME_STEPS = [60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400, 172800];
function timeTicks(t0, t1, target = 5) {
  const step = TIME_STEPS.find((s) => (t1 - t0) / s <= target) || 86400 * 7;
  const tz = new Date().getTimezoneOffset() * 60;
  const out = [];
  for (let t = Math.ceil((t0 - tz) / step) * step + tz; t <= t1; t += step) out.push(t);
  return { ticks: out, step };
}
function fmtTick(t, step) {
  const d = new Date(t * 1000);
  if (step >= 86400) return d.toLocaleDateString([], { weekday: "short", day: "numeric" });
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function makeTip(container) {
  let tip = container.querySelector(".tip");
  if (!tip) { tip = document.createElement("div"); tip.className = "tip"; container.append(tip); }
  return tip;
}
function fillTip(tip, header, rows) {
  tip.replaceChildren();
  const h = document.createElement("div"); h.className = "h"; h.textContent = header; tip.append(h);
  for (const r of rows) {
    const row = document.createElement("div"); row.className = "r";
    const key = document.createElement("i"); key.style.background = r.color;
    const b = document.createElement("b"); b.textContent = r.value;
    const s = document.createElement("span"); s.textContent = r.label;
    row.append(key, b, s); tip.append(row);
  }
}
function placeTip(tip, x, w, top = 8) {
  tip.style.display = "block";
  const tw = tip.offsetWidth;
  tip.style.left = (x + 14 + tw > w ? x - tw - 14 : x + 14) + "px";
  tip.style.top = top + "px";
}

// ---------------------------------------------------------------- sparkline
export function sparkline(canvas, values, colorVar = "--neutral-line") {
  const { ctx, w, h } = setup(canvas);
  const v = values.map((x) => (x == null ? null : +x));
  const nums = v.filter((x) => x != null);
  if (nums.length < 2) return;
  let lo = Math.min(...nums), hi = Math.max(...nums);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const pad = 3, x = (i) => pad + (i / (v.length - 1)) * (w - pad * 2), y = (val) => h - pad - ((val - lo) / (hi - lo)) * (h - pad * 2);
  ctx.strokeStyle = cssVar(colorVar); ctx.lineWidth = 1.6; ctx.lineJoin = "round"; ctx.lineCap = "round";
  ctx.beginPath();
  let pen = false;
  v.forEach((val, i) => {
    if (val == null) { pen = false; return; }
    pen ? ctx.lineTo(x(i), y(val)) : ctx.moveTo(x(i), y(val)); pen = true;
  });
  ctx.stroke();
}

// ---------------------------------------------------------------- time series
export class TimeChart {
  constructor(container, opts) {
    this.el = container; this.o = opts; this.data = null; this.hover = null;
    this.canvas = container.querySelector("canvas") || container.appendChild(document.createElement("canvas"));
    this.tip = makeTip(container);
    container.addEventListener("pointermove", (e) => { this.hover = e.clientX - container.getBoundingClientRect().left; this.draw(); });
    container.addEventListener("pointerleave", () => { this.hover = null; this.draw(); });
    new ResizeObserver(() => this.draw()).observe(container);
  }
  update(data) { this.data = data; this.draw(); }
  draw() {
    const { ctx, w, h } = setup(this.canvas);
    const o = this.o, d = this.data;
    if (!d) return;
    const pad = { l: 50, r: 10, t: 10, b: 26 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    const t1 = d.now, t0 = d.now - d.range;
    const x = (t) => pad.l + ((t - t0) / (t1 - t0)) * pw;
    const pts = d.points.filter((p) => p.t >= t0 - d.bucket);

    // y domain
    let vals = [];
    for (const s of o.series) for (const p of pts) if (p[s.key] != null) vals.push(o.map ? o.map(p[s.key], s.key) : p[s.key]);
    let lo = o.yMin != null ? o.yMin : Math.min(...vals), hi = Math.max(...vals);
    if (!vals.length) { lo = o.yMin ?? 0; hi = o.yEmptyMax ?? 1; }
    if (o.yMaxMin != null) hi = Math.max(hi, o.yMaxMin);
    if (o.yPad) { lo -= o.yPad; hi += o.yPad; }
    const ticks = niceTicks(lo, hi, o.ticks || 4);
    lo = ticks[0]; hi = ticks[ticks.length - 1];
    const y = (v) => pad.t + ph - ((v - lo) / (hi - lo)) * ph;

    // outage bands
    ctx.fillStyle = cssVar("--band-bad");
    for (const b of d.outages || []) {
      const a = Math.max(x(b.start), pad.l), z = Math.min(x(b.end), pad.l + pw);
      if (z > a) ctx.fillRect(a, pad.t, Math.max(2, z - a), ph);
    }
    // zones (e.g. signal quality)
    for (const zn of o.zones || []) {
      const a = y(Math.min(hi, zn.to)), z = y(Math.max(lo, zn.from));
      if (z <= a) continue;
      ctx.fillStyle = alpha(cssVar(zn.color), zn.alpha ?? 0.06); ctx.fillRect(pad.l, a, pw, z - a);
    }
    // grid + y labels
    ctx.font = `10.5px ${cssVar("--mono")}`; ctx.textBaseline = "middle"; ctx.textAlign = "right";
    ctx.strokeStyle = cssVar("--grid"); ctx.fillStyle = cssVar("--text-3"); ctx.lineWidth = 1;
    for (const t of ticks) {
      const yy = Math.round(y(t)) + 0.5;
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(pad.l + pw, yy); ctx.stroke();
      ctx.fillText(o.yFmt(t), pad.l - 8, yy);
    }
    // x labels
    const { ticks: xt, step } = timeTicks(t0, t1, Math.max(3, Math.floor(pw / 130)));
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const t of xt) ctx.fillText(fmtTick(t, step), x(t), pad.t + ph + 9);

    // series
    const gap = Math.max(d.bucket * 3.5, 8);
    for (const s of o.series) {
      const color = cssVar(s.color);
      const segs = []; let cur = [];
      for (const p of pts) {
        const v = p[s.key];
        if (v == null || (cur.length && p.t - cur[cur.length - 1].t > gap)) { if (cur.length) segs.push(cur); cur = []; }
        if (v != null) cur.push({ t: p.t, v: o.map ? o.map(v, s.key) : v });
      }
      if (cur.length) segs.push(cur);
      for (const seg of segs) {
        if (s.area) {
          const g = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
          g.addColorStop(0, alpha(color, s.areaAlpha ?? 0.32)); g.addColorStop(1, alpha(color, 0));
          ctx.fillStyle = g; ctx.beginPath();
          ctx.moveTo(x(seg[0].t), y(lo));
          for (const p of seg) ctx.lineTo(x(p.t), y(p.v));
          ctx.lineTo(x(seg[seg.length - 1].t), y(lo)); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = color; ctx.lineWidth = s.width || 1.8; ctx.lineJoin = "round"; ctx.lineCap = "round";
        ctx.beginPath();
        seg.forEach((p, i) => (i ? ctx.lineTo(x(p.t), y(p.v)) : ctx.moveTo(x(p.t), y(p.v))));
        if (seg.length === 1) ctx.arc(x(seg[0].t), y(seg[0].v), 1.5, 0, 7);
        ctx.stroke();
      }
    }

    // crosshair
    if (this.hover != null && pts.length && this.hover >= pad.l - 10) {
      const p = pts.reduce((a, b) => (Math.abs(x(b.t) - this.hover) < Math.abs(x(a.t) - this.hover) ? b : a));
      const px = x(p.t);
      ctx.strokeStyle = cssVar("--text-3"); ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(Math.round(px) + 0.5, pad.t); ctx.lineTo(Math.round(px) + 0.5, pad.t + ph); ctx.stroke();
      ctx.setLineDash([]);
      const rows = [];
      for (const s of o.series) {
        const v = p[s.key];
        if (v != null) {
          const vv = o.map ? o.map(v, s.key) : v;
          ctx.fillStyle = cssVar(s.color); ctx.beginPath(); ctx.arc(px, y(vv), 4, 0, 7); ctx.fill();
          ctx.strokeStyle = cssVar("--card"); ctx.lineWidth = 2; ctx.stroke();
        }
        rows.push({ color: cssVar(s.color), label: s.label, value: v == null ? "no data" : o.tipFmt(v, s.key, p) });
      }
      const extra = o.tipExtra ? o.tipExtra(p) : null;
      if (extra) rows.push({ color: "transparent", label: "", value: extra });
      const when = new Date(p.t * 1000);
      const head = (d.range > 86400 ? when.toLocaleDateString([], { weekday: "short", day: "numeric" }) + " " : "") +
        when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: d.bucket < 60 ? "2-digit" : undefined, hour12: false });
      fillTip(this.tip, head, rows);
      placeTip(this.tip, px, w);
    } else this.tip.style.display = "none";
  }
}

// ---------------------------------------------------------------- stacked bars
export class BarChart {
  constructor(container, opts) {
    this.el = container; this.o = opts; this.bars = []; this.hover = -1;
    this.canvas = container.querySelector("canvas") || container.appendChild(document.createElement("canvas"));
    this.tip = makeTip(container);
    container.addEventListener("pointermove", (e) => {
      const r = container.getBoundingClientRect(); this.hx = e.clientX - r.left; this.draw();
    });
    container.addEventListener("pointerleave", () => { this.hx = null; this.draw(); });
    new ResizeObserver(() => this.draw()).observe(container);
  }
  update(bars, extra = {}) { this.bars = bars; Object.assign(this.o, extra); this.draw(); }
  draw() {
    const { ctx, w, h } = setup(this.canvas);
    const o = this.o, bars = this.bars;
    if (!bars.length) return;
    const pad = { l: 54, r: 6, t: 10, b: 24 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    const totals = bars.map((b) => o.stacks.reduce((s, k) => s + (b[k.key] || 0), 0));
    const max = Math.max(...totals, o.minMax || 1);
    // binary units (KB/MB/GB): pick nice ticks in the display unit so labels read 250 MB, 500 MB...
    const div = o.binary ? 1024 ** Math.max(0, Math.floor(Math.log(max) / Math.log(1024))) : 1;
    const ticks = niceTicks(0, max / div, 3).map((t) => t * div);
    const hi = ticks[ticks.length - 1];
    const y = (v) => pad.t + ph - (v / hi) * ph;
    ctx.font = `10.5px ${cssVar("--mono")}`; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.strokeStyle = cssVar("--grid"); ctx.fillStyle = cssVar("--text-3"); ctx.lineWidth = 1;
    for (const t of ticks) {
      const yy = Math.round(y(t)) + 0.5;
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(pad.l + pw, yy); ctx.stroke();
      ctx.fillText(o.yFmt(t), pad.l - 8, yy);
    }
    const slot = pw / bars.length, bw = Math.max(2, Math.min(34, slot - Math.max(2, slot * 0.22)));
    const hoverI = this.hx == null ? -1 : Math.floor((this.hx - pad.l) / slot);
    const every = Math.ceil(bars.length / Math.max(2, Math.floor(pw / 46)));
    bars.forEach((b, i) => {
      const cx = pad.l + slot * i + slot / 2, x0 = cx - bw / 2;
      let base = 0;
      const visible = o.stacks.filter((k) => (b[k.key] || 0) > 0);
      o.stacks.forEach((k) => {
        const v = b[k.key] || 0;
        if (!v) return;
        const top = y(base + v), bottom = y(base);
        const isTop = k === visible[visible.length - 1];
        const hgt = Math.max(1, bottom - top - (base > 0 ? 2 : 0)); // 2px surface gap between segments
        ctx.fillStyle = cssVar(k.color);
        if (hoverI >= 0 && hoverI !== i) ctx.globalAlpha = 0.45;
        ctx.beginPath();
        if (isTop && ctx.roundRect) ctx.roundRect(x0, top, bw, hgt, [Math.min(4, bw / 2), Math.min(4, bw / 2), 0, 0]);
        else ctx.rect(x0, top, bw, hgt);
        ctx.fill(); ctx.globalAlpha = 1;
        base += v;
      });
      if (!base) { ctx.fillStyle = cssVar("--grid"); ctx.fillRect(x0, y(0) - 1, bw, 1); }
      if (i % every === 0 || i === bars.length - 1 && bars.length < 10) {
        ctx.fillStyle = cssVar("--text-3"); ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(o.xFmt(b), cx, pad.t + ph + 8);
      }
    });
    if (hoverI >= 0 && hoverI < bars.length) {
      const b = bars[hoverI];
      fillTip(this.tip, o.tipTitle(b), [
        ...o.stacks.map((k) => ({ color: cssVar(k.color), label: k.label, value: o.valFmt(b[k.key] || 0) })),
        ...(o.tipExtra ? [{ color: "transparent", label: "", value: o.tipExtra(b) }] : []),
      ]);
      placeTip(this.tip, pad.l + slot * hoverI + slot / 2, w);
    } else this.tip.style.display = "none";
  }
}

// ---------------------------------------------------------------- histogram
export class Histogram {
  constructor(container, opts) {
    this.el = container; this.o = opts; this.bins = [];
    this.canvas = container.querySelector("canvas") || container.appendChild(document.createElement("canvas"));
    this.tip = makeTip(container);
    container.addEventListener("pointermove", (e) => { this.hx = e.clientX - container.getBoundingClientRect().left; this.draw(); });
    container.addEventListener("pointerleave", () => { this.hx = null; this.draw(); });
    new ResizeObserver(() => this.draw()).observe(container);
  }
  update(bins) { this.bins = bins; this.draw(); }
  draw() {
    const { ctx, w, h } = setup(this.canvas);
    const o = this.o, bins = this.bins;
    if (!bins.length) return;
    const pad = { l: 8, r: 8, t: 8, b: 22 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    const total = bins.reduce((a, b) => a + b, 0) || 1, hi = Math.max(...bins, 1);
    const slot = pw / bins.length, bw = Math.max(2, slot - 2);
    const hoverI = this.hx == null ? -1 : Math.floor((this.hx - pad.l) / slot);
    ctx.strokeStyle = cssVar("--grid"); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t + ph + 0.5); ctx.lineTo(pad.l + pw, pad.t + ph + 0.5); ctx.stroke();
    bins.forEach((v, i) => {
      if (!v) return;
      const bh = Math.max(1.5, (v / hi) * ph), x0 = pad.l + i * slot + 1;
      ctx.fillStyle = cssVar(o.color);
      if (hoverI >= 0 && hoverI !== i) ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x0, pad.t + ph - bh, bw, bh, [Math.min(3, bw / 2), Math.min(3, bw / 2), 0, 0]) : ctx.rect(x0, pad.t + ph - bh, bw, bh);
      ctx.fill(); ctx.globalAlpha = 1;
    });
    ctx.font = `10.5px ${cssVar("--mono")}`; ctx.fillStyle = cssVar("--text-3"); ctx.textBaseline = "top";
    for (const [i, align] of [[0, "left"], [Math.floor(bins.length / 2), "center"], [bins.length, "right"]]) {
      ctx.textAlign = align; ctx.fillText(o.xLabel(i), pad.l + i * slot, pad.t + ph + 7);
    }
    if (hoverI >= 0 && hoverI < bins.length) {
      fillTip(this.tip, o.binLabel(hoverI), [{ color: cssVar(o.color), label: "of samples", value: `${(bins[hoverI] / total * 100).toFixed(1)}%` }]);
      placeTip(this.tip, pad.l + hoverI * slot + slot / 2, w, 4);
    } else this.tip.style.display = "none";
  }
}
