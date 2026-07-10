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

const fmt = (n) => n.toLocaleString("en-US");

const [graphData, details, overlay] = await Promise.all(
  ["data/graph.json", "data/details.json", "data/overlay.json"].map((u) =>
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

const nodes = [...graphData.nodes, ...overlayNodes];
const links = [...graphData.links, ...overlayLinks];
const nodeById = new Map(nodes.map((n) => [n.id, n]));

// ---------- state ----------

const activeSections = new Set(Object.keys(SECTION_COLORS));
let showTopics = true;
let showPeople = true;
let selected = null;
let highlightNodes = new Set();
let highlightLinks = new Set();

const nodeColor = (n) =>
  n.type === "topic" ? TOPIC_COLOR :
  n.type === "person" ? PERSON_COLOR :
  SECTION_COLORS[n.section];

const nodeVisible = (n) =>
  n.type === "topic" ? showTopics :
  n.type === "person" ? showPeople :
  activeSections.has(n.section);

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
    n.type === "chapter"
      ? 0.6 + 9 * Math.sqrt(n.strength / maxStrength)
      : 5.5
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
    return l.overlay ? "rgba(255,215,106,0.22)" : "rgba(150,160,220,0.16)";
  })
  .linkWidth((l) => (highlightLinks.has(l) ? 0.35 : 0))
  .linkOpacity(0.5)
  .warmupTicks(250)
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
  if (l.overlay) return 0.06;
  const s = l.source.id ?? l.source, t = l.target.id ?? l.target;
  return 1 / Math.min(linkCount.get(s), linkCount.get(t));
});

// bloom
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight), 0.85, 0.55, 0.1
);
Graph.postProcessingComposer().addPass(bloomPass);

Graph.cameraPosition({ x: 0, y: 0, z: 1600 });

// frame the fully-settled graph once the engine cools down
let framed = false;
Graph.onEngineStop(() => {
  if (!framed && !selected) {
    framed = true;
    Graph.zoomToFit(600, 60);
  }
});

function shade(hex, f) {
  const c = parseInt(hex.slice(1), 16);
  const r = Math.round(((c >> 16) & 255) * f),
    g = Math.round(((c >> 8) & 255) * f),
    b = Math.round((c & 255) * f);
  return `rgb(${r},${g},${b})`;
}

// ---------- selection & focus ----------

function focusNode(node) {
  if (!node) return;
  selected = node;
  highlightNodes = new Set([node.id]);
  highlightLinks = new Set();
  for (const l of links) {
    const s = l.source.id ?? l.source, t = l.target.id ?? l.target;
    if (s === node.id || t === node.id) {
      highlightLinks.add(l);
      highlightNodes.add(s === node.id ? t : s);
    }
  }
  Graph.nodeColor(Graph.nodeColor())
    .linkColor(Graph.linkColor())
    .linkWidth(Graph.linkWidth());

  const dist = 320;
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
    node.type === "chapter" ? chapterHTML(node) : overlayHTML(node);
  panelBody.querySelectorAll("[data-go]").forEach((el) => {
    el.onclick = () => goTo(el.dataset.go);
  });
}

function chapterHTML(node) {
  const d = details[node.id] || { verses: [], conn: [] };
  const color = nodeColor(node);
  const maxV = d.verses.length ? d.verses[0][1] : 1;
  const maxC = d.conn.length ? d.conn[0][1] : 1;

  const verses = d.verses
    .map(
      ([v, n]) => `<li>
        <span>${esc(node.label)}:${v}</span>
        <span class="bar"><i style="width:${Math.round((n / maxV) * 100)}%"></i></span>
        <span class="count">${fmt(n)} refs</span>
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
    .map((o) => `<span data-go="${o.id}">${o.type === "topic" ? "◆" : "✦"} ${esc(o.label)}</span>`)
    .join("");

  return `
    <div class="eyebrow"><span class="dot" style="color:${color};background:${color}"></span>${esc(node.section)}</div>
    <h2>${esc(node.label)}</h2>
    <p class="sub">${fmt(node.strength)} cross-reference connections</p>
    ${d.verses.length ? `<h3>Most referenced verses</h3><ul class="rowlist">${verses}</ul>` : ""}
    ${d.conn.length ? `<h3>Strongest connections</h3><ul class="rowlist">${conns}</ul>` : ""}
    ${tags ? `<h3>Appears in</h3><div class="taglist">${tags}</div>` : ""}
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

// ---------- filters ----------

const filtersEl = document.getElementById("filters");

function addChip(label, color, isOn, onToggle, special = false) {
  const chip = document.createElement("button");
  chip.className = "chip" + (special ? " special" : "") + (isOn() ? "" : " off");
  chip.innerHTML = `<span class="dot" style="color:${color};background:${color}"></span>${label}`;
  chip.onclick = () => {
    onToggle();
    chip.classList.toggle("off", !isOn());
    Graph.nodeVisibility(Graph.nodeVisibility()).linkVisibility(Graph.linkVisibility());
  };
  filtersEl.appendChild(chip);
}

for (const [section, color] of Object.entries(SECTION_COLORS)) {
  addChip(section, color,
    () => activeSections.has(section),
    () => activeSections.has(section) ? activeSections.delete(section) : activeSections.add(section)
  );
}
addChip("Theology", TOPIC_COLOR, () => showTopics, () => (showTopics = !showTopics), true);
addChip("People", PERSON_COLOR, () => showPeople, () => (showPeople = !showPeople), true);

// ---------- search ----------

const searchEl = document.getElementById("search");
const resultsEl = document.getElementById("search-results");

const searchIndex = nodes.map((n) => ({
  id: n.id,
  label: n.label,
  lower: n.label.toLowerCase(),
  kind: n.type === "chapter" ? n.book : n.type === "topic" ? "theology" : "person",
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
  `${fmt(overlay.topics.length)} doctrines · ${fmt(overlay.people.length)} people`;

// fade the hint after a while
setTimeout(() => (document.getElementById("hint").style.opacity = 0), 14000);

window.addEventListener("resize", () =>
  Graph.width(window.innerWidth).height(window.innerHeight)
);
