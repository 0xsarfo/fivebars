import { TimeChart, BarChart, Histogram, sparkline, cssVar } from "./charts.js";

// ============================================================ helpers
const $ = (s, el = document) => el.querySelector(s);
const charts = new Set();

const ICONS = {
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  gauge: '<path d="M12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  bars: '<path d="M3 20h18"/><path d="M6 16V10"/><path d="M10 16V5"/><path d="M14 16v-4"/><path d="M18 16V8"/>',
  wifi: '<path d="M5 12.55a11 11 0 0 1 14 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r=".8"/>',
  sim: '<path d="M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect x="8" y="11" width="8" height="7" rx="1"/><path d="M12 11v7M8 14.5h8"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  chev: '<path d="M9 18l6-6-6-6"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  laptop: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
  device: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  cable: '<path d="M4 9h16v6H4z"/><path d="M8 15v4M16 15v4M8 9V5M16 9V5"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>',
  down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  router: '<rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 16.5h.01M11 16.5h.01"/><path d="M8 9.5a6 6 0 0 1 8 0M5.5 7a9.5 9.5 0 0 1 13 0"/>',
  tower: '<path d="M12 10v12M8 22l4-12 4 12"/><path d="M8.5 6.5a5 5 0 0 1 7 0M6 4a8.5 8.5 0 0 1 12 0"/><circle cx="12" cy="9" r="1.2"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5V21.5M8 7h8"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  map: '<path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>',
  pin: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
};
const icon = (name, cls = "i") => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", cls);
  s.innerHTML = ICONS[name] || ""; // trusted constant markup
  return s;
};
document.querySelectorAll("[data-icon]").forEach((el) => el.replaceWith(icon(el.dataset.icon)));

// Element builder: h("div.cls#id", {attrs}, ...children). Strings become text nodes (never HTML).
// replaceChildren() would print "null" for skipped conditional children, so filter them out.
const fill = (el, ...kids) => el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));

function h(sel, attrs, ...kids) {
  const [tag, ...parts] = sel.split(/(?=[.#])/);
  const el = document.createElement(tag || "div");
  for (const p of parts) p[0] === "." ? el.classList.add(p.slice(1)) : (el.id = p.slice(1));
  if (attrs && (typeof attrs !== "object" || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k instanceof Node ? k : String(k));
  return el;
}

async function api(path, body) {
  const r = await fetch(path, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (j && j.error) throw new Error(j.error);
  return j;
}

// formatting
const fmtSpeed = (bps) => {
  const m = (Number(bps) || 0) * 8 / 1e6;
  if (m < 1) return { v: (m * 1000).toFixed(m * 1000 < 10 ? 1 : 0), u: "Kbps" };
  return { v: m.toFixed(m < 10 ? 2 : 1), u: "Mbps" };
};
const speedStr = (bps) => { const s = fmtSpeed(bps); return `${s.v} ${s.u}`; };
const mbpsStr = (m) => (m == null ? "–" : m < 1 ? `${(m * 1000).toFixed(0)} Kbps` : `${m.toFixed(m < 10 ? 2 : 1)} Mbps`);
function bytes(n, dp) {
  n = Number(n) || 0;
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return { v: n.toFixed(dp ?? (i >= 3 ? 2 : i === 2 ? (n < 10 ? 1 : 0) : 0)), u: u[i] };
}
const bytesStr = (n) => { const b = bytes(n); return `${b.v} ${b.u}`; };
function dur(s, short) {
  s = Math.max(0, Math.round(Number(s) || 0));
  const d = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d) return `${d}d ${hh}h`;
  if (hh) return `${hh}h ${m}m`;
  if (m) return short ? `${m}m` : `${m}m ${sec}s`;
  return `${sec}s`;
}
const clock = (ts, sec) => new Date(ts * 1000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: sec ? "2-digit" : undefined });
function ago(ts) {
  const s = Date.now() / 1000 - ts;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
const RATING = {
  Excellent: { level: "good", tip: "Excellent signal. If the internet is slow, it's the mobile network being busy or your bundle running low, not the router's position." },
  Good: { level: "good", tip: "Good signal. Speeds should be steady; slowdowns are more likely a busy mast at peak times (evenings)." },
  Fair: { level: "warning", tip: "Fair signal. Moving the router nearer a window or higher up could noticeably improve speed. Try Placement mode." },
  Poor: { level: "critical", tip: "Weak signal: expect slow speeds and drop-outs. Move the router to a window facing the nearest mast, as high as you can. Use Placement mode to compare spots." },
  Unknown: { level: "info", tip: "No signal reading yet." },
};
// 4G RSRP and Wi-Fi RSSI use different scales.
const SCALES = {
  lte: { min: -120, max: -60, cuts: [-100, -90, -80], name: "4G signal" },
  wifi: { min: -90, max: -30, cuts: [-70, -60, -50], name: "Wi-Fi signal" },
};
const rateSignal = (r, kind = "lte") => {
  if (r == null) return "Unknown";
  const [p, f, g] = (SCALES[kind] || SCALES.lte).cuts;
  return r >= g ? "Excellent" : r >= f ? "Good" : r >= p ? "Fair" : "Poor";
};
const WIFI_TIPS = {
  Excellent: "Excellent Wi-Fi signal. If things are slow, the bottleneck is the internet connection behind the router or hotspot, not the Wi-Fi.",
  Good: "Good Wi-Fi signal: fast and stable for nearly everything.",
  Fair: "Fair Wi-Fi signal. Moving closer to the router or hotspot, or removing walls in between, will speed things up.",
  Poor: "Weak Wi-Fi signal: expect slow speeds and drop-outs. Move closer to the router or hotspot.",
  Unknown: "No Wi-Fi signal reading (wired connection, or not measured yet).",
};
const ratingInfo = (rating, kind) => ({ level: (RATING[rating] || RATING.Unknown).level, tip: kind === "wifi" ? WIFI_TIPS[rating] || WIFI_TIPS.Unknown : (RATING[rating] || RATING.Unknown).tip });
const kindOf = () => (live && live.signal_kind) || "lte";
const OP = () => live?.operator || "your mobile network"; // the router SIM's operator, when known
const GW = () => live?.network?.gateway || "your router's address";
const bandName = (b) => {
  if (!b) return "–";
  const n = (b.match(/Band\s*(\d+)/i) || [])[1];
  const mhz = { 1: 2100, 3: 1800, 7: 2600, 8: 900, 20: 800, 28: 700, 38: 2600, 40: 2300, 41: 2500 }[n];
  return n ? `B${n}${mhz ? " · " + mhz : ""}` : b;
};

// hover tooltips for (i) icons
const hoverTip = $("#hoverTip");
document.addEventListener("pointerover", (e) => {
  const t = e.target.closest("[data-tip]");
  if (!t) return;
  hoverTip.textContent = t.dataset.tip; hoverTip.style.display = "block";
  const r = t.getBoundingClientRect();
  hoverTip.style.left = Math.min(window.innerWidth - hoverTip.offsetWidth - 12, r.left) + "px";
  hoverTip.style.top = (r.bottom + 8) + "px";
});
document.addEventListener("pointerout", (e) => { if (e.target.closest("[data-tip]")) hoverTip.style.display = "none"; });
const infoI = (text) => h("span.info-i", { "data-tip": text }, "i");

// ============================================================ live data bus
let live = null;
const liveSubs = new Set();
async function pollLive() {
  try {
    live = await api("/api/live");
    renderLive(live);
    liveSubs.forEach((fn) => fn(live));
  } catch (e) {
    setPill("critical", "dashboard offline");
  }
}

function setPill(level, text) {
  const p = $("#pillStatus"); p.replaceChildren(h(`i.dot.${level}`), text);
}

// ============================================================ tiles
const TILES = [
  { id: "down", title: "Download", color: "--series-1", spark: (l) => l.spark.down, open: () => openUsage() },
  { id: "up", title: "Upload", color: "--series-2", spark: (l) => l.spark.up, open: () => openUsage() },
  { id: "lat", title: "Latency", color: "--neutral-line", spark: (l) => l.spark.lat, open: () => openLatency() },
  { id: "sig", title: "Signal", color: "--neutral-line", spark: (l) => l.spark.rsrp, open: () => openSignal() },
  { id: "ping", title: "Ping success", color: "--neutral-line", spark: (l) => l.spark.lat.map((v) => (v == null ? 0 : 100)), open: () => openCheck() },
  { id: "data", title: "Data today", color: "--neutral-line", spark: null, open: () => openUsage() },
];
const tileEls = {};
for (const t of TILES) {
  const v = h("div.v", "–"), s = h("div.s", " "), c = t.spark ? h("canvas") : h("div");
  const tt = h("div.t", h("span", t.title), icon("chev"));
  const el = h("button.tile", { onclick: t.open }, tt, v, c, s);
  tileEls[t.id] = { v, s, c, t: tt };
  $("#tiles").append(el);
}
const setVal = (el, num, unit) => el.replaceChildren(String(num), unit ? h("small", unit) : "");

const wifiGen = (phy) => {
  const g = { n: "Wi-Fi 4", ac: "Wi-Fi 5", ax: "Wi-Fi 6", be: "Wi-Fi 7", g: "802.11g", a: "802.11a", b: "802.11b" }[(phy || "").replace("802.11", "")];
  return g || phy || "–";
};
function renderLive(l) {
  const n = l.network || {}, w = n.wifi || {}, c = l.caps || {}, kind = l.signal_kind || (c.cellular ? "lte" : "wifi");
  // header
  const starting = n.connected === null;
  const level = starting ? "info" : !n.connected ? "critical" : c.router && l.router_ok === false ? "critical" : l.online ? "good" : "critical";
  setPill(level, starting ? "starting" : !n.connected ? "not connected" : c.router && l.router_ok === false ? "router unreachable" : l.online ? "online" : "no internet");
  $("#pillOp").textContent = c.cellular ? (l.operator || "–") : w.channel ? `Wi-Fi · ch ${w.channel}` : n.connected ? "Wired" : "–";
  $("#pillNet").textContent = c.cellular ? (l.network_type === "LTE" ? "4G LTE" : l.network_type || "–") : w.band || (n.gateway || "–");
  $("#pillUp").textContent = l.session_time != null && n.connected ? `${c.cellular ? "up" : "joined"} ${dur(l.session_time, true)}` : "–";
  $("#brandName").textContent = (n.name || "Network").toUpperCase();
  $("#brandSub").textContent = n.label || "";
  $("#brandName").title = n.named_by === "default" ? "Click to set this network's name (macOS hides Wi-Fi names from apps)" : "Click to rename this network";
  document.title = `${n.name || "Network"} · ${l.online ? speedStr(l.down) + " ↓" : "offline"}`;
  const badge = $("#bellBtn .badge");
  if (l.alerts) {
    const b = badge || $("#bellBtn").appendChild(h("span.badge"));
    b.textContent = l.alerts; b.classList.toggle("critical", !l.online);
  } else badge?.remove();

  // tiles
  const T = tileEls, scope = l.traffic_scope === "mac" ? "this computer's traffic" : "whole network";
  let s = fmtSpeed(l.down); setVal(T.down.v, s.v, s.u); T.down.s.textContent = scope;
  s = fmtSpeed(l.up); setVal(T.up.v, s.v, s.u); T.up.s.textContent = scope;
  setVal(T.lat.v, l.lat == null ? "–" : Math.round(l.lat), "ms");
  T.lat.s.textContent = l.lat_avg ? `${Math.round(l.lat_avg)} ms avg · last minute` : "ping 1.1.1.1, live";
  T.sig.t.firstChild.textContent = kind === "wifi" ? "Wi-Fi signal" : "Signal";
  setVal(T.sig.v, l.rsrp ?? "–", "dBm");
  T.sig.s.textContent = kind === "wifi" ? `${l.rating}${w.tx_rate ? ` · ${w.tx_rate} Mbps link` : ""}` : `${l.rating} · ${l.bars ?? 0}/5 bars`;
  T.sig.s.className = "s" + (l.rating === "Poor" ? " bad" : "");
  setVal(T.ping.v, l.ping_success == null ? "–" : l.ping_success.toFixed(l.ping_success === 100 ? 0 : 1), "%");
  T.ping.s.textContent = "last minute";
  const today = bytes((l.today_rx || 0) + (l.today_tx || 0));
  setVal(T.data.v, today.v, today.u);
  T.data.s.textContent = `${bytesStr((l.month_rx || 0) + (l.month_tx || 0))} this month${l.traffic_scope === "mac" ? " · this computer" : ""}`;
  for (const t of TILES) if (t.spark) sparkline(T[t.id].c, t.spark(l), t.color);

  // hero
  heroGauge.set(l.rsrp, kind);
  $("#heroTitle").textContent = kind === "wifi" ? "Wi-Fi signal" : "4G signal";
  const duo = kind === "wifi"
    ? [["Wi-Fi", wifiGen(w.phy)], ["Channel", w.channel ? `${w.channel} · ${w.band || ""}` : "–"], ["Link rate", w.tx_rate ? `${w.tx_rate} Mbps` : "–"]]
    : [["Network", l.network_type === "LTE" ? (l.sub_network_type || "LTE").replace("_", "-") : l.network_type || "–"], ["Band", bandName(l.band)], ["Mast ID", l.cell_id || "–"]];
  fill($("#heroDuo"), ...duo.map(([k, v]) => h("div", k, h("b", v))));
  const r = ratingInfo(l.rating, kind);
  fill($("#heroTip"), h("b", `${l.rating} ${kind === "wifi" ? "Wi-Fi " : ""}signal`), r.tip);
  sigChartKind(kind);
}

// ============================================================ gauges
function signalGauge(container, opts = {}) {
  let g = null, kind = null;
  return { set(v, k = "lte") { if (k !== kind) { kind = k; g = buildGauge(container, { ...opts, kind: k }); } g.set(v); } };
}
function buildGauge(container, { big = false, kind = "lte" } = {}) {
  const NS = "http://www.w3.org/2000/svg", S = SCALES[kind] || SCALES.lte;
  const W = 400, H = 232, cx = 200, cy = 205, R = 165, MIN = S.min, MAX = S.max;
  const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const ang = (v) => Math.PI * (1 - (Math.min(MAX, Math.max(MIN, v)) - MIN) / (MAX - MIN));
  const pt = (v, r) => [cx + r * Math.cos(ang(v)), cy - r * Math.sin(ang(v))];
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); svg.append(e); return e; };
  // target wedge: Good + Excellent zone
  const [ax, ay] = pt(S.cuts[1], R - 4), [bx, by] = pt(MAX, R - 4);
  el("path", { d: `M${cx},${cy} L${ax},${ay} A${R - 4},${R - 4} 0 0 1 ${bx},${by} Z`, fill: "var(--text)", opacity: ".05" });
  // dotted arc
  const dots = [];
  for (let i = 0; i <= 60; i++) {
    const v = MIN + (i / 60) * (MAX - MIN), [x, y] = pt(v, R);
    dots.push({ v, e: el("circle", { cx: x, cy: y, r: i % 10 === 0 ? 2.4 : 1.5, fill: "var(--text-3)" }) });
  }
  // zone ticks just inside the arc
  for (const [v, c] of [[S.cuts[0], "--critical"], [S.cuts[1], "--warning"], [S.cuts[2], "--good"]]) {
    const [x1, y1] = pt(v, R - 12), [x2, y2] = pt(v, R - 22);
    el("line", { x1, y1, x2, y2, stroke: `var(${c})`, "stroke-width": 2, "stroke-linecap": "round" });
  }
  for (const v of [MIN, ...S.cuts, MAX]) {
    const end = v === MIN || v === MAX;
    const [x, y] = end ? pt(v, R) : pt(v, R + 18);
    const t = el("text", { x, y: end ? y + 20 : y + 4, "text-anchor": "middle", fill: "var(--text-3)", "font-size": 11, "font-family": "var(--mono)" });
    t.textContent = v;
  }
  const needle = el("line", { x1: cx, y1: cy, x2: cx, y2: cy - R + 14, stroke: "var(--accent)", "stroke-width": 2.5, "stroke-linecap": "round" });
  needle.style.transition = "transform .6s cubic-bezier(.3,1.4,.5,1)"; needle.style.transformOrigin = `${cx}px ${cy}px`;
  el("rect", { x: cx - 18, y: cy - 9, width: 36, height: 18, rx: 4, fill: "var(--text)" }); // the router / this computer
  el("circle", { cx: cx - 9, cy, r: 1.8, fill: "var(--good)" });
  container.replaceChildren(svg);
  const read = h("div.gauge-read", h("div.num", "–"), h("div.lbl", ""));
  read.style.position = "static"; read.style.marginTop = big ? "8px" : "4px";
  container.append(read);
  return {
    set(v) {
      const has = v != null;
      needle.style.transform = `rotate(${has ? 90 - (ang(v) * 180) / Math.PI : -90}deg)`;
      needle.style.opacity = has ? 1 : 0; // no reading: don't point at "worst"
      for (const d of dots) d.e.setAttribute("fill", has && d.v <= v ? "var(--text)" : "var(--text-3)");
      for (const d of dots) d.e.setAttribute("opacity", has && d.v <= v ? "1" : ".45");
      read.firstChild.replaceChildren(has ? String(v) : "–", h("small", "dBm"));
      const rt = rateSignal(v, kind), lv = (RATING[rt] || RATING.Unknown).level;
      read.lastChild.replaceChildren(h(`i.dot.${lv}`), rt);
    },
  };
}
const heroGauge = signalGauge($("#heroGauge"));

// ============================================================ history charts
const RANGES = [["15M", 900], ["1H", 3600], ["6H", 21600], ["24H", 86400], ["7D", 604800]];
let range = Number(localStorage.getItem("range")) || 900;
function seg(items, value, onChange, cls = "") {
  const el = h("div.seg" + cls);
  const render = (v) => el.replaceChildren(...items.map(([label, val]) =>
    h("button", { class: val === v ? "on" : null, onclick: () => { render(val); onChange(val); } }, label)));
  render(value);
  return el;
}
$("#rangeSeg").replaceWith(Object.assign(seg(RANGES, range, (v) => { range = v; localStorage.setItem("range", v); pollHistory(); }), { style: "margin-left:auto" }));

const toMbps = (v) => (v * 8) / 1e6;
const yMbps = (v) => (v === 0 ? "0" : v >= 1 ? `${+v.toFixed(1)}M` : `${Math.round(v * 1000)}K`);
const thr = new TimeChart($("#thrChart"), {
  series: [{ key: "down", label: "Download", color: "--series-1", area: true }, { key: "up", label: "Upload", color: "--series-2", area: true, areaAlpha: 0.18 }],
  map: toMbps, yMin: 0, yMaxMin: 0.5, yFmt: yMbps, tipFmt: (v) => speedStr(v),
});
const latChart = new TimeChart($("#latChart"), {
  series: [{ key: "lat", label: "Latency", color: "--neutral-line", area: true, areaAlpha: 0.22 }],
  yMin: 0, yMaxMin: 100, yFmt: (v) => `${v} ms`, tipFmt: (v) => `${Math.round(v)} ms`,
  tipExtra: (p) => (p.loss > 0 ? `${Math.round(p.loss * 100)}% lost` : null),
});
const SIG_ZONES = [
  { from: -140, to: -100, color: "--critical", alpha: 0.07 }, { from: -100, to: -90, color: "--warning", alpha: 0.05 },
  { from: -90, to: -40, color: "--good", alpha: 0.04 },
];
const zonesFor = (kind) => {
  const [p, f] = (SCALES[kind] || SCALES.lte).cuts;
  return [{ from: -140, to: p, color: "--critical", alpha: 0.07 }, { from: p, to: f, color: "--warning", alpha: 0.05 }, { from: f, to: 0, color: "--good", alpha: 0.04 }];
};
let sigKind = "lte";
function sigChartKind(kind) {
  if (kind === sigKind) return;
  sigKind = kind;
  sigChart.o.zones = zonesFor(kind);
  $("#sigTitle").textContent = kind === "wifi" ? "Wi-Fi signal" : "Signal strength";
  $("#sigNote").textContent = kind === "wifi" ? "how well this computer hears the Wi-Fi · tinted by quality" : "RSRP from your mobile mast · tinted by quality";
  sigChart.draw();
}
const sigChart = new TimeChart($("#sigChart"), {
  series: [{ key: "rsrp", label: "Signal", color: "--neutral-line", area: true, areaAlpha: 0.14 }],
  yPad: 3, zones: SIG_ZONES, yFmt: (v) => `${v}`, tipFmt: (v) => `${Math.round(v)} dBm · ${rateSignal(v, sigKind)}`,
});
[thr, latChart, sigChart].forEach((c) => charts.add(c));

async function pollHistory() {
  try {
    const d = await api(`/api/history?range=${range}`);
    thr.update(d); latChart.update(d); sigChart.update(d);
  } catch (e) {}
}

// ============================================================ events
const EV_COLORS = { critical: "critical", warning: "warning", info: "info" };
let lastEventId = 0;
async function pollEvents() {
  try {
    const { events, now } = await api("/api/events?limit=300");
    $("#evCount").textContent = `${events.length} events`;
    const box = $("#events");
    if (!events.length) { fill(box, h("div.empty", "No events yet")); return; }
    let lastDay = null;
    const rows = [];
    const today = new Date().toDateString();
    for (const e of events) {
      const day = new Date(e.ts * 1000).toDateString();
      if (day !== lastDay) {
        if (lastDay !== null || day !== today) rows.push(h("div.ev", h("div.day", day === today ? "Today" : new Date(e.ts * 1000).toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" }))));
        lastDay = day;
      }
      const d = e.open ? h("span.dur.live", "ongoing") : e.duration != null ? h("span.dur", dur(e.duration)) : h("span");
      rows.push(h("div.ev", h("time", clock(e.ts)), h(`i.dot.${EV_COLORS[e.level] || "info"}`),
        h("div.title", h("span", e.title), e.detail ? infoI(e.detail) : null), d));
    }
    fill(box, ...rows);
    // desktop notifications for new problems
    const newest = events[0]?.id || 0;
    if (lastEventId && notifyOn()) {
      for (const e of events.filter((x) => x.id > lastEventId && x.level !== "info").reverse())
        new Notification(e.title, { body: e.detail || "", silent: false });
    }
    lastEventId = Math.max(lastEventId, newest);
  } catch (e) {}
}
const notifyOn = () => localStorage.getItem("notify") === "1" && "Notification" in window && Notification.permission === "granted";

// ============================================================ modal framework
function openModal({ title, subtitle, cls = "", right }) {
  closeAllPop();
  const timers = [], subs = [], local = new Set();
  const sub = h("div.subt", subtitle || "");
  const titleEl = h("h2", title);
  const backBtn = h("button.iconbtn.back", { style: { display: "none" } }, icon("back"));
  const closeBtn = h("button.iconbtn", { title: "Close (Esc)", onclick: () => close() }, icon("x"));
  const body = h("div");
  const modal = h("div.modal" + cls, h("div.modal-h", backBtn, h("div", titleEl, subtitle !== undefined ? sub : null), h("div.right", right || null, closeBtn)), body);
  const bd = h("div.backdrop", { onmousedown: (e) => { if (e.target === bd) close(); } }, modal);
  const esc = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", esc);
  document.body.append(bd);
  function close() {
    timers.forEach(clearInterval); subs.forEach((f) => liveSubs.delete(f)); local.forEach((c) => charts.delete(c));
    document.removeEventListener("keydown", esc); bd.remove();
  }
  return {
    body, modal, close,
    title: (t) => (titleEl.textContent = t),
    sub: (t, kind = "") => { sub.textContent = t; sub.className = "subt " + kind; },
    every: (fn, ms) => { fn(); timers.push(setInterval(fn, ms)); },
    timer: (id) => { timers.push(id); return id; },
    onLive: (fn) => { liveSubs.add(fn); subs.push(fn); if (live) fn(live); },
    chart: (c) => { charts.add(c); local.add(c); return c; },
    back: (fn) => { backBtn.style.display = fn ? "grid" : "none"; backBtn.onclick = fn; },
  };
}
const rowsEl = (items) => h("div.rows", items.filter(Boolean).map(([k, v, cls, tip]) =>
  h("div.kv", h("span.k", k, tip ? infoI(tip) : null), h("span.val" + (cls ? "." + cls : ""), v ?? "–"))));
const stat = (n, unit, label, ic) => h("div.stat", h("div.n", String(n), unit ? h("small", unit) : null), h("div.l", ic ? icon(ic) : null, ic ? " " : null, label));
const infobox = (title, text) => h("div.infobox.mt", icon("info"), h("div", h("b", title), text));

// ============================================================ Speed test
function openSpeedTest() {
  const m = openModal({ title: "Speed test", cls: ".narrow" });
  const nums = { down: h("div.n", "–"), up: h("div.n", "–"), lat: h("div.n", "–") };
  const jit = h("b", "–"), loss = h("b", "–"), used = h("b", "–");
  const liveNum = h("div.num", "–"), phaseLbl = h("div.lbl", "Ready");
  const btn = h("button.btn.big", { onclick: start }, icon("play"), "Start test");
  const msg = h("div.st-msg", "A test uses roughly 10–60 MB of your mobile data, depending on speed.");
  const gaugeBox = h("div.gauge-wrap", { style: { maxWidth: "460px", margin: "6px auto 0" } });
  const hist = h("div");
  m.body.append(
    h("div.st-nums",
      h("div", h("div.l", icon("down"), "Download"), nums.down),
      h("div", h("div.l", icon("up"), "Upload"), nums.up),
      h("div", h("div.l", icon("clock"), "Latency"), nums.lat)),
    h("div.st-sub", h("span", "Jitter", jit, "ms"), h("span", "Loss", loss, "%"), h("span", "Data used", used, "MB")),
    gaugeBox, h("div.gauge-read", { style: { position: "static", marginBottom: "18px" } }, liveNum, phaseLbl),
    btn, msg, h("div.st-foot", "Measured against Cloudflare from this computer, through your router. Results can read lower than tests to a nearby server."),
    hist);

  // speed gauge: sqrt scale 0..100 Mbps
  const NS = "http://www.w3.org/2000/svg", W = 420, H = 240, cx = 210, cy = 205, R = 175;
  const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const frac = (v) => Math.sqrt(Math.min(100, Math.max(0, v)) / 100);
  const pt = (f, r) => [cx - r * Math.cos(Math.PI * f), cy - r * Math.sin(Math.PI * f)];
  const add = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); svg.append(e); return e; };
  for (let i = 0; i <= 50; i++) { const [x, y] = pt(i / 50, R); add("circle", { cx: x, cy: y, r: 1.4, fill: "var(--text-3)", opacity: ".6" }); }
  for (const v of [0, 1, 5, 10, 20, 30, 50, 100]) {
    const end = v === 0 || v === 100;
    const [x, y] = end ? pt(frac(v), R) : pt(frac(v), R - 22);
    const t = add("text", { x, y: end ? y + 20 : y + 4, "text-anchor": "middle", fill: "var(--text-3)", "font-size": 11, "font-family": "var(--mono)" }); t.textContent = v;
  }
  for (const r of [26, 44, 62]) add("ellipse", { cx, cy, rx: r * 2.2, ry: r * 0.42, fill: "none", stroke: "var(--hair)" });
  const arc = add("path", { fill: "none", stroke: "var(--series-1)", "stroke-width": 3, "stroke-linecap": "round" });
  const needle = add("line", { x1: cx, y1: cy, x2: cx - R + 8, y2: cy, stroke: "var(--text)", "stroke-width": 2.5, "stroke-linecap": "round" });
  const tipDot = add("circle", { cx: cx - R + 8, cy, r: 6, fill: "var(--text)" });
  gaugeBox.append(svg);
  function setGauge(v, color) {
    const f = frac(v || 0), [x, y] = pt(f, R - 8);
    needle.setAttribute("x2", x); needle.setAttribute("y2", y); tipDot.setAttribute("cx", x); tipDot.setAttribute("cy", y);
    const [sx, sy] = pt(0, R + 10), [ex, ey] = pt(Math.max(0.001, f), R + 10);
    arc.setAttribute("d", `M${sx},${sy} A${R + 10},${R + 10} 0 0 1 ${ex},${ey}`); arc.setAttribute("stroke", `var(${color})`);
  }
  setGauge(0, "--series-1");

  const setNum = (el, v, u) => el.replaceChildren(v == null ? "–" : String(v), h("small", u));
  function render(s) {
    if (s.lat != null) setNum(nums.lat, Math.round(s.lat), "ms");
    if (s.down != null) setNum(nums.down, s.down.toFixed(s.down < 10 ? 2 : 1), "Mbps");
    if (s.up != null) setNum(nums.up, s.up.toFixed(s.up < 10 ? 2 : 1), "Mbps");
    jit.textContent = s.jitter == null ? "–" : s.jitter.toFixed(1);
    loss.textContent = s.loss == null ? "–" : s.loss.toFixed(0);
    used.textContent = s.bytes ? (s.bytes / 1e6).toFixed(0) : "–";
    const running = ["latency", "download", "upload"].includes(s.phase);
    btn.disabled = running;
    btn.replaceChildren(icon(running ? "refresh" : s.phase === "done" ? "refresh" : "play"), running ? "Testing…" : s.phase === "done" || s.phase === "error" ? "Run again" : "Start test");
    const color = s.phase === "upload" ? "--series-2" : "--series-1";
    if (s.phase === "download" || s.phase === "upload") {
      setGauge(s.live, color);
      liveNum.replaceChildren(s.live < 10 ? s.live.toFixed(2) : s.live.toFixed(1), h("small", "Mbps"));
      phaseLbl.replaceChildren(icon(s.phase === "upload" ? "up" : "down"), s.phase === "upload" ? "Upload" : "Download");
      msg.textContent = `Measuring ${s.phase}…`;
    } else if (s.phase === "latency") {
      setGauge(0, color); liveNum.replaceChildren("…"); phaseLbl.textContent = "Measuring latency"; msg.textContent = "Pinging 1.1.1.1…";
    } else if (s.phase === "done") {
      setGauge(s.down, "--series-1");
      liveNum.replaceChildren(s.down.toFixed(s.down < 10 ? 2 : 1), h("small", "Mbps"));
      phaseLbl.replaceChildren(icon("down"), "Download");
      msg.textContent = verdict(s.down);
    } else if (s.phase === "error") msg.textContent = "Test failed: " + (s.error || "unknown error");
    if (s.history?.length) {
      fill(hist, h("div.panel.mt", h("div.cap", "Previous tests"),
        h("div.rows", s.history.slice(0, 5).map((t) => h("div.kv", h("span.k", new Date(t.ts * 1000).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })),
          h("span.val", `↓ ${mbpsStr(t.down)}  ↑ ${mbpsStr(t.up)}  ${Math.round(t.lat || 0)} ms`))))));
    }
  }
  const verdict = (d) => d >= 25 ? "Done. Fast enough for 4K video and several people at once."
    : d >= 10 ? "Done. Good for HD video and video calls."
    : d >= 3 ? "Done. OK for browsing and SD video; HD calls may stutter."
    : `Done. Slow. Check signal placement, or ${live?.caps?.cellular ? OP() : "the network"} may be congested right now.`;
  let poll;
  const watch = () => { clearInterval(poll); poll = m.timer(setInterval(tick, 300)); };
  async function start() {
    await api("/api/speedtest", {});
    watch();
  }
  async function tick() {
    const s = await api("/api/speedtest");
    render(s);
    if (!["latency", "download", "upload"].includes(s.phase)) clearInterval(poll);
  }
  api("/api/speedtest").then((s) => { render(s); if (["latency", "download", "upload"].includes(s.phase)) watch(); });
}

// ============================================================ Placement (signal alignment)
function openPlacement() {
  const m = openModal({ title: "Placement", subtitle: "", right: h("button.link", { onclick: () => { m.close(); openSignal(); } }, "Signal history ›") });
  const g = h("div.gauge-wrap");
  const spotsBox = h("div.spots");
  const prog = h("div"), progWrap = h("div.progress", { style: { display: "none" } }, prog);
  const nameIn = h("input.field", { placeholder: "Name this spot, e.g. Living room window" });
  const testBtn = h("button.btn.primary", { onclick: testSpot }, icon("pin"), "Test this spot");
  const rowsL = h("div"), rowsR = h("div");
  m.body.append(
    h("div.grid2",
      h("div.panel", h("div.cap", "Signal ", h("i.dot.good", { id: "plDot" })), g),
      h("div.panel", { style: { display: "flex", flexDirection: "column" } },
        h("div.cap", "Spots tested"),
        h("div", { style: { flex: 1, overflowY: "auto", maxHeight: "250px" } }, spotsBox),
        h("div.inline.mt", nameIn, testBtn), progWrap)),
    h("div.grid2.mt", rowsL, rowsR),
    infobox("How to use this", kindOf() === "wifi"
      ? "Carry this computer (or move the router/hotspot), wait about 10 seconds for the reading to settle, then press “Test this spot”. It averages the Wi-Fi signal over 10 seconds. " +
        "Compare rooms and desks to find where Wi-Fi is strongest. Every 6 dB better is roughly double the usable signal. Updated every 2 seconds."
      : "Put the router somewhere, wait about 10 seconds for the reading to settle, then press “Test this spot”. It averages the signal over 10 seconds. " +
        "Try windows, higher shelves and different rooms. The best spot is highlighted. Every 6 dB better is roughly double the usable signal. " +
        "Signal strength (RSRP) is updated every 2 seconds."));
  const gauge = signalGauge(g, { big: true });
  const window1m = [];
  const spotKey = `spots:${live?.network?.id || "default"}`; // spots are per network
  let spots = JSON.parse(localStorage.getItem(spotKey) || (live?.caps?.cellular ? localStorage.getItem("spots") : null) || "[]");
  let testing = null;

  m.onLive((l) => {
    const kind = l.signal_kind || "lte", wifi = kind === "wifi", w = l.network?.wifi || {};
    gauge.set(l.rsrp, kind);
    if (l.rsrp != null) { window1m.push(l.rsrp); if (window1m.length > 30) window1m.shift(); }
    const r = rateSignal(l.rsrp, kind), lv = (RATING[r] || RATING.Unknown).level;
    $("#plDot", m.body).className = `dot ${lv}`;
    m.title(wifi ? "Wi-Fi placement" : "Placement");
    m.sub(r === "Poor" ? (wifi ? "Weak Wi-Fi here. Move closer to the router or hotspot." : "Weak signal here. Try a window or a higher spot.")
      : r === "Fair" ? "Usable, but a better spot could be faster."
      : r === "Unknown" ? (l.network?.connected ? "No signal reading on this connection." : "Not connected to a network.")
      : wifi ? "Good spot: this computer hears the Wi-Fi well." : "Good spot: the router hears the mast well.",
      r === "Poor" ? "bad" : r === "Fair" ? "warn" : r === "Unknown" ? "" : "good");
    const avg = window1m.length ? window1m.reduce((a, b) => a + b, 0) / window1m.length : null;
    const spread = window1m.length ? Math.max(...window1m) - Math.min(...window1m) : null;
    fill(rowsL, rowsEl([
      wifi ? ["Current Wi-Fi signal", l.rsrp != null ? `${l.rsrp} dBm` : "–", null, "How strongly this computer hears the Wi-Fi network (RSSI). Closer to 0 is better: −50 excellent, −60 good, −70 fair."]
        : ["Current signal (RSRP)", l.rsrp != null ? `${l.rsrp} dBm` : "–", null, "Reference Signal Received Power: how strongly the router hears its mobile mast. Closer to 0 is better."],
      ["Rating", r, lv === "good" ? "good" : lv === "critical" ? "bad" : "warn"],
      ["Average, last minute", avg != null ? `${avg.toFixed(1)} dBm` : "–"],
      ["Stability", spread == null ? "–" : spread <= 3 ? `steady (±${(spread / 2).toFixed(1)})` : `fluctuating (±${(spread / 2).toFixed(1)})`, spread > 6 ? "warn" : null,
        "How much the signal moved in the last minute. Large swings mean interference or people/objects moving between you and the mast."],
    ]));
    fill(rowsR, rowsEl(wifi ? [
      ["Noise", w.noise != null ? `${w.noise} dBm` : "–", null, "Background radio noise. The gap between signal and noise (SNR) matters most: over 25 dB is good."],
      ["Signal-to-noise", w.noise != null && l.rsrp != null ? `${l.rsrp - w.noise} dB` : "–", w.noise != null && l.rsrp - w.noise < 20 ? "warn" : null],
      ["Channel", w.channel ? `${w.channel} · ${w.band || ""} · ${w.width || ""}` : "–", null, "2.4 GHz reaches further; 5 GHz is faster at short range. Crowded channels slow everyone down."],
      ["Link rate", w.tx_rate ? `${w.tx_rate} Mbps · ${w.phy || ""}` : "–", null, "The Wi-Fi connection's current speed between this computer and the router, not your internet speed."],
    ] : [
      ["Signal bars", `${"▮".repeat(l.bars || 0)}${"▯".repeat(5 - (l.bars || 0))}  ${l.bars ?? 0}/5`],
      ["Network", l.network_type === "LTE" ? `4G ${(l.sub_network_type || "").replace("_", "-")}` : l.network_type],
      ["Frequency band", bandName(l.band), null, "Lower frequencies (700–900 MHz) travel further and through walls; higher ones (1800–2600 MHz) are faster but weaker indoors."],
      ["Mast (cell) ID", l.cell_id, null, "Which mast the router is using. If this keeps changing, the router is sitting between two masts."],
    ]));
    if (testing) {
      testing.vals.push(l.rsrp);
      prog.style.width = Math.min(100, (testing.vals.length / 5) * 100) + "%";
      if (testing.vals.length >= 5) finishTest();
    }
  });

  function renderSpots() {
    if (!spots.length) { fill(spotsBox, h("div.empty", "No spots yet. Test a few places to compare.")); return; }
    const best = Math.max(...spots.map((s) => s.avg));
    const sorted = [...spots].sort((a, b) => b.avg - a.avg);
    fill(spotsBox, ...sorted.map((s, i) => h("div.spot" + (s.avg === best ? ".best" : ""),
      h("span.rank", `#${i + 1}`), h("span", s.name),
      h("span.val", `${s.avg.toFixed(1)} dBm`),
      h("button.muted", { title: "Remove", onclick: () => { spots = spots.filter((x) => x !== s); save(); } }, icon("x")))));
  }
  const save = () => { localStorage.setItem(spotKey, JSON.stringify(spots)); renderSpots(); };
  function testSpot() {
    testing = { vals: [] }; progWrap.style.display = "block"; prog.style.width = "0%";
    testBtn.disabled = true; testBtn.replaceChildren(icon("refresh"), "Measuring 10 s…");
  }
  function finishTest() {
    const v = testing.vals.filter((x) => x != null);
    testing = null; progWrap.style.display = "none"; testBtn.disabled = false; testBtn.replaceChildren(icon("pin"), "Test this spot");
    if (!v.length) return;
    spots.push({ name: nameIn.value.trim() || `Spot ${spots.length + 1}`, avg: v.reduce((a, b) => a + b, 0) / v.length, ts: Date.now() });
    nameIn.value = ""; save();
  }
  renderSpots();
}

// ============================================================ Signal details
function openSignal() {
  const kind = kindOf(), wifi = kind === "wifi";
  const m = openModal({ title: wifi ? "Wi-Fi signal" : "Signal", right: h("button.link", { onclick: () => { m.close(); openPlacement(); } }, "Placement mode ›") });
  let rng = 3600;
  const statsBox = h("div.stats"), share = h("div"), cells = h("div");
  const chartBox = h("div.chart");
  m.body.append(statsBox, seg([["15M", 900], ["1H", 3600], ["6H", 21600], ["24H", 86400], ["7D", 604800]], rng, (v) => { rng = v; load(); }),
    h("div.mt", chartBox),
    h("div.grid2.mt", h("div.panel", h("div.cap", "Time at each quality"), share), h("div.panel", h("div.cap", wifi ? "Wi-Fi link" : "Masts used"), cells)),
    wifi ? infobox("What is Wi-Fi signal?", "RSSI is how strongly this computer hears the Wi-Fi network, in dBm. −50 or better is excellent, −60 good, −70 fair, below that poor. " +
      "Wi-Fi signal only covers the hop from this computer to the router or hotspot; the internet connection behind it can still be the slow part.")
      : infobox("What is RSRP?", "RSRP (Reference Signal Received Power) is how strongly your router hears its mobile mast, in dBm. It is always negative: −70 is excellent, −90 is good, −100 is fair, −110 is poor. " +
      "Speed depends on signal and on how busy the mast is, so a good signal can still be slow at peak times."));
  const ch = m.chart(new TimeChart(chartBox, {
    series: [{ key: "rsrp", label: "Signal", color: "--neutral-line", area: true, areaAlpha: 0.14 }],
    yPad: 3, zones: zonesFor(kind), yFmt: (v) => `${v}`, tipFmt: (v) => `${Math.round(v)} dBm · ${rateSignal(v, kind)}`,
  }));
  async function load() {
    const [hist, s] = await Promise.all([api(`/api/history?range=${rng}`), api(`/api/signal?range=${rng}`)]);
    ch.update(hist);
    fill(statsBox, stat(live?.rsrp ?? "–", "dBm", "Current"), stat(s.avg != null ? s.avg.toFixed(0) : "–", "dBm", "Average"),
      stat(s.max ?? "–", "dBm", "Best"), stat(s.min ?? "–", "dBm", "Worst"));
    const total = Object.values(s.share).reduce((a, b) => a + b, 0) || 1;
    const cols = { Excellent: "--good", Good: "--good", Fair: "--warning", Poor: "--critical" };
    fill(share, 
      h("div.share", Object.entries(s.share).filter(([, v]) => v).map(([k, v]) => h("div", { style: { flex: v, background: `var(${cols[k]})`, opacity: k === "Good" ? 0.65 : 1 }, title: k }))),
      h("div.share-legend", Object.entries(s.share).map(([k, v]) => h("span", h(`i.dot.${RATING[k].level}`), k, h("b", `${Math.round((v / total) * 100)}%`)))));
    const w = live?.network?.wifi || {};
    if (wifi) return fill(cells, rowsEl([["Channel", w.channel ? `${w.channel} · ${w.band || ""}` : "–"], ["Standard", w.phy || "–"],
      ["Link rate", w.tx_rate ? `${w.tx_rate} Mbps` : "–"], ["Noise", w.noise != null ? `${w.noise} dBm` : "–"], ["Security", w.security || "–"]]));
    const ct = s.cells.reduce((a, b) => a + b.n, 0) || 1;
    fill(cells, s.cells.length ? rowsEl(s.cells.slice(0, 5).map((c) => [`Cell ${c.cell}`, `${Math.round((c.n / ct) * 100)}% of time`])) : h("div.empty", "No data yet"));
  }
  m.every(load, 10000);
}

// ============================================================ Latency details
function openLatency() {
  const m = openModal({ title: "Latency" });
  let rng = 3600;
  const statsBox = h("div.stats"), chartBox = h("div.chart"), histBox = h("div.chart.xs"), histNote = h("span.note");
  m.body.append(statsBox, seg([["15M", 900], ["1H", 3600], ["6H", 21600], ["24H", 86400]], rng, (v) => { rng = v; load(); }),
    h("div.mt", chartBox), h("div.legend", h("span", h("i.line", { style: { background: "var(--neutral-line)" } }), "Latency"), h("span", h("i.band"), "Outage")),
    h("div.card-h.mt", { style: { marginBottom: "6px" } }, h("h2", { style: { fontSize: "14px" } }, "Latency distribution"), histNote), histBox,
    infobox("What is latency?", "Latency is how long a tiny message takes to reach the internet (Cloudflare's 1.1.1.1) and come back. Under 60 ms feels instant; 60–150 ms is fine for most things; " +
      "over 200 ms makes calls and games laggy. Mobile networks get slower when the mast is busy, and red bands show times the connection dropped."));
  const ch = m.chart(new TimeChart(chartBox, {
    series: [{ key: "lat", label: "Latency", color: "--neutral-line", area: true, areaAlpha: 0.22 }],
    yMin: 0, yMaxMin: 100, yFmt: (v) => `${v} ms`, tipFmt: (v) => `${Math.round(v)} ms`, tipExtra: (p) => (p.loss > 0 ? `${Math.round(p.loss * 100)}% lost` : null),
  }));
  const hist = m.chart(new Histogram(histBox, { color: "--neutral-line", xLabel: (i) => (i === 30 ? "600+ ms" : `${i * 20} ms`), binLabel: (i) => (i === 29 ? "580+ ms" : `${i * 20}–${i * 20 + 20} ms`) }));
  async function load() {
    const [hd, ld] = await Promise.all([api(`/api/history?range=${rng}`), api(`/api/latency?range=${rng}`)]);
    ch.update(hd); hist.update(ld.bins);
    const lossPct = ld.count + ld.lost ? (ld.lost / (ld.count + ld.lost)) * 100 : 0;
    fill(statsBox, stat(ld.avg != null ? Math.round(ld.avg) : "–", "ms", "Average"), stat(live?.lat != null ? Math.round(live.lat) : "–", "ms", "Current"),
      stat(ld.p95 != null ? Math.round(ld.p95) : "–", "ms", "95% of pings under"), stat(lossPct.toFixed(1), "%", "Packet loss"));
    histNote.textContent = `${ld.count.toLocaleString()} pings in this window`;
  }
  m.every(load, 5000);
}

// ============================================================ Data usage
function openUsage(tab = "router") {
  const m = openModal({ title: "Data usage" });
  const content = h("div");
  const zte = !!live?.caps?.router;
  m.body.append(h("div.center.mb", seg([[zte ? "Router counter" : "Recorded usage", "router"], ["Balance", "mtn"]], tab, show, ".wide")), content);
  let period = "24h", bc, netSel = null;
  function show(t) {
    if (bc) charts.delete(bc);
    bc = null;
    fill(content, );
    t === "router" ? router() : content.append(balanceUI());
  }
  function router() {
    const statsBox = h("div.stats"), chartBox = h("div.chart"), note = h("div.muted", { style: { fontSize: "12px", marginTop: "6px" } });
    const counters = h("div"), how = h("div");
    const picker = h("select.field", { style: { width: "auto", padding: "7px 10px", marginLeft: "auto" }, onchange: (e) => { netSel = e.target.value; load(); } });
    content.append(statsBox,
      h("div", { style: { display: "flex", alignItems: "center", gap: "10px" } },
        seg([["24H", "24h"], ["7D", "7d"], ["30D", "30d"], ["Month", "month"]], period, (v) => { period = v; load(); }), picker),
      h("div.mt", chartBox), h("div.legend", h("span", h("i", { style: { background: "var(--series-1)" } }), "Download"), h("span", h("i", { style: { background: "var(--series-2)" } }), "Upload")),
      note, h("div.grid2.mt", counters, how));
    bc = m.chart(new BarChart(chartBox, {
      stacks: [{ key: "rx", label: "Download", color: "--series-1" }, { key: "tx", label: "Upload", color: "--series-2" }],
      yFmt: (v) => { const b = bytes(v); return `${+b.v} ${b.u}`; }, valFmt: bytesStr, minMax: 1024 * 1024, binary: true,
      xFmt: (b) => "", tipTitle: (b) => "",
    }));
    async function load() {
      const u = await api(`/api/usage?period=${period}${netSel ? "&net=" + encodeURIComponent(netSel) : ""}`);
      const hourly = u.step === 3600;
      if (!picker.options.length || picker.dataset.n !== String(u.networks.length)) {
        picker.dataset.n = u.networks.length;
        fill(picker, ...u.networks.map((n) => h("option", { value: n.id, selected: n.id === u.net ? "" : null }, `${n.name || "Network"}${n.id === live?.network?.id ? " (current)" : ""}`)));
      }
      fill(how, infobox("How is this measured?", u.scope === "network"
        ? "The dashboard adds up the router's traffic counters every 2 seconds, so this covers every device on the network. It only counts while the dashboard is running. Your operator's own count (Balance tab) is the one that decides your bundle."
        : "This network's router doesn't share its counters, so this is only this computer's own traffic on it, recorded every 2 seconds while the dashboard runs. Other devices on the same network aren't included."));
      bc.update(u.bars, {
        xFmt: (b) => hourly ? new Date(b.t * 1000).toLocaleTimeString([], { hour: "numeric" }) : new Date(b.t * 1000).toLocaleDateString([], { day: "numeric", month: "short" }),
        tipTitle: (b) => hourly ? new Date(b.t * 1000).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : new Date(b.t * 1000).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }),
        tipExtra: (b) => `${bytesStr(b.rx + b.tx)} total`,
      });
      const d = bytes(u.rx), up = bytes(u.tx), t = bytes(u.rx + u.tx);
      fill(statsBox, stat(d.v, d.u, "Download", "down"), stat(up.v, up.u, "Upload", "up"), stat(t.v, t.u, "Total"));
      const cov = u.coverage * 100;
      note.textContent = `Recorded ${cov > 0 && cov < 1 ? "under 1" : Math.round(cov)}% of this period · counts only while the dashboard runs`;
      if (live && u.scope === "network" && u.net === live.network?.id) fill(counters, h("div.panel", h("div.cap", "Router's own counters"), rowsEl([
        ["This month", bytesStr((live.month_rx || 0) + (live.month_tx || 0))],
        ["  ↓ down / ↑ up", `${bytesStr(live.month_rx)} / ${bytesStr(live.month_tx)}`],
        ["Online this month", dur(live.month_time)],
        ["Current session", bytesStr((live.session_rx || 0) + (live.session_tx || 0))],
        ["Session length", dur(live.session_time)],
      ])));
    }
    m.every(load, 10000);
  }
  show(tab);
}

function networkRows(n) {
  if (!n || !n.connected) return h("div.empty", "Not connected to a network");
  const w = n.wifi || {};
  return h("div", rowsEl([
    ["Name", n.name, null, n.named_by === "default" ? "macOS hides Wi-Fi names from apps. Click the name at the top left to set it." : `Name from ${n.named_by}`],
    ["Type", n.label],
    ["Router / gateway", n.gateway],
    ["Gateway hardware address", n.mac || "–", null, "Used to recognise this network next time, so its history and usage are kept separate."],
    ["Interface", n.iface],
    w.security ? ["Security", w.security] : null,
    w.channel ? ["Channel", `${w.channel} · ${w.band || ""} · ${w.width || ""}`] : null,
    w.phy ? ["Standard", `${wifiGen(w.phy)} (${w.phy})`] : null,
    w.rssi != null ? ["Signal / noise", `${w.rssi} dBm / ${w.noise ?? "–"} dBm`] : null,
    w.tx_rate ? ["Link rate", `${w.tx_rate} Mbps`] : null,
    ["Router details", n.driver === "zte" ? "Full (supported 4G router)" : "Measured from this computer", null, n.driver === "zte" ? null : "This router doesn't offer an API the dashboard understands, so speed, usage and signal come from this computer's own measurements."],
  ]), h("div.btnrow", h("button.btn.sm", { onclick: renameNetwork }, icon("pencil"), "Rename network")));
}

function unavailable(title, text) {
  return h("div.panel", { style: { textAlign: "center", padding: "34px 24px" } },
    h("div", { style: { fontWeight: 650, fontSize: "15px", marginBottom: "8px" } }, title),
    h("div.sec", { style: { maxWidth: "520px", margin: "0 auto", lineHeight: 1.6 } }, text));
}

// ============================================================ Balance (USSD)
function balanceUI() {
  if (!live?.caps?.ussd)
    return unavailable("Not available on this network",
      `Balance checks are sent through a supported 4G router's SIM card. ${live?.network?.name || "This network"} doesn't offer that, so connect to your 4G router, or dial your operator's balance code on the phone that has the SIM.`);
  const out = h("div.ussd-out.muted", `Ask ${OP()} for your balance. Replies take 5–20 seconds and come straight from the network.`);
  const code = h("input.field", { placeholder: "Any USSD code, e.g. *138#", onkeydown: (e) => e.key === "Enter" && send("/api/ussd", code.value) });
  const reply = h("input.field", { placeholder: "Your reply, e.g. 1", onkeydown: (e) => e.key === "Enter" && send("/api/ussd/reply", reply.value) });
  const replyRow = h("div.inline.mt", { style: { display: "none" } }, reply,
    h("button.btn.primary", { onclick: () => send("/api/ussd/reply", reply.value) }, "Reply"),
    h("button.btn", { onclick: async () => { await api("/api/ussd/cancel", {}); replyRow.style.display = "none"; out.className = "ussd-out muted"; out.textContent = "Session ended."; } }, "End"));
  const quick = live?.ussd_shortcuts || []; // per-operator shortcuts from the server; any code works in the box below
  let busy = false;
  const btns = quick.map(([c, t, s]) => h("button.item", { onclick: () => send("/api/ussd", c) },
    h("span.ic", icon(/airtime|credit/i.test(t) ? "sim" : "bars")), h("span.main", h("b", t), h("span", s)), h("span.tag", c), h("span.chev", icon("chev"))));
  async function send(path, c) {
    c = c.trim(); if (!c || busy) return;
    busy = true; btns.forEach((b) => (b.disabled = true));
    out.className = "ussd-out muted"; out.textContent = `Asking ${OP()} (${c})…`;
    try {
      const r = await api(path, { code: c });
      out.className = r.ok ? "ussd-out" : "ussd-out err";
      out.textContent = r.ok ? r.text || "(empty reply)" : r.error;
      replyRow.style.display = r.ok && r.needs_reply ? "flex" : "none";
      if (r.needs_reply) { reply.value = ""; reply.focus(); }
    } catch (e) { out.className = "ussd-out err"; out.textContent = e.message; }
    busy = false; btns.forEach((b) => (b.disabled = false));
  }
  return h("div.grid2",
    h("div", h("div.list", btns), h("div.inline.mt", code, h("button.btn", { onclick: () => send("/api/ussd", code.value) }, "Send"))),
    h("div.panel", h("div.cap", `Reply from ${OP()}`), out, replyRow));
}
function openBalance() {
  const m = openModal({ title: "Balance & bundles", subtitle: `Uses the router's SIM to ask ${OP()} directly.` });
  m.body.append(balanceUI());
}

// ============================================================ Network / devices
function openNetwork(tab = "on") {
  const m = openModal({ title: "Network", cls: ".narrow" });
  const content = h("div"), segBox = h("div.center.mb");
  m.body.append(segBox, content);
  let data = { online: [], offline: [] }, cur = tab, detail = null;
  const devName = (d) => d.name || d.hostname || (d.me ? "This computer" : d.private ? "Private device" : `Device ${d.mac.slice(-5)}`);
  const devIcon = (d) => (d.kind === "lan" ? "cable" : d.me ? "laptop" : d.private ? "phone" : "device");
  function render() {
    segBox.replaceChildren(seg([[`Connected  ${data.online.length}`, "on"], [`Seen before  ${data.offline.length}`, "off"], ["Wi-Fi", "wifi"]], cur, (v) => { cur = v; detail = null; render(); }, ".wide"));
    m.back(detail ? () => { detail = null; render(); } : null);
    if (detail) return renderDetail(detail);
    m.title("Network"); m.sub("");
    if (cur === "wifi") return renderWifi();
    if (!live?.caps?.devices) return fill(content, unavailable("Device list not available here",
      `${live?.network?.name || "This network"} (${live?.network?.label || "unknown router"}) doesn't share its list of connected devices. ` +
      "That works on supported 4G routers. The Wi-Fi tab shows this computer's connection details."));
    const list = cur === "on" ? data.online : data.offline;
    fill(content, 
      h("div.muted", { style: { fontSize: "12px", marginBottom: "10px" } }, cur === "on" ? `${list.length} device${list.length === 1 ? "" : "s"} on ${live?.ssid || "the Wi-Fi"}. Click one to name it.` : "Devices that have connected before. Unrecognised ones? Change the Wi-Fi password."),
      list.length ? h("div.list", list.map((d) => h("button.item", { onclick: () => { detail = d; render(); } },
        h("span.ic", icon(devIcon(d))),
        h("span.main", h("b", devName(d)), h("span", [d.me ? "This device" : null, d.private ? "Private address" : null, d.ip].filter(Boolean).join(" · "))),
        h("span.tag", cur === "on" ? dur(d.connect_time, true) : ago(d.last_seen)),
        h("span.chev", icon("chev"))))) : h("div.empty", "None"));
  }
  function renderDetail(d) {
    m.title(devName(d)); m.sub(d.me ? "This device" : d.last_seen ? `Last seen ${ago(d.last_seen)}` : "Connected now", d.last_seen ? "" : "good");
    const name = h("input.field", { value: d.name || "", placeholder: "Give it a name, e.g. Mum's iPhone" });
    const saveBtn = h("button.btn.primary", { onclick: async () => { await api("/api/devices/rename", { mac: d.mac, name: name.value }); d.name = name.value.trim() || null; load(); render(); } }, icon("pencil"), "Save name");
    fill(content, 
      h("div.inline.mb", name, saveBtn),
      rowsEl([
        ["Status", d.last_seen ? "offline" : "active", d.last_seen ? null : "good"],
        ["IP address", d.ip],
        ["Hardware (MAC) address", d.mac],
        ["Address type", d.private ? "Private (random per network)" : "Permanent", null, "iPhones, iPads, Macs and newer Android phones use a random 'private' address on each Wi-Fi network for privacy."],
        ["Reported name", d.hostname || "none"],
        ["Connection", d.kind === "lan" ? "Ethernet cable" : `Wi-Fi · ${live?.ssid || ""}`],
        d.connect_time != null ? ["Connected for", dur(d.connect_time)] : null,
        ["First seen", d.first_seen ? new Date(d.first_seen * 1000).toLocaleString() : "–"],
      ]),
      d.last_seen ? h("div.mt", h("button.btn", { onclick: async () => { await api("/api/devices/forget", { mac: d.mac }); detail = null; load(); } }, "Forget this device")) : null,
      infobox("Per-device speed", "This router doesn't report traffic per device, so speed and usage are shown for the whole network on the main screen."));
  }
  async function renderWifi() {
    const i = await api("/api/info");
    if (cur !== "wifi" || detail) return;
    if (!i.caps.router) return fill(content, networkRows(i.network));
    const auth = { WPA2PSK: "WPA2 Personal", WPAPSKWPA2PSK: "WPA/WPA2 Personal", WPA3PSK: "WPA3", OPEN: "None (open!)" }[i.AuthMode] || i.AuthMode;
    fill(content, rowsEl([
      ["Network name", i.SSID1 + (i.HideSSID === "1" ? " (hidden)" : "")],
      ["Security", `${auth} · ${i.EncrypType}`, i.AuthMode === "OPEN" ? "bad" : null],
      ["Frequency", i.wifi_band === "a" ? "5 GHz" : "2.4 GHz", null, "2.4 GHz reaches further through walls; 5 GHz is faster at short range. This router is 2.4 GHz only."],
      ["Channel", i.Channel === "0" ? "Automatic" : i.Channel],
      ["Coverage setting", { short_mode: "Short", medium_mode: "Medium", long_mode: "Long" }[i.wifi_coverage] || i.wifi_coverage, null, "Transmit power. 'Long' reaches further rooms but can cause more interference with neighbours."],
      ["Guest network", i.m_ssid_enable === "1" ? "On" : "Off"],
      ["Device limit", i.MAX_Access_num],
      ["Router address", i.lan_ipaddr],
      ["Addresses handed out", `${i.dhcpStart} – ${i.dhcpEnd}`],
      ["Address lease", `${i.dhcpLease_hour} hours`],
    ]), h("div.muted.mt", { style: { fontSize: "12px" } }, `To change the Wi-Fi name or password, use the router's own page at http://${GW()}.`));
  }
  async function load() { data = await api("/api/devices"); if (!detail && cur !== "wifi") render(); }
  render(); m.every(load, 10000);
}

// ============================================================ Internet check
function openCheck() {
  const m = openModal({ title: "Internet check", subtitle: "Tests each link from this computer to the web, so you can see exactly where a problem is.", cls: ".narrow" });
  const steps = [["Mac", "laptop", "this computer"], ["Router", "router", live?.network?.gateway || "gateway"], ["Internet", "tower", "1.1.1.1"], ["DNS", "book", "names"], ["Web", "globe", "pages"]];
  const nodes = steps.map(([n, ic, s]) => h("div.node", h("div.c", icon(ic)), h("b", n), h("span", s)));
  const results = h("div"), advice = h("div");
  const btn = h("button.btn.big.primary", { onclick: run }, icon("play"), "Run check");
  m.body.append(h("div.chain", nodes), btn, results, advice);
  async function run() {
    btn.disabled = true; btn.replaceChildren(icon("refresh"), "Checking…"); fill(results, ); fill(advice, );
    nodes.forEach((n, i) => (n.className = "node" + (i === 0 ? " ok" : " run")));
    try {
      const { checks } = await api("/api/diagnose");
      let failed = false;
      checks.forEach((c, i) => { const n = nodes[i + 1]; n.className = "node " + (failed ? "" : c.ok ? "ok" : "bad"); if (!c.ok) failed = true; n.lastChild.textContent = c.ok ? c.short : "failed"; });
      fill(results, h("div.mt", rowsEl(checks.map((c) => [c.name, c.detail, c.ok ? "good" : "bad"]))));
      const fail = checks.find((c) => !c.ok);
      m.sub(fail ? `Problem found: ${fail.name.toLowerCase()}` : "Everything works end to end.", fail ? "bad" : "good");
      fill(advice, infobox(fail ? "What to do" : "All good",
        !fail ? "If a particular website or app still fails, the problem is with that service, not your connection."
          : fail.name === "Mac to router" ? "This computer can't reach the router. Reconnect to the Wi-Fi, or restart the router."
          : fail.name === "Router to internet" ? "The router is up but the mobile network isn't passing traffic. Most often the data bundle has run out: check your balance. If you have data, restart the router."
          : fail.name === "Website names (DNS)" ? "The internet is reachable but website names don't resolve. Restart the router; if it continues, set the Mac's DNS to 1.1.1.1."
          : "Pages aren't loading even though the connection is up. If you were redirected, your provider may be showing a ‘buy a bundle’ page."));
    } catch (e) { m.sub(e.message, "bad"); nodes.forEach((n) => n.classList.remove("run")); }
    btn.disabled = false; btn.replaceChildren(icon("refresh"), "Run again");
  }
  run();
}

// ============================================================ Settings / about
// Fivebars setup: router password, OpenCellID key and country. Saved only on this computer;
// the server never sends secrets back, only whether they are set.
function setupPanel(cfg, onChange) {
  const msg = h("div.muted", { style: { fontSize: "12px", minHeight: "16px", marginTop: "8px" } });
  const say = (t, bad) => { msg.textContent = t; msg.style.color = bad ? "var(--critical-text)" : "var(--good-text)"; };
  const save = async (body, okText) => {
    try { const c = await api("/api/config", body); say(okText); onChange?.(c); return c; }
    catch (e) { say(e.message, true); }
  };
  const pw = h("input.field", { type: "password", autocomplete: "off",
    placeholder: cfg.router_password_set ? "Saved. Type to replace" : "Factory default is admin" });
  const key = h("input.field", { type: "password", autocomplete: "off", spellcheck: "false",
    placeholder: cfg.opencellid_key_set ? "Saved. Paste to replace" : "pk.… (free)" });
  const country = h("select.field", { onchange: () => save({ country_mcc: country.value }, "Country saved.") },
    h("option", { value: "" }, "Automatic (from the router's SIM)"),
    ...cfg.countries.map((c) => h("option", { value: c.mcc, selected: cfg.country_from === "settings" && c.mcc === cfg.country_mcc ? "" : null }, `${c.name} (${c.mcc})`)));
  const dl = h("button.btn.sm", { onclick: async () => {
    dl.disabled = true; dl.textContent = "Downloading…";
    try { const r = await api("/api/towers/update", {}); say(`Downloaded ${r.sites.toLocaleString()} masts.`); pollMap(); }
    catch (e) { say(e.message, true); }
    dl.disabled = false; dl.replaceChildren(icon("refresh"), "Download tower data");
  } }, icon("refresh"), "Download tower data");
  const field = (label, input, button, help) => h("div", { style: { marginBottom: "14px" } },
    h("div", { style: { fontSize: "12px", color: "var(--text-2)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" } }, label, help ? infoI(help) : null),
    h("div.inline", input, button));
  return h("div.panel.mb", h("div.cap", "Fivebars setup"),
    h("div.grid2",
      h("div",
        field("Router admin password", pw, h("button.btn.sm", { onclick: () => save({ router_password: pw.value }, pw.value ? "Router password saved." : "Router password cleared (using admin).").then(() => (pw.value = "")) }, "Save"),
          "Only used to read details from supported 4G routers (ZTE firmware). Stored on this computer only."),
        field("Country for the tower map", country, null, cfg.country_from === "router SIM" ? `Currently detected from the router's SIM: ${cfg.country_mcc}` : "Pick your country to download its masts.")),
      h("div",
        field("OpenCellID API key", key, h("button.btn.sm", { onclick: () => save({ opencellid_key: key.value.trim() }, key.value ? "Key saved." : "Key removed.").then(() => (key.value = "")) }, "Save"),
          "Free from opencellid.org (sign up, then My API Tokens). Used only to download your country's tower list."),
        h("div.inline", { style: { alignItems: "center" } }, dl,
          h("a.link", { href: "https://opencellid.org/register.php", target: "_blank", rel: "noopener" }, "Get a free key ›")))),
    msg,
    h("div.muted", { style: { fontSize: "11.5px", marginTop: "6px" } }, `Fivebars ${cfg.version} · data stored in ${cfg.data_dir}`));
}

function openSettings() {
  const m = openModal({ title: "Settings & router info" });
  const body = h("div");
  m.body.append(body);
  async function load() {
    const [i, cfg] = await Promise.all([api("/api/info"), api("/api/config")]);
    const themeT = h("button.toggle" + (document.documentElement.dataset.theme === "light" ? ".on" : ""), { onclick: () => { toggleTheme(); themeT.classList.toggle("on"); } });
    const notifT = h("button.toggle" + (notifyOn() ? ".on" : ""), { onclick: async () => { await setNotify(!notifyOn()); notifT.classList.toggle("on", notifyOn()); } });
    const rowT = (label, t, tip) => h("div.kv", h("span.k", label, tip ? infoI(tip) : null), t);
    fill(body,
      setupPanel(cfg),
      h("div.grid2",
        h("div",
          h("div.panel", h("div.cap", "Dashboard"), h("div.rows",
            rowT("Light theme", themeT), rowT("Desktop notifications", notifT, "Get a desktop notification when the connection drops, the signal gets weak, or latency spikes."),
            h("div.kv", h("span.k", "Recording since"), h("span.val", i.since ? new Date(i.since * 1000).toLocaleString() : "–")),
            h("div.kv", h("span.k", "Samples stored"), h("span.val", `${i.samples.toLocaleString()} · ${bytesStr(i.db_size)}`)),
            h("div.kv", h("span.k", "Fivebars"), h("button.link", { onclick: async () => {
              if (!confirm("Quit Fivebars? Monitoring stops until you open it again.")) return;
              await api("/api/quit", {});
              document.body.replaceChildren(h("div", { style: { padding: "80px 24px", textAlign: "center", color: "var(--text-2)" } },
                h("div", { style: { fontSize: "20px", fontWeight: 650, color: "var(--text)", marginBottom: "8px" } }, "Fivebars has stopped"),
                "You can close this window. Open Fivebars again to resume monitoring."));
            } }, "Quit")),
            h("div.kv", h("span.k", "Event log"), h("button.link", { onclick: async () => { if (confirm("Clear all finished events?")) { await api("/api/events/clear", {}); pollEvents(); } } }, "Clear")))),
          h("div.panel.mt", h("div.cap", "Security"), !i.caps.router ? h("div.sec", "Router security checks are only available on supported 4G routers.") : i.default_password
            ? h("div.sec", { style: { lineHeight: 1.6 } }, h("div", { style: { color: "var(--warning)", fontWeight: 600, marginBottom: "6px" } }, "Router password is still the factory default (admin)"),
              `Anyone on your Wi-Fi can log in and change settings. Change it on the router's page (http://${GW()}), then enter the new password under Fivebars setup.`)
            : h("div.sec", "Router password has been changed. Good."))),
        !i.caps.sim ? h("div",
          h("div.panel", h("div.cap", "This network"), networkRows(i.network)),
          h("div.panel.mt", h("div.cap", "Networks seen"), rowsEl(i.networks.map((n) => [n.name || "Network", `${n.label || ""} · ${ago(n.last_seen)}`])))) :
        h("div.panel", h("div.cap", "SIM & router"), rowsEl([
          ["Operator", `${i.operator || ""} (${i.mccmnc || "–"})`],
          ["Public IP", i.wan_ip, null, "10.x and 100.64–127.x addresses are shared by many customers (carrier-grade NAT), so you can't host servers or forward ports."],
          ["APN", `${i.wan_apn} · ${i.apn_mode}`],
          ["Roaming", i.roam_setting_option === "on" ? "Allowed" : "Blocked"],
          ["SIM lock", i.sim_lock_status === "unlock" ? "Unlocked" : i.sim_lock_status],
          ["ICCID", i.ziccid, null, "The SIM card's serial number, printed on the card."],
          ["IMSI", i.sim_imsi],
          ["IMEI", i.imei, null, "The router's unique modem ID."],
          ["Firmware", i.cr_version],
          ["Firmware update", i.fota_new_version_state === "no_new_version" ? "Up to date" : i.fota_new_version_state, i.fota_new_version_state === "no_new_version" ? "good" : "warn"],
        ]))));
  }
  load();
}

// ============================================================ alerts popover
let pop = null;
function closeAllPop() { pop?.remove(); pop = null; }
async function openAlerts() {
  if (pop) return closeAllPop();
  let tab = "active";
  const body = h("div.pop-b"), tabs = h("div.tabs");
  const notifBtn = h("button", { onclick: async () => { await setNotify(!notifyOn()); renderHead(); } });
  const renderHead = () => notifBtn.replaceChildren(h("span", { style: { color: notifyOn() ? "var(--good-text)" : "var(--text-3)" } }, notifyOn() ? "Notifications on" : "Notifications off"));
  renderHead();
  pop = h("div.pop", h("div.pop-h", h("h3", "Alerts"), h("div.right", notifBtn)), tabs, body);
  document.body.append(pop);
  setTimeout(() => document.addEventListener("mousedown", outside), 0);
  function outside(e) { if (pop && !pop.contains(e.target) && !e.target.closest("#bellBtn")) { closeAllPop(); document.removeEventListener("mousedown", outside); } }
  const [{ checks }, { events, now }] = await Promise.all([api("/api/status"), api("/api/events?limit=200")]);
  const active = checks.filter((c) => !c.ok && c.alert);
  const openEv = events.filter((e) => e.open && e.level !== "info");
  const render = () => {
    fill(tabs, ...[["active", "Active", active.length + openEv.length], ["history", "History"], ["status", "Status"]].map(([k, l, n]) =>
      h("button", { class: tab === k ? "on" : null, onclick: () => { tab = k; render(); } }, l, n ? h("span.count", n) : null)));
    if (tab === "active") {
      const items = [...openEv.map((e) => ({ level: e.level, title: e.title, sub: `started ${ago(e.ts)} · ${e.detail}` })),
        ...active.filter((c) => !openEv.some((e) => e.title.toLowerCase().includes(c.label.toLowerCase().split(" ")[0]))).map((c) => ({ level: c.level, title: c.label + " — failing", sub: c.detail }))];
      fill(body, ...(items.length ? items.map((a) => h("div.al", h(`i.dot.${a.level}`), h("div", h("b", a.title), h("span", a.sub))))
        : [h("div.empty", "No active alerts. Everything looks healthy.")]));
    } else if (tab === "history") {
      const hist = events.filter((e) => e.level !== "info");
      fill(body, ...(hist.length ? hist.map((e) => h("div.al", h(`i.dot.${e.level}`), h("div", h("b", e.title),
        h("span", e.open ? `ongoing · started ${ago(e.ts)}` : `lasted ${dur(e.duration || 0)} · ${ago(e.ts)}`)))) : [h("div.empty", "No problems recorded.")]));
    } else {
      const groups = {};
      checks.forEach((c) => (groups[c.group] ||= []).push(c));
      fill(body, ...Object.entries(groups).flatMap(([g, cs]) => [h("div.grp", g),
        ...cs.map((c) => h("div.st", h(`i.dot.${c.ok ? "good" : c.level}`), c.label, h("span.d", c.detail)))]));
    }
  };
  render();
}
async function setNotify(on) {
  if (on && "Notification" in window && Notification.permission !== "granted") await Notification.requestPermission();
  localStorage.setItem("notify", on && Notification.permission === "granted" ? "1" : "0");
}


// ============================================================ Coverage map
let providerSlots = {}; // provider -> 1..3, assigned by the server (brand-like for big carriers)
const pColor = (p) => cssVar(providerSlots[p] ? `--p${providerSlots[p]}` : "--text-3");
// Stadia Maps serves localhost without an API key.
const TILE = (theme) => `https://tiles.stadiamaps.com/tiles/${theme === "light" ? "alidade_smooth" : "alidade_smooth_dark"}/{z}/{x}/{y}{r}.png`;
const ATTRIB = '© <a href="https://stadiamaps.com/">Stadia Maps</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Towers: <a href="https://opencellid.org">OpenCellID</a> CC BY-SA 4.0';
const maps = new Set();
const fmtDist = (m) => (m == null ? "–" : m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`);
const mapFilters = JSON.parse(localStorage.getItem("mapFilters") || '{"hide":[]}');

function makeMap(el, { interactive = true } = {}) {
  const map = L.map(el, {
    zoomControl: interactive, attributionControl: interactive, dragging: interactive, scrollWheelZoom: interactive,
    doubleClickZoom: interactive, boxZoom: interactive, keyboard: interactive, touchZoom: interactive,
    preferCanvas: true, renderer: L.canvas({ tolerance: 8 }), // bigger hit area than the dots themselves
  });
  if (interactive) map.zoomControl.setPosition("bottomright");
  const tiles = L.tileLayer(TILE(document.documentElement.dataset.theme), { maxZoom: 20, attribution: ATTRIB }).addTo(map);
  const ref = { map, tiles, layers: L.layerGroup().addTo(map), data: null, redraw: null };
  maps.add(ref);
  return ref;
}

function siteTooltip(s) {
  const t = document.createElement("div");
  t.append(h("b", `${s.provider} ${s.radio}`), s.dist != null ? `  ·  ${fmtDist(s.dist)}` : "",
    h("br"), h("span.muted", s.enb ? `Mast (eNB) ${s.enb} · ${s.cells} antenna${s.cells === 1 ? "" : "s"} mapped` : `${s.cells} cell${s.cells === 1 ? "" : "s"} mapped`));
  return t;
}
function sitePopup(s) {
  return h("div",
    h("div", h("b", `${s.provider} ${s.radio}`), s.enb ? ` · eNB ${s.enb}` : ""),
    h("div.muted", `${s.dist != null ? fmtDist(s.dist) + " from you · " : ""}${s.cells} cell${s.cells === 1 ? "" : "s"}, ${s.samples} measurement${s.samples === 1 ? "" : "s"}`),
    h("div.muted", `Area code${s.areas.length > 1 ? "s" : ""} ${s.areas.slice(0, 4).join(", ")} · updated ${new Date(s.updated * 1000).toLocaleDateString([], { month: "short", year: "numeric" })}`),
    h("div.muted", { style: { marginTop: "6px" } }, "Position is the average of crowdsourced measurements; the real mast can be a few hundred metres away."));
}

// Draws towers, you, the (likely) serving mast and the beam between you.
function drawCoverage(ref, d, { mini = false } = {}) {
  const { map, layers } = ref;
  providerSlots = d.colors || providerSlots;
  ref.data = d;
  layers.clearLayers();
  const hide = new Set(mapFilters.hide);
  const surface = cssVar("--card");
  const sv = d.serving, target = sv.exact || sv.candidates[0];
  const isExact = !!sv.exact;
  const me = d.location ? [d.location.lat, d.location.lon] : null;

  // signal-distance band around you
  if (me && sv.est_range_m && !mini) {
    for (const r of sv.est_range_m)
      L.circle(me, { radius: r, color: cssVar("--text-3"), weight: 1, dashArray: "3 5", fill: false, interactive: false }).addTo(layers);
    L.circle(me, { radius: sv.est_range_m[1], stroke: false, fillColor: cssVar("--text"), fillOpacity: 0.03, interactive: false }).addTo(layers);
  }
  if (me && d.location.accuracy > 30 && !mini)
    L.circle(me, { radius: d.location.accuracy, color: cssVar("--series-1"), weight: 1, opacity: 0.5, fillOpacity: 0.06, interactive: false }).addTo(layers);

  // approximate coverage areas: soft circles per mast (OpenCellID's own range field is almost always a 1 km default,
  // so typical urban cell sizes are used). Overlaps build up into a readable coverage picture at country zoom.
  const order = { "2G": 0, "3G": 1, "4G": 2, "5G": 3 };
  const visible = d.sites.filter((s) => !hide.has(s.provider) && !hide.has(s.radio));
  if (!mini && !hide.has("coverage"))
    for (const s of visible) {
      if (s.radio === "2G") continue;
      L.circle([s.lat, s.lon], { radius: s.radio === "4G" ? 1500 : 2500, stroke: false, fillColor: pColor(s.provider), fillOpacity: 0.07, interactive: false }).addTo(layers);
    }

  // towers: 4G filled, 3G hollow ring, 2G small dot; 2px surface ring separates overlaps. Shrink when zoomed out.
  const z = map.getZoom ? map.getZoom() : 14;
  const k = mini ? 1 : z <= 8 ? 0.32 : z <= 10 ? 0.5 : z <= 12 ? 0.75 : 1;
  const small = k < 0.6;
  for (const s of visible.sort((a, b) => order[a.radio] - order[b.radio])) {
    const c = pColor(s.provider);
    const opts = s.radio === "3G" ? { radius: (mini ? 3.5 : 5) * k + (small ? 0.6 : 0), color: c, weight: small ? 1 : 2, fillColor: small ? c : surface, fillOpacity: 1 }
      : s.radio === "2G" ? { radius: (mini ? 2 : 3.5) * k + 0.5, color: surface, weight: small ? 0 : 1, fillColor: c, fillOpacity: 0.9 }
      : { radius: (mini ? 4 : 6.5) * k + (small ? 0.8 : 0), color: surface, weight: small ? 0 : 2, fillColor: c, fillOpacity: 1 };
    const mk = L.circleMarker([s.lat, s.lon], opts).addTo(layers);
    if (!mini) { mk.bindTooltip(siteTooltip(s), { className: "mtip", direction: "top", offset: [0, -6] }); mk.bindPopup(sitePopup(s), { className: "mpop" }); }
  }

  // other candidates (possible masts)
  if (!isExact && !mini) for (const c of sv.candidates.slice(1))
    L.circleMarker([c.lat, c.lon], { radius: 13, color: cssVar("--accent"), weight: 1.5, dashArray: "3 4", fill: false, interactive: false }).addTo(layers);

  if (target) {
    const tt = [target.lat, target.lon];
    if (me) {
      L.polyline([me, tt], { color: cssVar("--accent"), weight: mini ? 1.5 : 2.5, opacity: 0.95, dashArray: isExact ? null : "7 7", interactive: false }).addTo(layers);
    }
    L.marker(tt, { icon: L.divIcon({ className: "", html: `<div class="pulse-ring${isExact ? "" : " likely"}"></div>`, iconSize: [46, 46], iconAnchor: [23, 23] }), interactive: false }).addTo(layers);
    if (!mini) {
      const dist = me ? Math.round(map.distance(me, tt)) : null;
      L.tooltip({ permanent: true, direction: "right", offset: [18, 0], className: "tag-beam", interactive: false })
        .setLatLng(tt).setContent(`${isExact ? "CONNECTED" : "LIKELY"} · eNB ${target.enb}${dist ? " · " + fmtDist(dist) : ""}`).addTo(layers);
    }
  }
  if (me) L.marker(me, { icon: L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false, zIndexOffset: 1000 }).addTo(layers);
}

function fitCoverage(ref, d, pad = 40) {
  const sv = d.serving, target = sv.exact || sv.candidates[0];
  const pts = [];
  if (d.location) pts.push([d.location.lat, d.location.lon]);
  if (target) pts.push([target.lat, target.lon]);
  if (pts.length === 2) ref.map.fitBounds(pts, { padding: [pad, pad], maxZoom: 16 });
  else ref.map.setView(pts[0] || d.center, 14);
}

// ---- mini map card
let mini = null;
async function pollMap() {
  try {
    const d = await api("/api/map?km=2.5");
    const box = $("#miniMap"), sum = $("#mapSummary");
    if (!d.have_data) {
      fill(sum, "No tower data yet. Add your country and a free OpenCellID key in ", h("button.link", { onclick: openSettings }, "Settings ›"));
      return;
    }
    if (!mini) { mini = makeMap(box, { interactive: false }); box.onclick = openMap; drawCoverage(mini, d, { mini: true }); fitCoverage(mini, d, 30); }
    else drawCoverage(mini, d, { mini: true });
    const sv = d.serving, t = sv.exact || sv.candidates[0];
    const dist = d.location && t ? fmtDist(L.latLng(d.location.lat, d.location.lon).distanceTo([t.lat, t.lon])) : null;
    const row = (k, ...v) => h("div.row", h("span.k", k), ...v);
    if (sv.enb == null) return fill(sum,
      row("Your mast", h("span.big2", "Not reported"), h("div.muted", { style: { fontSize: "12px", marginTop: "2px" } }, `${live?.network?.name || "This network"} doesn't share it`)),
      row("Masts within 2.5 km", ...(d.providers.length ? d.providers.map((p) => h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: "3px" } },
        h("span", h("span.swatch", { style: { background: pColor(p.provider) } }), p.provider),
        h("span.mono", `${p["4G"]} 4G · ${p["3G"]} 3G`))) : [h("span.muted", "none mapped")])),
      d.location ? null : row("Your location", h("button.link", { onclick: openMap }, "Set it for distances ›")));
    fill(sum,
      row(sv.exact ? "Connected mast" : "Likely mast", h("span.big2", t ? `eNB ${t.enb}` : "–"),
        h("div.muted", { style: { fontSize: "12px", marginTop: "2px" } }, dist ? `${dist} from you` : sv.exact ? "on the map" : "exact mast not mapped yet")),
      row("Rough distance from signal", h("span.big2", sv.est_range_m ? `${fmtDist(sv.est_range_m[0])}–${fmtDist(sv.est_range_m[1])}` : "–")),
      row("Masts within 2.5 km", ...(d.providers.length ? d.providers.map((p) => h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: "3px" } },
        h("span", h("span.swatch", { style: { background: pColor(p.provider) } }), p.provider),
        h("span.mono", `${p["4G"]} 4G · ${p["3G"]} 3G`))) : [h("span.muted", "none mapped")])),
      d.location ? null : row("Your location", h("button.link", { onclick: openMap }, "Set it for distances ›")));
  } catch (e) {}
}

// ---- full map
function openMap() {
  const m = openModal({ title: "Coverage map", cls: ".full" });
  const mapEl = h("div.mapfull");
  const left = h("div.mpanel.left"), right = h("div.mpanel.right"), legend = h("div.mlegend");
  m.body.append(mapEl, ...(matchMedia("(max-width: 760px)").matches ? [legend, left, right] : [left, right, legend]));
  const ref = makeMap(mapEl);
  m.chart({ draw: () => ref.redraw?.() }); // redraw on theme change
  const GHANA = [[4.6, -3.4], [11.2, 1.3]];
  let km = localStorage.getItem("mapKm") === "all" ? "all" : Number(localStorage.getItem("mapKm")) || 3, picking = false, first = true;
  ref.map.on("zoomend", () => ref.redraw?.()); // dot sizes follow the zoom level
  const origClose = m.close;

  ref.map.on("click", async (e) => {
    if (!picking) return;
    picking = false; m.modal.classList.remove("picking");
    await api("/api/location", { lat: e.latlng.lat, lon: e.latlng.lng, accuracy: 0, source: "map" });
    first = true; load(); pollMap();
  });

  function useGps(btn) {
    if (!navigator.geolocation) return;
    btn.disabled = true; btn.textContent = "Locating…";
    navigator.geolocation.getCurrentPosition(async (pos) => {
      await api("/api/location", { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy, source: "macOS" });
      first = true; load(); pollMap();
    }, (err) => {
      btn.disabled = false; btn.textContent = "Use my location";
      locMsg = err.code === 1 ? "Location access was blocked. Allow it for Chrome in System Settings → Privacy & Security → Location Services, or pick your spot on the map."
        : "Couldn't get a location fix. Pick your spot on the map instead.";
      renderPanels(ref.data);
    }, { enableHighAccuracy: true, timeout: 15000 });
  }
  let locMsg = "";

  function renderLegend() {
    const hide = new Set(mapFilters.hide);
    const toggle = (k) => { hide.has(k) ? hide.delete(k) : hide.add(k); mapFilters.hide = [...hide]; localStorage.setItem("mapFilters", JSON.stringify(mapFilters)); renderLegend(); ref.redraw(); };
    const provs = Object.keys(providerSlots).sort((a, b) => providerSlots[a] - providerSlots[b]);
    fill(legend, 
      ...provs.map((p) => h("button", { class: hide.has(p) ? "off" : null, onclick: () => toggle(p) }, h("span.swatch", { style: { background: pColor(p) } }), p)),
      h("span.sep"),
      ...[["4G", ""], ["3G", ".g3"], ["2G", ".g2"]].map(([r, c]) => h("button", { class: hide.has(r) ? "off" : null, onclick: () => toggle(r) }, h("span.shape" + c), r)),
      h("span.sep"),
      h("button", { class: hide.has("coverage") ? "off" : null, onclick: () => toggle("coverage"), title: "Approximate area each mast covers" },
        h("span", { style: { width: "14px", height: "14px", borderRadius: "50%", background: "color-mix(in srgb, var(--text) 18%, transparent)" } }), "Coverage areas"),
      h("span.sep"),
      h("span", { style: { display: "inline-flex", alignItems: "center", gap: "7px", padding: "0 10px", fontSize: "12px", color: "var(--text-2)" } },
        h("span", { style: { width: "16px", borderTop: "2px dashed var(--accent)" } }), "Likely link"));
  }

  function renderPanels(d) {
    const sv = d.serving, t = sv.exact || sv.candidates[0];
    const dist = d.location && t ? Math.round(L.latLng(d.location.lat, d.location.lon).distanceTo([t.lat, t.lon])) : null;
    const gpsBtn = h("button.btn.sm", { onclick: (e) => useGps(e.currentTarget) }, icon("target"), "Use my location");
    const pickBtn = h("button.btn.sm", { onclick: () => { picking = true; m.modal.classList.add("picking"); pickBtn.textContent = "Click the map…"; } }, icon("pin"), "Pick on map");
    fill(left, 
      h("h3", "Coverage map"),
      h("div.lead", `${d.total_sites.toLocaleString()} masts in ${d.country_name} from OpenCellID · data from ${new Date(d.updated * 1000).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}`),
      h("div.cap", "Your connection"),
      sv.enb == null ? h("div.serve",
        h("div.st-line", h("i.dot.info"), "Mast not reported on this network"),
        h("p", `${live?.network?.name || "This network"} doesn't tell the dashboard which mast it uses. That works on supported 4G routers. ` +
          "The map still shows every provider's masts around your saved location.")) :
      h("div.serve",
        h("div.st-line" + (sv.exact ? ".exact" : ".likely"), h(`i.dot.${sv.exact ? "good" : "warning"}`), sv.exact ? "Connected mast found on the map" : "Likely mast (exact one isn't mapped yet)"),
        h("div.g",
          h("div", "Your mast (eNB)", h("b", sv.enb ?? "–")), h("div", "Antenna (sector)", h("b", sv.sector ?? "–")),
          h("div", "Area code (TAC)", h("b", sv.tac || "–")), h("div", "Band", h("b", bandName(sv.band))),
          h("div", "Signal", h("b", sv.rsrp != null ? `${sv.rsrp} dBm` : "–")),
          h("div", "Rough distance", h("b", sv.est_range_m ? `${fmtDist(sv.est_range_m[0])}–${fmtDist(sv.est_range_m[1])}` : "–"))),
        sv.exact ? h("p", `Mast ${sv.enb} is ${dist ? fmtDist(dist) + " from you" : "shown with a solid ring"}.`)
          : h("p", `Mast ${sv.enb} hasn't been recorded in OpenCellID yet, so the map shows the most likely one: `,
            h("b", `eNB ${t?.enb ?? "–"}`), t ? ` (${dist ? fmtDist(dist) + " away, " : ""}${t.enb_gap <= 5 ? "an adjacent ID in the same area code" : "same area code"}). ` : ". ",
            sv.candidates.length > 1 ? `Dashed rings mark ${sv.candidates.length - 1} other candidate${sv.candidates.length > 2 ? "s" : ""}. ` : "",
            d.location ? "" : "Set your location to rank candidates by distance.")),
      h("div.cap", "Your location"),
      h("div.sec", { style: { fontSize: "12px", lineHeight: 1.5 } },
        d.location ? `${d.location.lat.toFixed(4)}, ${d.location.lon.toFixed(4)} · ${d.location.source === "map" ? "picked on the map" : `from ${d.location.source}${d.location.accuracy ? ` (±${Math.round(d.location.accuracy)} m)` : ""}`}`
          : "Not set. The map is centred on your area code instead."),
      locMsg ? h("div", { style: { color: "var(--warning)", fontSize: "12px", marginTop: "6px", lineHeight: 1.5 } }, locMsg) : null,
      h("div.btnrow", gpsBtn, pickBtn, d.location ? h("button.btn.sm", { onclick: async () => { await api("/api/location/clear", {}); first = true; load(); pollMap(); } }, "Clear") : null),
      h("div.cap", "Search radius"),
      seg([["1 km", 1], ["3 km", 3], ["5 km", 5], ["10 km", 10], [d.country_name || "Country", "all"]], km, (v) => { km = v; localStorage.setItem("mapKm", v); first = true; load(); }));

    const total = (p) => p["4G"] + p["3G"] + p["2G"] + (p["5G"] || 0);
    fill(right, 
      h("h3", d.country ? `Providers in ${d.country_name}` : "Providers nearby"),
      h("div.lead", d.country ? `All ${d.sites.length.toLocaleString()} masts mapped in ${d.country_name}` : `Masts mapped within ${km} km of ${d.location ? "you" : "your area"}`),
      d.providers.length ? h("table.ptable.mt",
        h("thead", h("tr", h("th", "Provider"), h("th", "4G"), h("th", "3G"), h("th", "2G"), h("th", "Nearest"))),
        h("tbody", d.providers.map((p) => h("tr",
          h("td", h("span.swatch", { style: { background: pColor(p.provider) } }), p.provider),
          h("td", p["4G"] || "·"), h("td", p["3G"] || "·"), h("td", p["2G"] || "·"),
          h("td", d.location ? fmtDist(p.nearest) : "–"))))) : h("div.empty", "No masts mapped in this radius"),
      h("div.muted", { style: { fontSize: "11.5px", marginTop: "8px", lineHeight: 1.5 } },
        "More 4G masts nearby usually means better coverage for that provider. Crowdsourced data: areas few people have measured look emptier than they are."),
      d.country ? h("div", { style: { marginTop: "10px", padding: "10px 12px", borderRadius: "10px", border: "1px solid color-mix(in srgb, var(--warning) 45%, transparent)", color: "var(--text-2)", fontSize: "12px", lineHeight: 1.5 } },
        h("b", { style: { color: "var(--warning)" } }, "Empty areas aren't always empty: "),
        d.mcc === "620" ? "almost no masts north of Kintampo have been recorded in OpenCellID yet. " : "OpenCellID is crowdsourced, so rural areas and some operators are under-recorded. ",
        "That's missing data, not missing coverage. Coverage circles are approximate (about 1.5 km for 4G, 2.5 km for 3G).") : null,
      h("div.cap", "Masts you've used (7 days)"),
      d.history.length ? h("div.used", d.history.flatMap((u) => [
        h("span", `eNB ${u.enb} · s${u.sector}${u.site ? "" : " ·  unmapped"}`), h("span", `${Math.round(u.share * 100)}%`)])) : h("div.muted", "Nothing recorded yet"),
      h("div.btnrow", h("button.btn.sm", { onclick: (e) => updateDb(e.currentTarget) }, icon("refresh"), "Update tower data")));
  }

  async function updateDb(btn) {
    btn.disabled = true; btn.textContent = "Downloading…";
    try { await api("/api/towers/update", {}); load(); pollMap(); }
    catch (e) { btn.textContent = "Failed"; btn.title = e.message; alert("Tower data update failed: " + e.message); }
  }

  async function load() {
    const d = await api(`/api/map?km=${km}`);
    if (!d.have_data) {
      fill(left, h("h3", "Coverage map"),
        h("div.lead", !d.mcc ? "Choose your country in Settings → Fivebars setup." : !d.have_key
          ? "Add a free OpenCellID API key in Settings → Fivebars setup to download your country's masts."
          : `Masts for ${d.country_name} haven't been downloaded yet.`),
        h("div.btnrow", d.mcc && d.have_key ? h("button.btn.sm", { onclick: (e) => updateDb(e.currentTarget) }, icon("refresh"), "Download tower data") : null,
          h("button.btn.sm", { onclick: () => { m.close(); openSettings(); } }, icon("settings"), "Open settings")));
      fill(right); right.style.display = "none";
      ref.map.setView(d.center, d.mcc ? 7 : 2);
      return;
    }
    right.style.display = "";
    ref.redraw = () => { ref.tiles.setUrl(TILE(document.documentElement.dataset.theme)); drawCoverage(ref, ref.data); renderLegend(); };
    drawCoverage(ref, d); renderPanels(d); renderLegend();
    if (first) { d.country ? ref.map.fitBounds(GHANA, { padding: [20, 20] }) : fitCoverage(ref, d, 120); first = false; }
  }
  load();
  m.every(load, 30000);
  setTimeout(() => ref.map.invalidateSize(), 50);
  const bd = m.modal.parentElement;
  new MutationObserver(() => { if (!bd.isConnected) { maps.delete(ref); ref.map.remove(); } }).observe(document.body, { childList: true });
}

// ============================================================ theme, dock, boot
function toggleTheme() {
  const t = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = t; localStorage.setItem("theme", t);
  $("#themeBtn").replaceChildren(icon(t === "light" ? "sun" : "moon"));
  charts.forEach((c) => c.draw());
  if (live) renderLive(live);
  if (mini?.data) { mini.tiles.setUrl(TILE(t)); drawCoverage(mini, mini.data, { mini: true }); }
}
$("#themeBtn").replaceChildren(icon(document.documentElement.dataset.theme === "light" ? "sun" : "moon"));
$("#themeBtn").onclick = toggleTheme;
async function renameNetwork() {
  const n = live?.network;
  if (!n?.connected) return;
  const name = prompt(n.named_by === "default"
    ? "What's this network called? (macOS hides Wi-Fi names from apps, so the dashboard can't read it)"
    : "Rename this network (leave empty to use its own name):", n.named_by === "you" || n.named_by !== "default" ? n.name : "");
  if (name === null) return;
  await api("/api/network/rename", { name });
  pollLive(); pollMap();
}
$("#brandName").onclick = renameNetwork;
$("#bellBtn").onclick = openAlerts;
$("#placementLink").onclick = openPlacement;
$("#mapLink").onclick = openMap;

const DOCK = [
  ["gauge", "Speed test", openSpeedTest], ["target", "Placement", openPlacement], ["bars", "Data usage", () => openUsage()],
  ["map", "Coverage map", openMap], ["wifi", "Network & devices", () => openNetwork()], ["sim", "Balance & bundles", openBalance], null,
  ["activity", "Internet check", openCheck], ["settings", "Settings & router info", openSettings],
];
$("#dock").replaceChildren(...DOCK.map((d) => d ? h("button", { onclick: d[2], "aria-label": d[1] }, icon(d[0]), h("span.lbl", d[1])) : h("div.sep")));

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input") || e.metaKey || e.ctrlKey || document.querySelector(".backdrop")) return;
  const map = { m: openMap, s: openSpeedTest, p: openPlacement, d: () => openUsage(), n: () => openNetwork(), b: openBalance, c: openCheck };
  map[e.key]?.();
});

// deep links: open a panel straight from the URL, e.g. http://localhost:8080/#speed
const HASH = { speed: openSpeedTest, placement: openPlacement, usage: () => openUsage(), balance: openBalance, network: () => openNetwork(),
  check: openCheck, settings: openSettings, map: openMap, latency: openLatency, signal: openSignal, alerts: openAlerts };
const fromHash = () => HASH[location.hash.slice(1)]?.();
window.addEventListener("hashchange", () => { document.querySelectorAll(".backdrop").forEach((b) => b.remove()); fromHash(); });

pollLive(); pollHistory(); pollEvents(); pollMap();
setInterval(pollMap, 60000);
setTimeout(fromHash, 300);
setInterval(pollLive, 2000);
setInterval(() => pollHistory(), 4000);
setInterval(pollEvents, 5000);
