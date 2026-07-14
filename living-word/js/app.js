import * as THREE from "three";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import ForceGraph3D from "3d-force-graph";

const SECTION_COLORS = {
  "Law": "#d4a83b",
  "History": "#c96f4a",
  "Wisdom": "#9f7fdd",
  "Major Prophets": "#d94f68",
  "Minor Prophets": "#e58fb8",
  "Gospels & Acts": "#4f9df0",
  "Pauline Epistles": "#3ec6b5",
  "General Epistles": "#7ccf7f",
  "Revelation": "#f2e6b6",
};
const TOPIC_COLOR = "#ffd76a";
const PERSON_COLOR = "#f6f2ea";
const TOPICAL_COLOR = "#ff9d45";

const fmt = (n) => n.toLocaleString("en-US");

const [graphData, details, overlay, topical] = await Promise.all(
  ["data/graph.json", "data/details.json", "data/overlay.json", "data/topics.json"].map((u) =>
    fetch(u, { cache: "no-cache" }).then((r) => r.json())
  )
);

// ---------- assemble nodes & links ----------

const chapterById = new Map();
for (const n of graphData.nodes) {
  n.type = "chapter";
  chapterById.set(n.id, n);
}

// index: chapter id -> overlay nodes that touch it
const overlayByChapter = new Map();

const overlayNodes = [];
const overlayLinks = [];
for (const kind of ["topics", "people"]) {
  for (const item of overlay[kind]) {
    const node = {
      id: item.id,
      label: item.label,
      desc: item.desc,
      type: kind === "topics" ? "topic" : "person",
      refs: item.refs.filter((r) => chapterById.has(r)),
      strength: 0,
    };
    overlayNodes.push(node);
    for (const ref of node.refs) {
      overlayLinks.push({ source: item.id, target: ref, w: 0, overlay: true });
      if (!overlayByChapter.has(ref)) overlayByChapter.set(ref, []);
      overlayByChapter.get(ref).push(node);
    }
  }
}

// Topical Bible overlay (OpenBible.info votes, top verses carry KJV text)
for (const item of topical.topics) {
  const node = {
    id: item.id,
    label: item.label,
    type: "obtopic",
    refs: item.refs.filter((r) => chapterById.has(r)),
    verses: item.verses,
    strength: 0,
  };
  overlayNodes.push(node);
  for (const ref of node.refs) {
    overlayLinks.push({ source: item.id, target: ref, w: 0, overlay: true });
    if (!overlayByChapter.has(ref)) overlayByChapter.set(ref, []);
    overlayByChapter.get(ref).push(node);
  }
}

const nodes = [...graphData.nodes, ...overlayNodes];
const links = [...graphData.links, ...overlayLinks];
const nodeById = new Map(nodes.map((n) => [n.id, n]));

// ---------- state ----------

// every filterable category: the 9 canon sections + the three overlays
const OVERLAY_KEYS = { topic: "__theology", person: "__people", obtopic: "__topical" };
const ALL_KEYS = [...Object.keys(SECTION_COLORS), ...Object.values(OVERLAY_KEYS)];
let activeKeys = new Set(ALL_KEYS);
let selected = null;
let highlightNodes = new Set();
let highlightLinks = new Set();

const nodeColor = (n) =>
  n.type === "topic" ? TOPIC_COLOR :
  n.type === "person" ? PERSON_COLOR :
  n.type === "obtopic" ? TOPICAL_COLOR :
  n.type === "verse" ? tint(SECTION_COLORS[n.section], 0.55) :
  SECTION_COLORS[n.section];

const nodeKey = (n) => OVERLAY_KEYS[n.type] ?? n.section;
const nodeVisible = (n) => activeKeys.has(nodeKey(n));

function tint(hex, f) {
  const c = parseInt(hex.slice(1), 16);
  const ch = (x) => Math.round(x + (255 - x) * f);
  return `rgb(${ch((c >> 16) & 255)},${ch((c >> 8) & 255)},${ch(c & 255)})`;
}

// ---------- canon layout (the default arrangement) ----------
// After bible-kg's Scripture Constellation: the 66 books on a descending
// helix — Genesis at the top, Revelation at the bottom, OT above NT — each
// book's chapters in a phyllotaxis cluster around its center. The organic
// force-directed cloud is available as a toggle.
let canonOn = true;
let origPos = null;          // organic positions, captured once simulated
let captureOrganic = false;  // set while the organic simulation runs

const hash01 = (s) => {
  let h = 2166136261;
  for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
};

function canonCoords() {
  const coords = new Map();
  const centers = new Map();
  for (let b = 1; b <= 66; b++) {
    const t = (b - 1) / 65;
    const y = 780 - t * 1560;                       // top-down canon order
    const angle = (b - 1) * 0.84 + (b >= 40 ? 0.6 : 0);
    const waist = Math.abs(t - 0.58);
    const R = 180 + waist * 380 + 40 * Math.sin(b * 0.51);
    centers.set(b, [Math.cos(angle) * R, y, Math.sin(angle) * R]);
  }
  const byBook = new Map();
  for (const n of graphData.nodes) {
    const b = +n.id.split(":")[0];
    if (!byBook.has(b)) byBook.set(b, []);
    byBook.get(b).push(n);
  }
  for (const [b, chs] of byBook) {
    const [cx, cy, cz] = centers.get(b);
    chs.sort((m, q) => +m.id.split(":")[1] - +q.id.split(":")[1]);
    chs.forEach((n, i) => {
      const a = i * 2.399963 + hash01(n.id) * 2.8;  // golden-angle spiral
      const r = 34 + Math.sqrt((i + 1) / chs.length) * 100;
      coords.set(n.id, [cx + Math.cos(a) * r,
                        cy + (hash01(n.id) - 0.5) * 90,
                        cz + Math.sin(a) * r]);
    });
  }
  // overlay lenses ring the column, as in bible-kg
  overlayNodes.forEach((n, i) => {
    const ring = n.type === "topic" ? 880 : n.type === "person" ? 960 : 1050;
    const a = i * 2.399963;
    coords.set(n.id, [Math.cos(a) * ring,
                      (hash01(n.id) - 0.5) * 1400,
                      Math.sin(a) * ring]);
  });
  return coords;
}

function pinTo(target) {
  for (const n of nodes) {
    const p = target.get(n.id);
    if (!p) continue;
    [n.x, n.y, n.z] = p;
    [n.fx, n.fy, n.fz] = p;
  }
}

// canon by default: positions are deterministic, so no warmup is needed
pinTo(canonCoords());

// ---------- graph ----------

const maxStrength = Math.max(...graphData.nodes.map((n) => n.strength));

const Graph = new ForceGraph3D(document.getElementById("graph"), {
  extraRenderers: [],
})
  .backgroundColor("rgba(0,0,0,0)")
  .graphData({ nodes, links })
  .nodeLabel((n) => n.label)
  .nodeColor((n) =>
    highlightNodes.size && !highlightNodes.has(n.id)
      ? shade(nodeColor(n), 0.18)
      : nodeColor(n)
  )
  .nodeVal((n) =>
    n.type === "chapter" ? 0.6 + 9 * Math.sqrt(n.strength / maxStrength) :
    n.type === "verse" ? n.val :
    n.type === "obtopic" ? 3.5 : 5.5
  )
  .nodeOpacity(0.92)
  .nodeResolution(10)
  .nodeVisibility(nodeVisible)
  .linkVisibility((l) => {
    const s = nodeById.get(l.source.id ?? l.source);
    const t = nodeById.get(l.target.id ?? l.target);
    return !!s && !!t && nodeVisible(s) && nodeVisible(t);
  })
  .linkColor((l) => {
    if (highlightLinks.size)
      return highlightLinks.has(l) ? "#ffd76a" : "rgba(120,120,150,0.05)";
    if (l.vlink) return "rgba(233,226,207,0.10)";
    return l.overlay ? "rgba(255,215,106,0.22)" : "rgba(150,160,220,0.16)";
  })
  .linkWidth((l) => (highlightLinks.has(l) ? (l.vlink ? 0.12 : 0.35) : 0))
  .linkOpacity(0.5)
  .warmupTicks(0)
  .cooldownTicks(0)
  .onNodeClick(focusNode)
  .onBackgroundClick(clearSelection);

// gentler charge so clusters read as constellations
Graph.d3Force("charge").strength(-42);
// replicate d3's default link strength (1 / min degree), but keep overlay
// links nearly slack so topics/people don't distort the chapter layout
const linkCount = new Map();
for (const l of links) {
  for (const end of [l.source, l.target]) {
    const id = end.id ?? end;
    linkCount.set(id, (linkCount.get(id) || 0) + 1);
  }
}
Graph.d3Force("link").strength((l) => {
  if (l.vlink) return 0; // verse links are purely visual; layout is frozen
  if (l.overlay) return 0.06;
  const s = l.source.id ?? l.source, t = l.target.id ?? l.target;
  return 1 / Math.min(linkCount.get(s), linkCount.get(t));
});

// bloom
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight), 0.85, 0.55, 0.1
);
Graph.postProcessingComposer().addPass(bloomPass);

Graph.cameraPosition({ x: 0, y: 0, z: 2500 });

// when the organic simulation finishes, pin its result so later data
// updates can't disturb it (the canon default needs no framing — the
// initial cameraPosition already fits the column)
Graph.onEngineStop(() => {
  if (captureOrganic) {
    captureOrganic = false;
    origPos = new Map(nodes.map((n) => [n.id, [n.x, n.y, n.z]]));
    pinTo(origPos);
    Graph.cooldownTicks(0);
  }
});

function shade(hex, f) {
  const c = parseInt(hex.slice(1), 16);
  const r = Math.round(((c >> 16) & 255) * f),
    g = Math.round(((c >> 8) & 255) * f),
    b = Math.round((c & 255) * f);
  return `rgb(${r},${g},${b})`;
}

// ---------- verse expansion (unfold a chapter into its verses) ----------

const verseDataCache = new Map(); // chapterId -> {n, in, out}
const expandedSet = new Set();    // chapterIds currently unfolded
let verseNodes = [];
let currentLinks = links;         // links + dynamic verse links
let layoutFrozen = true;          // canon default pins every node from load

const verseNodeId = (b, c, v) => `v:${b}:${c}:${v}`;

async function getVerseData(cid) {
  if (!verseDataCache.has(cid)) {
    verseDataCache.set(
      cid,
      await fetch(`data/verses/${cid.replace(":", "-")}.json`).then((r) => r.json())
    );
  }
  return verseDataCache.get(cid);
}

// deterministic geometry: verses sit on a Fibonacci-sphere shell around
// their chapter, verse 1 at the top pole, in reading order downward
function versePositions(cNode, n) {
  const R = 26 + 3 * Math.sqrt(n);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    pts.push([
      cNode.x + R * r * Math.cos(th),
      cNode.y + R * y,
      cNode.z + R * r * Math.sin(th),
    ]);
  }
  return pts;
}

async function toggleVerses(cid) {
  const unfolding = !expandedSet.has(cid);
  if (unfolding) {
    await getVerseData(cid);
    expandedSet.add(cid);
  } else {
    expandedSet.delete(cid);
    if (selected?.type === "verse" && selected.chapter === cid) clearSelection();
  }
  rebuildVerseLayer();
  if (selected) applyHighlight(selected);
  if (selected?.id === cid) {
    renderPanel(selected); // refresh fold/unfold label
    if (unfolding) {
      const n = selected;
      const dist = 210;
      const ratio = 1 + dist / Math.hypot(n.x, n.y, n.z || 1);
      Graph.cameraPosition({ x: n.x * ratio, y: n.y * ratio, z: n.z * ratio }, n, 700);
    }
  }
}

function rebuildVerseLayer() {
  // once verses exist, freeze the force layout so nothing drifts —
  // warmupTicks must go to 0 too, or every graphData() update re-runs
  // the 250 synchronous warmup ticks and shifts the whole layout
  if (!layoutFrozen) {
    Graph.cooldownTicks(0).warmupTicks(0);
    layoutFrozen = true;
  }

  for (const vn of verseNodes) nodeById.delete(vn.id);
  verseNodes = [];
  const verseLinks = [];

  for (const cid of expandedSet) {
    const cNode = chapterById.get(cid);
    const d = verseDataCache.get(cid);
    const [b, c] = cid.split(":").map(Number);
    const pts = versePositions(cNode, d.n);
    const maxIn = Math.max(1, ...Object.values(d.in).map(Number));
    for (let v = 1; v <= d.n; v++) {
      const inN = d.in[v] || 0;
      const [x, y, z] = pts[v - 1];
      const node = {
        id: verseNodeId(b, c, v),
        label: `${cNode.label}:${v}`,
        type: "verse",
        section: cNode.section,
        chapter: cid,
        v,
        inbound: inN,
        val: 0.05 + 0.5 * Math.sqrt(inN / maxIn),
        x, y, z, fx: x, fy: y, fz: z,
      };
      verseNodes.push(node);
      nodeById.set(node.id, node);
    }
  }

  // rebuild all verse-level links: verse -> verse when both chapters are
  // unfolded, verse -> chapter aggregate otherwise
  for (const cid of expandedSet) {
    const d = verseDataCache.get(cid);
    const [b, c] = cid.split(":").map(Number);
    for (const [v, targets] of Object.entries(d.out)) {
      const src = verseNodeId(b, c, +v);
      if (!nodeById.has(src)) continue; // TSK verse beyond BSB verse count
      const aggregated = new Set();
      for (const [tb, tc, tv] of targets) {
        const tcid = `${tb}:${tc}`;
        const tvid = verseNodeId(tb, tc, tv);
        if (expandedSet.has(tcid) && nodeById.has(tvid)) {
          verseLinks.push({ source: src, target: tvid, w: 1, vlink: true });
        } else if (chapterById.has(tcid) && !aggregated.has(tcid)) {
          aggregated.add(tcid);
          verseLinks.push({ source: src, target: tcid, w: 1, vlink: true });
        }
      }
    }
  }

  currentLinks = [...links, ...verseLinks];
  Graph.graphData({ nodes: [...nodes, ...verseNodes], links: currentLinks });
  foldAllBtn.style.display = expandedSet.size ? "" : "none";
  foldAllBtn.innerHTML = `✕ Fold verses (${expandedSet.size})`;
}

// ---------- selection & focus ----------

function applyHighlight(node) {
  highlightNodes = new Set([node.id]);
  highlightLinks = new Set();
  for (const l of currentLinks) {
    const s = l.source.id ?? l.source, t = l.target.id ?? l.target;
    if (s === node.id || t === node.id) {
      highlightLinks.add(l);
      highlightNodes.add(s === node.id ? t : s);
    }
  }
  // an unfolded chapter's verses always stay lit alongside it
  if (node.type === "chapter" && expandedSet.has(node.id))
    for (const vn of verseNodes)
      if (vn.chapter === node.id) highlightNodes.add(vn.id);
  Graph.nodeColor(Graph.nodeColor())
    .linkColor(Graph.linkColor())
    .linkWidth(Graph.linkWidth());
}

function focusNode(node) {
  if (!node) return;
  selected = node;
  applyHighlight(node);

  const dist = node.type === "verse" ? 120 : 320;
  const ratio = 1 + dist / Math.hypot(node.x, node.y, node.z || 1);
  Graph.cameraPosition(
    { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
    node, 900
  );
  renderPanel(node);
  document.getElementById("hint").style.opacity = 0;
}

function clearSelection() {
  selected = null;
  highlightNodes = new Set();
  highlightLinks = new Set();
  Graph.nodeColor(Graph.nodeColor())
    .linkColor(Graph.linkColor())
    .linkWidth(Graph.linkWidth());
  panel.classList.add("hidden");
}

const goTo = (id) => {
  const n = nodeById.get(id);
  if (n) focusNode(n);
};

// ---------- KJV text (per-book, fetched on demand) ----------

const bookTextCache = new Map();

async function getBookText(bookKey) {
  if (!bookTextCache.has(bookKey)) {
    bookTextCache.set(
      bookKey,
      fetch(`data/text/${bookKey}.json`).then((r) => r.json())
    );
  }
  return bookTextCache.get(bookKey);
}

async function getChapterText(chapterId) {
  const [bookKey, chap] = chapterId.split(":");
  const book = await getBookText(bookKey);
  return book[chap] || [];
}

// ---------- detail panel ----------

const panel = document.getElementById("panel");
const panelBody = document.getElementById("panel-body");
document.getElementById("panel-close").onclick = clearSelection;

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function renderPanel(node) {
  panel.classList.remove("hidden");
  panelBody.innerHTML =
    node.type === "chapter" ? chapterHTML(node) :
    node.type === "verse" ? verseHTML(node) :
    node.type === "obtopic" ? topicalHTML(node) :
    overlayHTML(node);
  panelBody.querySelectorAll("[data-go]").forEach((el) => {
    el.onclick = () => goTo(el.dataset.go);
  });
  panelBody.querySelectorAll("[data-read]").forEach((el) => {
    el.onclick = (e) => {
      e.stopPropagation();
      const [cid, verse] = el.dataset.read.split("@");
      openReader(cid, verse ? +verse : null);
    };
  });
  panelBody.querySelectorAll("[data-unfold]").forEach((el) => {
    el.onclick = () => toggleVerses(el.dataset.unfold);
  });
  if (node.type === "chapter") hydrateVerseText(node);
  if (node.type === "verse") hydrateVersePanel(node);
  if (!reader.classList.contains("hidden") && node.type === "chapter")
    openReader(node.id);
}

async function hydrateVerseText(node) {
  const texts = await getChapterText(node.id);
  if (selected !== node) return; // panel moved on while fetching
  panelBody.querySelectorAll("[data-vtext]").forEach((el) => {
    const t = texts[+el.dataset.vtext - 1];
    el.textContent = t || "Not in the BSB main text — carried as a footnote.";
  });
}

async function hydrateVersePanel(node) {
  const texts = await getChapterText(node.chapter);
  if (selected !== node) return;
  const el = panelBody.querySelector("#verse-full-text");
  if (el)
    el.textContent =
      texts[node.v - 1] || "Not in the BSB main text — carried as a footnote.";
}

function chapterHTML(node) {
  const d = details[node.id] || { verses: [], conn: [] };
  const color = nodeColor(node);
  const maxV = d.verses.length ? d.verses[0][1] : 1;
  const maxC = d.conn.length ? d.conn[0][1] : 1;

  const verses = d.verses
    .map(
      ([v, n]) => `<li class="link verse-row" data-read="${node.id}@${v}" title="Read in context">
        <span>${esc(node.label)}:${v}</span>
        <span class="bar"><i style="width:${Math.round((n / maxV) * 100)}%"></i></span>
        <span class="count">${fmt(n)} refs</span>
        <span class="vtext" data-vtext="${v}"></span>
      </li>`
    )
    .join("");

  const conns = d.conn
    .map(([cid, w]) => {
      const c = chapterById.get(cid);
      if (!c) return "";
      return `<li class="link" data-go="${cid}">
        <span style="color:${SECTION_COLORS[c.section]}">${esc(c.label)}</span>
        <span class="bar"><i style="width:${Math.round((w / maxC) * 100)}%"></i></span>
        <span class="count">${fmt(w)}</span>
      </li>`;
    })
    .join("");

  const tags = (overlayByChapter.get(node.id) || [])
    .map((o) => {
      const mark = o.type === "topic" ? "◆" : o.type === "person" ? "✦" : "❖";
      const cap = o.type === "obtopic" ? ' style="text-transform:capitalize"' : "";
      return `<span data-go="${o.id}"${cap}>${mark} ${esc(o.label)}</span>`;
    })
    .join("");

  return `
    <div class="eyebrow"><span class="dot" style="color:${color};background:${color}"></span>${esc(node.section)}</div>
    <h2>${esc(node.label)}</h2>
    <p class="sub">${fmt(node.strength)} cross-reference connections</p>
    <button class="read-btn" data-read="${node.id}">Read this chapter</button>
    <button class="read-btn" data-unfold="${node.id}" style="margin-left:8px">
      ${expandedSet.has(node.id) ? "Fold verses" : "Unfold verses"}</button>
    ${d.verses.length ? `<h3>Most referenced verses</h3><ul class="rowlist">${verses}</ul>` : ""}
    ${d.conn.length ? `<h3>Strongest connections</h3><ul class="rowlist">${conns}</ul>` : ""}
    ${tags ? `<h3>Appears in</h3><div class="taglist">${tags}</div>` : ""}
  `;
}

function verseHTML(node) {
  const color = nodeColor(node);
  const cNode = chapterById.get(node.chapter);
  const out = (verseDataCache.get(node.chapter)?.out || {})[node.v] || [];
  const rows = out
    .map(([tb, tc, tv]) => {
      const tcid = `${tb}:${tc}`;
      const tChap = chapterById.get(tcid);
      if (!tChap) return "";
      const tvid = verseNodeId(tb, tc, tv);
      const go = nodeById.has(tvid) ? tvid : tcid;
      return `<li class="link" data-go="${go}">
        <span style="color:${SECTION_COLORS[tChap.section]}">${esc(tChap.label)}:${tv}</span>
        <span class="count">${expandedSet.has(tcid) ? "unfolded" : ""}</span>
      </li>`;
    })
    .join("");
  return `
    <div class="eyebrow"><span class="dot" style="color:${color};background:${color}"></span>${esc(node.section)} · Verse</div>
    <h2>${esc(node.label)}</h2>
    <p class="sub">${fmt(node.inbound)} inbound references</p>
    <p class="desc" id="verse-full-text">…</p>
    <button class="read-btn" data-read="${node.chapter}@${node.v}">Read in context</button>
    <button class="read-btn" data-go="${node.chapter}" style="margin-left:8px">${esc(cNode.label)}</button>
    ${rows ? `<h3>References (${out.length})</h3><ul class="rowlist">${rows}</ul>` : ""}
  `;
}

function topicalHTML(node) {
  const color = nodeColor(node);
  const maxVotes = node.verses.length ? node.verses[0][3] : 1;
  const rows = node.verses
    .map(
      ([label, cid, text, votes]) => `<li class="link verse-row" data-go="${cid}" title="Go to chapter">
        <span style="color:${TOPICAL_COLOR}">${esc(label)}</span>
        <span class="bar"><i style="width:${Math.round((votes / maxVotes) * 100)}%"></i></span>
        <span class="count">${fmt(votes)} votes</span>
        <span class="vtext">${esc(text)}</span>
      </li>`
    )
    .join("");
  return `
    <div class="eyebrow"><span class="dot" style="color:${color};background:${color}"></span>Topical Bible</div>
    <h2 style="text-transform:capitalize">${esc(node.label)}</h2>
    <p class="sub">as voted by readers at openbible.info</p>
    <h3>Top verses</h3>
    <ul class="rowlist">${rows}</ul>
  `;
}

function overlayHTML(node) {
  const color = nodeColor(node);
  const kind = node.type === "topic" ? "Systematic theology" : "People of the Bible";
  const passages = node.refs
    .map((r) => {
      const c = chapterById.get(r);
      return `<span data-go="${r}" style="border-color:${SECTION_COLORS[c.section]}55">${esc(c.label)}</span>`;
    })
    .join("");
  return `
    <div class="eyebrow"><span class="dot" style="color:${color};background:${color}"></span>${kind}</div>
    <h2>${esc(node.label)}</h2>
    <p class="desc">${esc(node.desc)}</p>
    <h3>Key passages</h3>
    <div class="taglist">${passages}</div>
  `;
}

// ---------- Bible reader ----------

const reader = document.getElementById("reader");
const readerBody = document.getElementById("reader-body");
const readerTitle = document.getElementById("reader-title");
const readerEyebrow = document.getElementById("reader-eyebrow");
const readerPrev = document.getElementById("reader-prev");
const readerNext = document.getElementById("reader-next");
let readerChapter = null;

// canonical chapter order for prev/next navigation
const chapterOrder = graphData.nodes.map((n) => n.id);
const chapterIndex = new Map(chapterOrder.map((id, i) => [id, i]));

async function openReader(chapterId, pinVerse = null) {
  const node = chapterById.get(chapterId);
  if (!node) return;
  readerChapter = chapterId;
  reader.classList.remove("hidden");
  readerEyebrow.textContent = `${node.section} · Berean Standard Bible`;
  readerTitle.textContent = node.label;
  readerBody.innerHTML = `<p style="font-style:italic;color:var(--ink-dim)">…</p>`;

  const texts = await getChapterText(chapterId);
  if (readerChapter !== chapterId) return; // navigated away while fetching

  const refCounts = new Map((details[chapterId]?.verses || []).map(([v, n]) => [v, n]));
  readerBody.innerHTML = texts
    .map((t, i) => {
      const v = i + 1;
      const hot = refCounts.has(v);
      const pinned = pinVerse === v;
      // BSB carries some traditionally-disputed verses only in footnotes;
      // skip the empty slot unless the verse is pinned or cross-referenced
      if (!t && !hot && !pinned) return "";
      const body = t
        ? esc(t)
        : `<em style="color:var(--ink-dim)">Not in the BSB main text — carried as a footnote in the oldest manuscripts.</em>`;
      return `<p${pinned ? ' class="pinned" id="pinned-verse"' : hot ? ' class="hot"' : ""}>
        ${hot ? `<span class="refcount">${fmt(refCounts.get(v))} refs</span>` : ""}
        <span class="vnum">${v}</span>${body}</p>`;
    })
    .join("");
  readerBody.scrollTop = 0;
  if (pinVerse) {
    document.getElementById("pinned-verse")?.scrollIntoView({ block: "center" });
  }

  const idx = chapterIndex.get(chapterId);
  const prev = chapterOrder[idx - 1], next = chapterOrder[idx + 1];
  readerPrev.disabled = !prev;
  readerNext.disabled = !next;
  if (prev) readerPrev.querySelector("span").textContent = chapterById.get(prev).label;
  if (next) readerNext.querySelector("span").textContent = chapterById.get(next).label;
  readerPrev.onclick = () => prev && openReader(prev);
  readerNext.onclick = () => next && openReader(next);
}

document.getElementById("reader-close").onclick = () => {
  reader.classList.add("hidden");
  readerChapter = null;
};

// ---------- filters ----------

const filtersEl = document.getElementById("filters");
const chipByKey = new Map();

function refreshChips() {
  for (const [key, chip] of chipByKey)
    chip.classList.toggle("off", !activeKeys.has(key));
  Graph.nodeVisibility(Graph.nodeVisibility()).linkVisibility(Graph.linkVisibility());
}

// click isolates the category; clicking the lone active chip brings all back;
// shift-click toggles a single category in or out of the current view
function chipClick(key, e) {
  if (e.shiftKey) {
    activeKeys.has(key) ? activeKeys.delete(key) : activeKeys.add(key);
    if (!activeKeys.size) activeKeys = new Set(ALL_KEYS);
  } else if (activeKeys.size === 1 && activeKeys.has(key)) {
    activeKeys = new Set(ALL_KEYS);
  } else {
    activeKeys = new Set([key]);
  }
  refreshChips();
}

function addChip(key, label, color, special = false) {
  const chip = document.createElement("button");
  chip.className = "chip" + (special ? " special" : "");
  chip.title = "Click to isolate · shift-click to toggle";
  chip.innerHTML = `<span class="dot" style="color:${color};background:${color}"></span>${label}`;
  chip.onclick = (e) => chipClick(key, e);
  chipByKey.set(key, chip);
  filtersEl.appendChild(chip);
}

for (const [section, color] of Object.entries(SECTION_COLORS)) {
  addChip(section, section, color);
}
addChip(OVERLAY_KEYS.topic, "Theology", TOPIC_COLOR, true);
addChip(OVERLAY_KEYS.person, "People", PERSON_COLOR, true);
addChip(OVERLAY_KEYS.obtopic, "Topics", TOPICAL_COLOR, true);

// ---------- layout toggle: canon order (default) vs organic cloud ----------
function setCanon(on) {
  canonOn = on;
  if (on) {
    // leaving a live organic view? remember it before pinning to canon
    if (!origPos && nodes.some((n) => n.fx == null)) {
      origPos = new Map(nodes.map((n) => [n.id, [n.x, n.y, n.z]]));
    }
    pinTo(canonCoords());
    Graph.cooldownTicks(60);
  } else if (origPos) {
    pinTo(origPos);
    Graph.cooldownTicks(60);
  } else {
    // first organic visit: release everything and let the forces find the
    // cloud; onEngineStop captures and pins the result
    for (const n of nodes) { delete n.fx; delete n.fy; delete n.fz; }
    captureOrganic = true;
    Graph.cooldownTicks(400);
  }
  Graph.d3ReheatSimulation();
  if (expandedSet.size) rebuildVerseLayer();
  Graph.cameraPosition({ x: 0, y: 0, z: on ? 2500 : 1600 },
                       { x: 0, y: 0, z: 0 }, 1200);
  canonBtn.classList.toggle("off", !on);
}

const canonBtn = document.createElement("button");
canonBtn.className = "chip special";
canonBtn.title = "Canon order — Genesis at the top, Revelation at the bottom. Click to switch to the organic cross-reference cloud and back.";
canonBtn.innerHTML = `<span class="dot" style="color:#d4a83b;background:#d4a83b"></span>Canon order`;
canonBtn.onclick = () => setCanon(!canonOn);
filtersEl.appendChild(canonBtn);

const foldAllBtn = document.createElement("button");
foldAllBtn.className = "chip special";
foldAllBtn.style.display = "none";
foldAllBtn.onclick = () => {
  const keepPanel = selected?.type === "chapter" ? selected : null;
  if (selected?.type === "verse") clearSelection();
  expandedSet.clear();
  rebuildVerseLayer();
  if (keepPanel) renderPanel(keepPanel);
};
filtersEl.appendChild(foldAllBtn);

// console/deep-link hook
window.__lw = { goTo, toggleVerses, nodeById, Graph, setCanon };

// ---------- search ----------

const searchEl = document.getElementById("search");
const resultsEl = document.getElementById("search-results");

const searchIndex = nodes.map((n) => ({
  id: n.id,
  label: n.label,
  lower: n.label.toLowerCase(),
  kind:
    n.type === "chapter" ? n.book :
    n.type === "topic" ? "theology" :
    n.type === "obtopic" ? "topic" : "person",
}));

searchEl.addEventListener("input", () => {
  const q = searchEl.value.trim().toLowerCase();
  if (q.length < 2) {
    resultsEl.classList.add("hidden");
    return;
  }
  const hits = searchIndex.filter((e) => e.lower.includes(q)).slice(0, 12);
  resultsEl.innerHTML = hits
    .map((h) => `<div data-go="${h.id}"><span>${esc(h.label)}</span><span class="kind">${esc(h.kind)}</span></div>`)
    .join("") || `<div><span style="font-style:italic;color:var(--ink-dim)">nothing found</span></div>`;
  resultsEl.classList.remove("hidden");
  resultsEl.querySelectorAll("[data-go]").forEach((el) => {
    el.onclick = () => {
      goTo(el.dataset.go);
      resultsEl.classList.add("hidden");
      searchEl.value = "";
    };
  });
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrap")) resultsEl.classList.add("hidden");
});

// ---------- stats ----------

document.getElementById("stats").innerHTML =
  `${fmt(graphData.nodes.length)} chapters · ${fmt(graphData.meta.links)} connections<br>` +
  `distilled from ${fmt(graphData.meta.totalRefs)} cross-references<br>` +
  `${fmt(overlay.topics.length)} doctrines · ${fmt(overlay.people.length)} people · ${fmt(topical.topics.length)} topics`;

// fade the hint after a while
setTimeout(() => (document.getElementById("hint").style.opacity = 0), 14000);

window.addEventListener("resize", () =>
  Graph.width(window.innerWidth).height(window.innerHeight)
);
