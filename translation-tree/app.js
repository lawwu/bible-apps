/* The Translation Tree — renders the genealogy in data.js. No dependencies.
   Layout: columns are fixed x positions; y is a piecewise time scale
   (the empty stretches of history are compressed, the crowded ones opened up).
   Clicking a Bible lights its whole lineage — ancestors and heirs. */

const COLS = [170, 300, 450, 620, 780, 940, 1100];
const W = 1240;
const MARGIN_TOP = 26;
const NODE_H = 42;
const MIN_GAP = 56;

/* piecewise time scale: domain years → chart px */
const Y_DOMAIN = [1355, 1374, 1516, 1620, 1760, 1780, 1870, 2026];
const Y_RANGE  = [0,    70,   150,  595,  645,  705,  755,  1745];
function yScale(v) {
  let i = Y_DOMAIN.length - 2;
  for (let k = 1; k < Y_DOMAIN.length; k++) if (v <= Y_DOMAIN[k]) { i = k - 1; break; }
  const t = (v - Y_DOMAIN[i]) / (Y_DOMAIN[i + 1] - Y_DOMAIN[i]);
  return Y_RANGE[i] + t * (Y_RANGE[i + 1] - Y_RANGE[i]);
}
const H = 1745 + MARGIN_TOP + 58;

const byId = new Map(NODES.map((n) => [n.id, n]));
const kidsOf = new Map(NODES.map((n) => [n.id, []]));
for (const n of NODES) for (const [pid] of n.parents) kidsOf.get(pid).push(n.id);

/* ---------- layout ---------- */

for (const n of NODES) {
  n.x = COLS[n.col];
  n.y = n.ypin ?? yScale(n.yr);
  n.w = Math.min(158, Math.max(74, n.short.length * 7.4 + 26));
}
for (let c = 0; c < COLS.length; c++) {
  const colNodes = NODES.filter((n) => n.col === c).sort((a, b) => a.y - b.y);
  for (let i = 1; i < colNodes.length; i++) {
    colNodes[i].y = Math.max(colNodes[i].y, colNodes[i - 1].y + MIN_GAP);
  }
}

function topY(n)   { return n.y - NODE_H / 2; }
function botY(n)   { return n.y + NODE_H / 2; }
function leftX(n)  { return n.x - n.w / 2; }
function rightX(n) { return n.x + n.w / 2; }

/* ---------- edges ----------
   The many fresh modern translations all drink from the critical text; drawing
   each as its own long curve makes spaghetti, so those flow down two shared
   "delta" trunks (one per column) with a short hook into each Bible. */

const DELTA_COLS = new Set([5, 6]);
const LANE_OFFSET = { 5: 88, 6: 70 };
const HORIZ = 50;          // |Δy| below this → connect side-to-side
const edges = [];          // {s, t, kind, label?, tx?}
const deltas = new Map();  // col -> {lane, kids: []}

for (const n of NODES) {
  for (const [pid, kind] of n.parents) {
    if (n.noEdge && n.noEdge.includes(pid)) continue;
    if (pid === "critical" && DELTA_COLS.has(n.col)) {
      if (!deltas.has(n.col)) deltas.set(n.col, { lane: COLS[n.col] - LANE_OFFSET[n.col], kids: [] });
      deltas.get(n.col).kids.push(n.id);
      continue;
    }
    edges.push({ s: pid, t: n.id, kind, label: n.edgeLabel });
  }
}

/* several parents arriving from above would stack their arrowheads on the
   node's top center — fan them out across the top edge instead */
for (const n of NODES) {
  const inbound = edges.filter((e) =>
    e.t === n.id && Math.abs(n.y - byId.get(e.s).y) >= HORIZ);
  if (inbound.length < 2) continue;
  inbound.sort((a, b) => byId.get(a.s).x - byId.get(b.s).x);
  inbound.forEach((e, i) => { e.tx = n.x + (i - (inbound.length - 1) / 2) * 26; });
}

function edgePath(e) {
  const s = byId.get(e.s), t = byId.get(e.t);
  if (Math.abs(t.y - s.y) < HORIZ) {       // near-horizontal: side to side
    const [x0, x1] = t.x > s.x ? [rightX(s), leftX(t) - 7] : [leftX(s), rightX(t) + 7];
    const mx = (x0 + x1) / 2;
    return `M${x0},${s.y} C${mx},${s.y} ${mx},${t.y} ${x1},${t.y}`;
  }
  const tx = e.tx ?? t.x;
  const y0 = botY(s), y1 = topY(t) - 7;
  if (t.y - s.y > 400 && t.x - s.x < -100) { // long left branch: bow out early
    return `M${s.x},${y0} C${s.x + (tx - s.x) * 0.75},${y0 + 80} ${tx},${y1 - 170} ${tx},${y1}`;
  }
  const my = (y0 + y1) / 2;
  return `M${s.x},${y0} C${s.x},${my} ${tx},${my} ${tx},${y1}`;
}

/* ---------- svg scaffold ---------- */

const svgNS = "http://www.w3.org/2000/svg";
function el(name, attrs, parent, text) {
  const e = document.createElementNS(svgNS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

const svg = document.getElementById("chart");
svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
svg.setAttribute("aria-label", "Family tree of English Bible translations, 1382 to today");

const defs = el("defs", {}, svg);
for (const key in STREAMS) {
  const m = el("marker", {
    id: `arrow-${key}`, viewBox: "0 0 10 10", refX: 8, refY: 5,
    markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse",
  }, defs);
  el("path", { d: "M0,0.8 L9,5 L0,9.2 Z", fill: STREAMS[key].color }, m);
}

const gMain = el("g", { transform: `translate(0,${MARGIN_TOP})` }, svg);
const gEras = el("g", {}, gMain);
const gDeltas = el("g", {}, gMain);
const gEdges = el("g", {}, gMain);
const gNodes = el("g", {}, gMain);
const tooltip = document.getElementById("tooltip");
const isMobile = window.matchMedia("(max-width: 760px)").matches;

/* era bands */
ERAS.forEach((d, i) => {
  const g = el("g", {}, gEras);
  el("rect", {
    class: "era-band", x: 4, width: W - 8,
    y: yScale(d.from), height: yScale(d.to) - yScale(d.from),
    fill: i % 2 ? "rgba(36,29,18,0.045)" : "none",
  }, g);
  el("line", { class: "era-line", x1: 4, x2: W - 4, y1: yScale(d.from), y2: yScale(d.from) }, g);
  el("text", { class: "era-name", x: W - 14, y: yScale(d.from) + 19 }, g,
    `${i === 0 ? 1382 : d.from} · ${d.name.toUpperCase()}`);
  el("text", { class: "era-sub", x: W - 14, y: yScale(d.from) + 34 }, g, d.sub);
});

/* delta trunks + hooks */
const trunkEls = [];
const hookEls = [];
for (const [col, delta] of deltas) {
  const crit = byId.get("critical");
  const kids = delta.kids.map((id) => byId.get(id)).sort((a, b) => a.y - b.y);
  const lane = delta.lane;
  const g = el("g", { class: "delta" }, gDeltas);
  const trunk = el("path", {
    class: "edge src trunk", stroke: STREAMS.critical.color,
    d: `M${crit.x + (col - 5) * 14},${botY(crit)} C${crit.x},${botY(crit) + 66} ${lane},${botY(crit) + 40} ${lane},${botY(crit) + 110} L${lane},${kids[kids.length - 1].y}`,
  }, g);
  trunkEls.push({ el: trunk, col });
  for (const k of kids) {
    const hook = el("path", {
      class: "edge src hook", stroke: STREAMS.critical.color,
      "marker-end": "url(#arrow-critical)",
      d: `M${lane},${k.y} L${leftX(k) - 6},${k.y}`,
    }, g);
    hookEls.push({ el: hook, t: k.id });
  }
}

/* edges */
const edgeEls = [];
for (const e of edges) {
  const t = byId.get(e.t);
  const p = el("path", {
    class: `edge ${e.kind}`, stroke: STREAMS[t.stream].color,
    "marker-end": `url(#arrow-${t.stream})`, d: edgePath(e),
  }, gEdges);
  edgeEls.push({ el: p, ...e });
  if (e.label) {
    const s = byId.get(e.s);
    el("text", {
      class: "edge-label", x: s.x + 9, y: (botY(s) + topY(t)) / 2 + 4,
    }, gEdges, e.label);
  }
}

/* nodes */
function nodeFill(d) {
  if (d.phil === "source") return "rgba(255,253,246,0.85)";
  const c = STREAMS[d.stream].color;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},0.11)`;
}

for (const d of NODES) {
  const g = el("g", {
    class: `node ${d.phil === "source" ? "source" : ""}`,
    transform: `translate(${d.x},${d.y})`,
    tabindex: 0, role: "button", "aria-label": `${d.name}, ${d.years}`,
  }, gNodes);
  el("rect", { class: "hit", x: -d.w / 2 - 8, y: -NODE_H / 2 - 7, width: d.w + 16, height: NODE_H + 14 }, g);
  el("rect", { class: "ring", x: -d.w / 2 - 4, y: -NODE_H / 2 - 4, width: d.w + 8, height: NODE_H + 8, rx: 5 }, g);
  el("rect", {
    class: "body", x: -d.w / 2, y: -NODE_H / 2, width: d.w, height: NODE_H, rx: 3,
    fill: nodeFill(d), stroke: STREAMS[d.stream].color,
  }, g);
  el("text", { class: "node-name", y: -2.5 }, g, d.short);
  el("text", { class: "node-years", y: 13.5 }, g, d.years);
  d.el = g;

  g.addEventListener("click", (e) => { select(d.id); e.stopPropagation(); });
  g.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(d.id); }
  });
  g.addEventListener("mouseenter", (e) => showTip(e, d));
  g.addEventListener("mousemove", moveTip);
  g.addEventListener("mouseleave", hideTip);
}

/* ---------- lineage tracing ---------- */

let selected = null;

function walk(id, dir, out = new Set()) {
  const next = dir === "up"
    ? byId.get(id).parents.map(([p]) => p)
    : kidsOf.get(id);
  for (const m of next) if (!out.has(m)) { out.add(m); walk(m, dir, out); }
  return out;
}

function select(id, scroll = true) {
  selected = id;
  const active = id ? new Set([id, ...walk(id, "up"), ...walk(id, "down")]) : null;

  for (const d of NODES) {
    d.el.classList.toggle("dim", !!active && !active.has(d.id));
    d.el.classList.toggle("selected", d.id === id);
  }
  for (const e of edgeEls) {
    const on = !!active && active.has(e.s) && active.has(e.t);
    e.el.classList.toggle("dim", !!active && !on);
    e.el.classList.toggle("hot", on);
  }
  for (const h of hookEls) {
    const on = !!active && active.has("critical") && active.has(h.t);
    h.el.classList.toggle("dim", !!active && !on);
    h.el.classList.toggle("hot", on);
  }
  for (const t of trunkEls) {
    const on = !!active && active.has("critical") && deltas.get(t.col).kids.some((k) => active.has(k));
    t.el.classList.toggle("dim", !!active && !on);
    t.el.classList.toggle("hot", on);
  }

  document.querySelectorAll(".views button").forEach((b) =>
    b.classList.toggle("active", (b.dataset.trace || "") === (id ?? "")));

  if (id) {
    history.replaceState(null, "", "#" + id);
    showDetail(byId.get(id));
    if (scroll && isMobile) setTimeout(() =>
      document.getElementById("detail").scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  } else {
    history.replaceState(null, "", location.pathname);
    document.getElementById("detail").innerHTML =
      `<p class="detail-hint">Click any Bible above to trace its whole lineage and read its story here.</p>`;
  }
}

svg.addEventListener("click", () => select(null));

document.querySelectorAll(".views button").forEach((btn) => {
  btn.addEventListener("click", () => select(btn.dataset.trace || null));
});

/* ---------- tooltip ---------- */

function showTip(event, d) {
  if (isMobile) return;
  const teaser = d.blurb.length > 150 ? d.blurb.slice(0, 147) + "…" : d.blurb;
  tooltip.innerHTML = `<span class="tip-ref">${d.years} · ${PHIL[d.phil]}</span><b>${d.name}</b> — ${teaser}`;
  tooltip.hidden = false;
  moveTip(event);
}

function moveTip(event) {
  const wrap = document.querySelector(".chart-wrap").getBoundingClientRect();
  let px = event.clientX - wrap.left + 14;
  let py = event.clientY - wrap.top + 14;
  if (px + 320 > wrap.width) px -= 340;
  if (py + 130 > wrap.height) py -= 150;
  tooltip.style.left = px + "px";
  tooltip.style.top = py + "px";
}

function hideTip() { tooltip.hidden = true; }

/* ---------- detail card ---------- */

function chipList(ids, current) {
  return ids.map((cid) => {
    const c = byId.get(cid);
    return `<button class="chip ${cid === current ? "here" : ""}" data-id="${cid}">${c.short} <span>${c.years}</span></button>`;
  }).join("");
}

function baseLine(d) {
  return d.parents.map(([pid, kind]) => {
    const p = byId.get(pid);
    const verb = p.phil === "source" ? "translated from" : kind === "rev" ? "a revision of" : "drawing on";
    return `${verb} ${p.name}`;
  }).join(" · ");
}

function showDetail(d) {
  const chain = [d.id];
  for (let n = d; n.parents.length; ) { n = byId.get(n.parents[0][0]); chain.unshift(n.id); }
  const kids = kidsOf.get(d.id).map((k) => byId.get(k)).sort((a, b) => a.yr - b.yr).map((k) => k.id);
  const s = STREAMS[d.stream];

  document.getElementById("detail").innerHTML = `
    <div class="detail-kicker"><span class="swatch" style="background:${s.color}"></span>
      ${s.label} · ${PHIL[d.phil]}</div>
    <h2 class="detail-name">${d.name}${d.alt ? ` <span class="alt">— ${d.alt}</span>` : ""}</h2>
    <p class="detail-dates">${d.years}${d.parents.length ? " · " + baseLine(d) : ""}</p>
    <p class="detail-note">${d.blurb}</p>
    ${chain.length > 1 ? `<div class="lineage"><span class="lineage-cap">line of descent</span>${chipList(chain, d.id)}</div>` : ""}
    ${kids.length ? `<div class="lineage"><span class="lineage-cap">carried forward by</span>${chipList(kids, null)}</div>` : ""}
    <div class="detail-refs"><a href="https://en.wikipedia.org/wiki/${d.wiki}" target="_blank" rel="noopener">read more</a></div>`;

  document.querySelectorAll("#detail .chip").forEach((chip) =>
    chip.addEventListener("click", () => select(chip.dataset.id, false)));
}

/* ---------- table view (the accessible twin) ---------- */

const tbody = document.querySelector("#trans-table tbody");
tbody.innerHTML = [...NODES]
  .filter((n) => n.phil !== "source")
  .sort((a, b) => a.yr - b.yr)
  .map((n) => `<tr>
    <td>${n.years}</td>
    <td><b>${n.name}</b></td>
    <td>${STREAMS[n.stream].label}</td>
    <td>${PHIL[n.phil]}</td>
    <td>${n.parents.map(([pid, kind]) => {
      const p = byId.get(pid);
      return `${p.phil === "source" ? "from" : kind === "rev" ? "revises" : "draws on"} ${p.short}`;
    }).join("; ")}</td>
  </tr>`).join("");

/* ---------- mobile: fixed width + sideways scroll ---------- */

if (isMobile) {
  const RW = 980;
  svg.style.width = RW + "px";
  svg.style.height = (H * RW / W) + "px";
  svg.style.maxWidth = "none";
  document.querySelector(".chart-wrap").classList.add("mobile-scroll");
}

/* ---------- deep link ---------- */

const hash = location.hash.slice(1);
if (hash && byId.has(hash)) select(hash, false);
