/* Every Word Entwined — Bible cross-reference neighborhood explorer.
   Data: OpenBible.info cross references (CC-BY), Treasury of Scripture
   Knowledge phrase anchors, KJV text. */

const BOOKS = [
  ["Gen", "Genesis"], ["Exod", "Exodus"], ["Lev", "Leviticus"], ["Num", "Numbers"],
  ["Deut", "Deuteronomy"], ["Josh", "Joshua"], ["Judg", "Judges"], ["Ruth", "Ruth"],
  ["1Sam", "1 Samuel"], ["2Sam", "2 Samuel"], ["1Kgs", "1 Kings"], ["2Kgs", "2 Kings"],
  ["1Chr", "1 Chronicles"], ["2Chr", "2 Chronicles"], ["Ezra", "Ezra"], ["Neh", "Nehemiah"],
  ["Esth", "Esther"], ["Job", "Job"], ["Ps", "Psalm"], ["Prov", "Proverbs"],
  ["Eccl", "Ecclesiastes"], ["Song", "Song of Solomon"], ["Isa", "Isaiah"], ["Jer", "Jeremiah"],
  ["Lam", "Lamentations"], ["Ezek", "Ezekiel"], ["Dan", "Daniel"], ["Hos", "Hosea"],
  ["Joel", "Joel"], ["Amos", "Amos"], ["Obad", "Obadiah"], ["Jonah", "Jonah"],
  ["Mic", "Micah"], ["Nah", "Nahum"], ["Hab", "Habakkuk"], ["Zeph", "Zephaniah"],
  ["Hag", "Haggai"], ["Zech", "Zechariah"], ["Mal", "Malachi"], ["Matt", "Matthew"],
  ["Mark", "Mark"], ["Luke", "Luke"], ["John", "John"], ["Acts", "Acts"],
  ["Rom", "Romans"], ["1Cor", "1 Corinthians"], ["2Cor", "2 Corinthians"], ["Gal", "Galatians"],
  ["Eph", "Ephesians"], ["Phil", "Philippians"], ["Col", "Colossians"],
  ["1Thess", "1 Thessalonians"], ["2Thess", "2 Thessalonians"], ["1Tim", "1 Timothy"],
  ["2Tim", "2 Timothy"], ["Titus", "Titus"], ["Phlm", "Philemon"], ["Heb", "Hebrews"],
  ["Jas", "James"], ["1Pet", "1 Peter"], ["2Pet", "2 Peter"], ["1John", "1 John"],
  ["2John", "2 John"], ["3John", "3 John"], ["Jude", "Jude"], ["Rev", "Revelation"],
];

const BOOK_INDEX = new Map(BOOKS.map(([osis], i) => [osis, i]));

const SECTIONS = [
  { name: "Law", until: 4, color: "#5f7134" },
  { name: "History", until: 16, color: "#a97d1c" },
  { name: "Wisdom & poetry", until: 21, color: "#b05c2e" },
  { name: "Prophets", until: 38, color: "#8b2a1d" },
  { name: "Gospels & Acts", until: 43, color: "#2f4b7c" },
  { name: "Epistles", until: 64, color: "#63417a" },
  { name: "Revelation", until: 65, color: "#7c1f3f" },
];

const STOPWORDS = new Set(("the and of to that in he i is not for a it with his they be him have do as at " +
  "this but by from or an are was were will all my your me we you she her its our their them so no yes if " +
  "on up out into unto shall thee thou thy ye hath than then there when which who whom whose what why how " +
  "also again against am any because been before behold came come did done down even every gave give go " +
  "had has himself let like made make man may men more most much must now o over said saith say see set " +
  "some take therefore these things thing those through too upon us very went where wherefore yet own can " +
  "should would could one two both after among about while such same other another each us let both being " +
  "off away nor neither either till until many still more without within toward towards between").split(/\s+/));

const state = {
  ids: [],             // verse index -> osis id
  texts: [],           // verse index -> KJV text
  idIndex: new Map(),  // osis id -> verse index
  adj: new Map(),      // verse index -> [{other, votes, span, out}]
  anchors: new Map(),  // verse index -> [{word, targets: [{t, span}]}]
  wordIndex: new Map(),// normalized word -> [verse index...]
  topics: new Map(),   // topic -> [{t, span, votes}] sorted by votes desc
  related: new Map(),  // topic -> [[topic, simPct], ...] embedding neighbors
  people: [],          // [{key, display, verses: [vIdx...]}] by verse count desc
  peopleByKey: new Map(),
  peopleByVerse: new Map(),
  sermons: [],         // [[title, date, url], ...]
  preached: new Map(), // verse index -> [[sermonIdx, seconds], ...]
  view: null,          // {t:'v',k:verseIdx} | {t:'w',k:word} | {t:'t',k:topic} | {t:'i',k:'words'|'topics'}
  activeAnchor: null,  // index into anchors list of current center verse
  threshold: 3,
  trail: [],
  maxNeighbors: 28,
  maxWordLeaves: 48,
};

const svg = d3.select("#graph");
const gZoom = svg.append("g");
const gLinks = gZoom.append("g");
const gNodes = gZoom.append("g");
const tooltip = document.getElementById("tooltip");
let simulation = null;

svg.call(d3.zoom().scaleExtent([0.3, 3]).on("zoom", (e) => gZoom.attr("transform", e.transform)));

/* ---------- helpers ---------- */

function bookOf(idx) { return state.ids[idx].split(".")[0]; }

function sectionOf(idx) {
  const b = BOOK_INDEX.get(bookOf(idx));
  return SECTIONS.find((s) => b <= s.until);
}

function isNT(idx) { return BOOK_INDEX.get(bookOf(idx)) >= 39; }

function refLabel(idx, span = 0) {
  const [b, c, v] = state.ids[idx].split(".");
  const name = BOOKS[BOOK_INDEX.get(b)][1];
  let ref = `${name} ${c}:${v}`;
  if (span > 0) {
    const [, c2, v2] = state.ids[Math.min(idx + span, state.ids.length - 1)].split(".");
    ref += c2 === c ? `–${v2}` : `–${c2}:${v2}`;
  }
  return ref;
}

function shortLabel(idx) {
  const [b, c, v] = state.ids[idx].split(".");
  return `${b} ${c}:${v}`;
}

function rangeText(idx, span) {
  let t = state.texts[idx];
  for (let i = 1; i <= span; i++) t += " " + state.texts[idx + i];
  return t;
}

function stem(w) {
  return w.replace(/(eth|est|ing|ed|es|s|'s)$/i, "").toLowerCase();
}

function significantStems(text) {
  const out = new Set();
  for (const raw of text.toLowerCase().match(/[a-z']+/g) || []) {
    if (raw.length < 3 || STOPWORDS.has(raw)) continue;
    const st = stem(raw);
    if (st.length >= 3) out.add(st);
  }
  return out;
}

function highlightShared(text, centerStems) {
  return text.replace(/[A-Za-z']+/g, (w) => {
    const lower = w.toLowerCase();
    if (lower.length >= 3 && !STOPWORDS.has(lower) && centerStems.has(stem(lower))) {
      return `<mark>${w}</mark>`;
    }
    return w;
  });
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function normWord(w) {
  return w.toLowerCase().replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ").trim();
}

function edgeVotesFor(center) {
  const m = new Map();
  for (const e of state.adj.get(center) || []) {
    const prev = m.get(e.other);
    if (prev === undefined || e.votes > prev) m.set(e.other, e.votes);
  }
  return m;
}

/* ---------- data loading ---------- */

async function load() {
  const [verses, edges, anchorsRaw, topicsRaw, relatedRaw, peopleRaw, preachedRaw] = await Promise.all([
    fetch("data/verses.json").then((r) => r.json()),
    fetch("data/edges.json").then((r) => r.json()),
    fetch("data/anchors.json").then((r) => r.json()),
    fetch("data/topics.json").then((r) => r.json()),
    fetch("data/related.json").then((r) => r.json()).catch(() => null),
    fetch("data/people.json").then((r) => r.json()).catch(() => null),
    fetch("data/preached.json").then((r) => r.json()).catch(() => null),
  ]);
  state.ids = verses.ids;
  state.texts = verses.texts;
  verses.ids.forEach((id, i) => state.idIndex.set(id, i));

  for (const [s, d, votes, span] of edges) {
    if (!state.adj.has(s)) state.adj.set(s, []);
    if (!state.adj.has(d)) state.adj.set(d, []);
    state.adj.get(s).push({ other: d, votes, span, out: true });
    state.adj.get(d).push({ other: s, votes, span: 0, out: false });
  }
  for (const list of state.adj.values()) list.sort((a, b) => b.votes - a.votes);

  for (const [srcStr, list] of Object.entries(anchorsRaw)) {
    const src = +srcStr;
    state.anchors.set(src, list.map(([word, targets]) => ({
      word,
      targets: targets.map((t) => Array.isArray(t) ? { t: t[0], span: t[1] } : { t, span: 0 }),
    })));
  }
  buildWordIndex();

  for (const [topic, rows] of Object.entries(topicsRaw)) {
    state.topics.set(topic, rows.map(([t, span, votes]) => ({ t, span, votes })));
  }

  if (relatedRaw) {
    relatedRaw.names.forEach((name, i) => {
      state.related.set(name, relatedRaw.nn[i].map(([j, sim]) => [relatedRaw.names[j], sim]));
    });
  }

  if (peopleRaw) {
    peopleRaw.people.forEach(([key, display, vs], i) => {
      state.people.push({ key, display, verses: vs });
      state.peopleByKey.set(key, i);
      for (const v of vs) {
        if (!state.peopleByVerse.has(v)) state.peopleByVerse.set(v, []);
        state.peopleByVerse.get(v).push(i);
      }
    });
  }

  if (preachedRaw) {
    state.sermons = preachedRaw.sermons;
    for (const [v, list] of Object.entries(preachedRaw.cites)) {
      state.preached.set(+v, list);
    }
  }

  document.getElementById("loading").classList.add("done");
  buildLegend();
  navigateFromHash() || show({ t: "i", k: "topics" });
}

function buildWordIndex() {
  for (const [src, list] of state.anchors) {
    for (const { word } of list) {
      const norm = normWord(word);
      if (!norm) continue;
      const tokens = norm.split(" ");
      if (tokens.length > 4) continue;
      if (!tokens.some((t) => t.length >= 3 && !STOPWORDS.has(t))) continue;
      if (!state.wordIndex.has(norm)) state.wordIndex.set(norm, []);
      const arr = state.wordIndex.get(norm);
      if (arr[arr.length - 1] !== src) arr.push(src);
    }
  }
  for (const arr of state.wordIndex.values()) arr.sort((a, b) => a - b);
}

/* ---------- routing ---------- */

function hashFor(view) {
  if (view.t === "v") return state.ids[view.k];
  if (view.t === "w") return "w:" + encodeURIComponent(view.k);
  if (view.t === "t") return "t:" + encodeURIComponent(view.k);
  if (view.t === "p") return "p:" + encodeURIComponent(view.k);
  if (view.k === "topics") return "topics";
  if (view.k === "people") return "people";
  return "words";
}

function navigateFromHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return false;
  if (h === "index" || h === "words") { show({ t: "i", k: "words" }); return true; }
  if (h === "topics") { show({ t: "i", k: "topics" }); return true; }
  if (h === "people") { show({ t: "i", k: "people" }); return true; }
  if (h.startsWith("p:")) {
    const p = decodeURIComponent(h.slice(2));
    if (state.peopleByKey.has(p)) { show({ t: "p", k: p }); return true; }
    return false;
  }
  if (h.startsWith("w:")) {
    const w = decodeURIComponent(h.slice(2));
    if (state.wordIndex.has(w)) { show({ t: "w", k: w }); return true; }
    return false;
  }
  if (h.startsWith("t:")) {
    const t = decodeURIComponent(h.slice(2));
    if (state.topics.has(t)) { show({ t: "t", k: t }); return true; }
    return false;
  }
  const idx = state.idIndex.get(h);
  if (idx != null) { show({ t: "v", k: idx }); return true; }
  return false;
}

function sameView(a, b) {
  return a && b && a.t === b.t && a.k === b.k;
}

function show(view, { pushTrail = true } = {}) {
  state.view = view;
  state.activeAnchor = null;
  location.hash = hashFor(view);

  if (pushTrail && view.t !== "i") {
    state.trail = state.trail.filter((t) => !sameView(t, view));
    state.trail.push(view);
    if (state.trail.length > 9) state.trail.shift();
  }

  document.body.classList.toggle("no-graph", view.t === "i");

  if (view.t === "v") {
    const neighbors = neighborhood(view.k);
    drawGraph(view.k, neighbors);
    drawVersePanel(view.k, neighbors);
  } else if (view.t === "w") {
    drawWordGraph(view.k);
    drawWordPanel(view.k);
  } else if (view.t === "t") {
    drawTopicGraph(view.k);
    drawTopicPanel(view.k);
  } else if (view.t === "p") {
    drawPersonGraph(view.k);
    drawPersonPanel(view.k);
  } else {
    drawIndexPanel(view.k);
  }
  drawTrail();
}

/* ---------- neighborhood ---------- */

function neighborhood(center) {
  const seen = new Map();
  for (const e of state.adj.get(center) || []) {
    if (e.votes < state.threshold) continue;
    const prev = seen.get(e.other);
    if (!prev || e.votes > prev.votes) seen.set(e.other, e);
  }
  return [...seen.values()]
    .sort((a, b) => b.votes - a.votes)
    .slice(0, state.maxNeighbors);
}

function peripheralLinks(center, neighbors) {
  const present = new Set(neighbors.map((n) => n.other));
  const links = [];
  const emitted = new Set();
  for (const n of neighbors) {
    for (const e of state.adj.get(n.other) || []) {
      if (e.other === center || !present.has(e.other) || e.votes < Math.max(1, state.threshold)) continue;
      const key = Math.min(n.other, e.other) + ":" + Math.max(n.other, e.other);
      if (emitted.has(key)) continue;
      emitted.add(key);
      links.push({ source: n.other, target: e.other, votes: e.votes, peripheral: true });
    }
  }
  return links;
}

function anchorWordFor(center, target) {
  for (const a of state.anchors.get(center) || []) {
    if (a.targets.some((x) => x.t === target)) return a.word;
  }
  return null;
}

/* ---------- graph: verse mode ---------- */

function runSimulation(nodes, links, { linkDistance, linkStrength, charge }) {
  if (simulation) simulation.stop();

  const cx = nodes[0].fx, cy = nodes[0].fy;
  nodes.forEach((n, i) => {
    if (n.fx == null) {
      const angle = (i / Math.max(1, nodes.length - 1)) * 2 * Math.PI;
      const radius = 90 + 30 * (i % 3);
      n.x = cx + radius * Math.cos(angle);
      n.y = cy + radius * Math.sin(angle);
    }
  });

  const linkSel = gLinks.selectAll("line")
    .data(links, (d) => `${d.source.id ?? d.source}→${d.target.id ?? d.target}`)
    .join("line")
    .attr("class", (d) =>
      "link" + (d.peripheral ? " peripheral" : "") + (d.cross ? " cross-testament" : ""))
    .attr("stroke-width", (d) => d.width)
    .attr("stroke-opacity", (d) => d.opacity);

  const nodeSel = gNodes.selectAll("g.node")
    .data(nodes, (d) => d.id)
    .join((enter) => {
      const g = enter.append("g");
      g.append("circle");
      g.append("text").attr("text-anchor", "middle");
      return g;
    })
    .attr("class", (d) => "node" + (d.center ? " center" : "") + (d.word ? " word-node" : ""))
    .attr("data-id", (d) => d.id);

  nodeSel.select("circle")
    .attr("r", (d) => d.r)
    .attr("fill", (d) => d.color);

  nodeSel.select("text")
    .text((d) => d.label)
    .attr("dy", (d) => d.r + 10);

  simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d) => d.id)
      .distance(linkDistance).strength(linkStrength))
    .force("charge", d3.forceManyBody().strength(charge))
    .force("collide", d3.forceCollide().radius(12))
    .force("x", d3.forceX(nodes[0].fx).strength(0.04))
    .force("y", d3.forceY(nodes[0].fy).strength(0.05))
    .alpha(1)
    .alphaDecay(0.05)
    .on("tick", () => {
      linkSel
        .attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

  gZoom.attr("transform", null);
  svg.call(d3.zoom().transform, d3.zoomIdentity);
  svg.call(d3.zoom().scaleExtent([0.3, 3]).on("zoom", (e) => gZoom.attr("transform", e.transform)));

  return { linkSel, nodeSel };
}

function drawGraph(center, neighbors) {
  const { width, height } = svg.node().getBoundingClientRect();
  const maxVotes = Math.max(1, ...neighbors.map((n) => n.votes));

  const nodes = [
    { id: center, center: true, fx: width / 2, fy: height / 2,
      r: 15, color: sectionOf(center).color, label: shortLabel(center) },
    ...neighbors.map((n, i) => ({
      id: n.other, votes: n.votes, span: n.span,
      r: 3.5 + 6.5 * Math.sqrt((n.votes || 1) / maxVotes),
      color: sectionOf(n.other).color,
      label: i < 8 ? shortLabel(n.other) : "",
    })),
  ];
  const links = [
    ...neighbors.map((n) => ({
      source: center, target: n.other, votes: n.votes,
      cross: isNT(center) !== isNT(n.other),
      width: 0.7 + 2 * Math.sqrt(n.votes / maxVotes),
      opacity: 0.28 + 0.4 * (n.votes / maxVotes),
    })),
    ...peripheralLinks(center, neighbors).map((l) => ({ ...l, width: 0.6, opacity: 0.22 })),
  ];

  const { linkSel, nodeSel } = runSimulation(nodes, links, {
    linkDistance: (d) => d.peripheral ? 85 : 55 + 95 * (1 - d.votes / maxVotes),
    linkStrength: (d) => d.peripheral ? 0.05 : 0.4,
    charge: -140,
  });

  nodeSel
    .on("click", (_, d) => { if (!d.center) show({ t: "v", k: d.id }); })
    .on("mouseenter", (event, d) => {
      showTooltip(event, d, d.center ? null : anchorWordFor(center, d.id));
      linkSel.classed("dimmed", (l) => l.source.id !== d.id && l.target.id !== d.id);
      const item = document.querySelector(`.conn[data-id="${d.id}"]`);
      if (item) item.classList.add("hovered");
    })
    .on("mousemove", (event, d) => showTooltip(event, d, d.center ? null : anchorWordFor(center, d.id)))
    .on("mouseleave", (_, d) => {
      tooltip.hidden = true;
      linkSel.classed("dimmed", false);
      applyAnchorDim();
      const item = document.querySelector(`.conn[data-id="${d.id}"]`);
      if (item) item.classList.remove("hovered");
    });
}

function applyAnchorDim() {
  const view = state.view;
  if (view.t !== "v") return;
  const anchors = state.anchors.get(view.k) || [];
  const active = state.activeAnchor;
  if (active == null || !anchors[active]) {
    gNodes.selectAll("g.node").classed("dimmed", false);
    gLinks.selectAll("line").classed("dimmed", false);
    return;
  }
  const keep = new Set(anchors[active].targets.map((x) => x.t));
  keep.add(view.k);
  gNodes.selectAll("g.node").classed("dimmed", (d) => !keep.has(d.id));
  gLinks.selectAll("line").classed("dimmed", (l) =>
    !(keep.has(l.source.id) && keep.has(l.target.id)));
}

/* ---------- graph: word mode ---------- */

function drawWordGraph(word) {
  const { width, height } = svg.node().getBoundingClientRect();
  const versesAll = state.wordIndex.get(word) || [];
  const verses = versesAll.slice(0, state.maxWordLeaves);

  const nodes = [
    { id: "w", center: true, word: true, fx: width / 2, fy: height / 2,
      r: 15, color: "#241d12", label: `“${word}”` },
    ...verses.map((v) => ({
      id: v, r: 4, color: sectionOf(v).color, label: "",
    })),
  ];
  const links = verses.map((v) => ({
    source: "w", target: v, width: 0.7, opacity: 0.3,
  }));

  const { nodeSel } = runSimulation(nodes, links, {
    linkDistance: 85 + Math.min(verses.length, 40),
    linkStrength: 0.25,
    charge: -70,
  });

  nodeSel
    .on("click", (_, d) => { if (!d.word) show({ t: "v", k: d.id }); })
    .on("mouseenter", (event, d) => { if (!d.word) showTooltip(event, d, null); })
    .on("mousemove", (event, d) => { if (!d.word) showTooltip(event, d, null); })
    .on("mouseleave", () => { tooltip.hidden = true; });
}

/* ---------- graph: topic mode ---------- */

function drawTopicGraph(topic) {
  const { width, height } = svg.node().getBoundingClientRect();
  const passages = (state.topics.get(topic) || []).slice(0, state.maxWordLeaves);
  const maxVotes = Math.max(1, ...passages.map((p) => p.votes));

  const nodes = [
    { id: "t", center: true, word: true, fx: width / 2, fy: height / 2,
      r: 15, color: "#8b2a1d",
      label: topic.length > 24 ? topic.slice(0, 22) + "…" : topic },
    ...passages.map((p, i) => ({
      id: p.t, span: p.span, votes: p.votes,
      r: 3.5 + 6 * Math.sqrt(p.votes / maxVotes),
      color: sectionOf(p.t).color,
      label: i < 6 ? shortLabel(p.t) : "",
    })),
  ];
  const links = passages.map((p) => ({
    source: "t", target: p.t,
    width: 0.6 + 2 * Math.sqrt(p.votes / maxVotes),
    opacity: 0.2 + 0.35 * (p.votes / maxVotes),
  }));

  const { nodeSel } = runSimulation(nodes, links, {
    linkDistance: (d) => 60 + 95 * (1 - d.width / 2.6),
    linkStrength: 0.3,
    charge: -80,
  });

  nodeSel
    .on("click", (_, d) => { if (!d.word) show({ t: "v", k: d.id }); })
    .on("mouseenter", (event, d) => { if (!d.word) showTooltip(event, d, null); })
    .on("mousemove", (event, d) => { if (!d.word) showTooltip(event, d, null); })
    .on("mouseleave", () => { tooltip.hidden = true; });
}

/* ---------- tooltip ---------- */

function showTooltip(event, d, anchorWord) {
  const text = rangeText(d.id, d.span || 0);
  tooltip.innerHTML =
    `<span class="tip-ref">${esc(refLabel(d.id, d.span || 0))}` +
    (d.votes ? ` · ${d.votes} votes` : "") + `</span>` +
    (anchorWord ? `<span class="tip-anchor">via “${esc(anchorWord)}”</span>` : "") +
    esc(text.length > 160 ? text.slice(0, 157) + "…" : text);
  tooltip.hidden = false;
  const pane = document.getElementById("graph-pane").getBoundingClientRect();
  let x = event.clientX - pane.left + 14;
  let y = event.clientY - pane.top + 14;
  if (x + 310 > pane.width) x -= 330;
  if (y + 130 > pane.height) y -= 150;
  tooltip.style.left = x + "px";
  tooltip.style.top = y + "px";
}

/* ---------- panel: verse mode ---------- */

function anchoredVerseHtml(center, anchors) {
  const text = state.texts[center];
  const lower = text.toLowerCase();
  const ranges = [];
  const unmatched = [];
  let pos = 0;
  anchors.forEach((a, i) => {
    const w = a.word.toLowerCase();
    let at = lower.indexOf(w, pos);
    if (at === -1) at = lower.indexOf(w);
    if (at === -1 || !w) { unmatched.push(i); return; }
    if (ranges.some((r) => at < r.end && at + w.length > r.start)) { unmatched.push(i); return; }
    ranges.push({ start: at, end: at + w.length, i });
    pos = at + 1;
  });
  ranges.sort((a, b) => a.start - b.start);

  let html = "";
  let cur = 0;
  for (const r of ranges) {
    html += esc(text.slice(cur, r.start));
    html += `<span class="anchor" data-ai="${r.i}">${esc(text.slice(r.start, r.end))}</span>`;
    cur = r.end;
  }
  html += esc(text.slice(cur));
  return { html, unmatched };
}

function drawVersePanel(center, neighbors) {
  const section = sectionOf(center);
  const anchors = state.anchors.get(center) || [];
  const votesBy = edgeVotesFor(center);
  const centerStems = significantStems(state.texts[center]);
  const voted = (state.adj.get(center) || []).filter((e) => e.votes > 0).length;
  const crossCount = neighbors.filter((n) => isNT(center) !== isNT(n.other)).length;
  const maxVotes = Math.max(1, ...neighbors.map((n) => n.votes), ...votesBy.values());

  const { html: verseHtml, unmatched } = anchoredVerseHtml(center, anchors);

  let html = `
    <div class="verse-kicker">
      <span class="section-dot" style="background:${section.color}"></span>
      ${section.name} · ${isNT(center) ? "New" : "Old"} Testament
    </div>
    <h2 class="verse-ref">${esc(refLabel(center))}</h2>
    <p class="verse-text">${verseHtml}</p>`;

  if (unmatched.length) {
    html += `<div class="anchor-chips">` + unmatched.map((i) =>
      `<button class="anchor-chip" data-ai="${i}">“${esc(anchors[i].word.length > 48 ? anchors[i].word.slice(0, 45) + "…" : anchors[i].word)}”</button>`
    ).join("") + `</div>`;
  }

  html += `<p class="verse-stats">${anchors.length ?
      `${anchors.length} anchor phrase${anchors.length === 1 ? "" : "s"} from the Treasury of Scripture Knowledge — click one to trace its thread. ` : ""}
    ${voted} voted connection${voted === 1 ? "" : "s"}; graph shows ${neighbors.length} with ≥${state.threshold} votes, ${crossCount} crossing the Testaments.</p>`;

  const folks = state.peopleByVerse.get(center) || [];
  if (folks.length) {
    html += `
      <div class="connections-heading">People here</div>
      <div class="index-cloud related-cloud">` +
      folks.map((pi) => {
        const p = state.people[pi];
        return `<button class="index-word" data-p="${esc(p.key)}">${esc(p.display)} <span class="index-count">${p.verses.length}</span></button>`;
      }).join("") + `</div>`;
  }

  const sermons = state.preached.get(center) || [];
  if (sermons.length) {
    html += `
      <div class="connections-heading">Preached at Berean</div>
      <div class="sermon-list">` +
      sermons.slice(0, 6).map(([si, sec]) => {
        const [title, date, url] = state.sermons[si];
        const t = url + (url.includes("?") ? "&" : "?") + "t=" + sec + "s";
        const mm = Math.floor(sec / 60), ss = String(sec % 60).padStart(2, "0");
        return `<a class="sermon-item" href="${esc(t)}" target="_blank" rel="noopener">
          <span class="sermon-date">${esc(date)}${sec ? ` · at ${mm}:${ss}` : ""}</span>
          ${esc(title)}</a>`;
      }).join("") + `</div>`;
  }

  const covered = new Set();

  const connCard = (t, span, anchorless = false) => {
    const sec = sectionOf(t);
    const text = rangeText(t, span);
    const shown = text.length > 220 ? text.slice(0, 217) + "…" : text;
    const votes = votesBy.get(t) || 0;
    const cross = isNT(center) !== isNT(t);
    return `
      <div class="conn" data-id="${t}">
        <div class="conn-head">
          <span class="conn-ref"><span class="section-dot" style="background:${sec.color}"></span>${esc(refLabel(t, span))}</span>
          ${cross ? '<span class="cross-badge">across testaments</span>' : ""}
          <span class="conn-votes">${votes
            ? `<span class="bar" style="width:${Math.max(3, 36 * votes / maxVotes)}px"></span>${votes}`
            : (anchorless ? "" : "unvoted")}</span>
        </div>
        <div class="conn-text">${highlightShared(esc(shown), centerStems)}</div>
      </div>`;
  };

  anchors.forEach((a, i) => {
    const targets = [...a.targets].sort((x, y) => (votesBy.get(y.t) || 0) - (votesBy.get(x.t) || 0));
    targets.forEach((x) => covered.add(x.t));
    html += `
      <div class="anchor-group" data-ai="${i}">
        <h3 class="anchor-word" data-ai="${i}"><span class="anchor-quote">“${esc(a.word)}”</span>
          <span class="anchor-count">${targets.length}</span></h3>
        ${targets.map((x) => connCard(x.t, x.span)).join("")}
      </div>`;
  });

  const extra = neighbors.filter((n) => !covered.has(n.other) && n.votes > 0).slice(0, 30);
  if (extra.length) {
    html += `
      <div class="anchor-group">
        <h3 class="anchor-word"><span class="anchor-quote">also connected</span>
          <span class="anchor-count">${extra.length}</span></h3>
        <p class="group-note">Voted cross-references and citations of this verse not tied to an anchor phrase.</p>
        ${extra.map((n) => connCard(n.other, n.span, true)).join("")}
      </div>`;
  }

  if (!anchors.length && !extra.length) {
    html += `<p class="empty-note">No connections recorded for this verse.</p>`;
  }

  const panel = document.getElementById("panel-content");
  panel.innerHTML = html;
  window.scrollTo({ top: 0 });

  panel.querySelectorAll(".conn").forEach((el) => {
    const id = +el.dataset.id;
    el.addEventListener("click", () => show({ t: "v", k: id }));
    el.addEventListener("mouseenter", () => {
      gNodes.selectAll("g.node").classed("dimmed", (d) => !d.center && d.id !== id);
    });
    el.addEventListener("mouseleave", () => applyAnchorDim());
  });

  panel.querySelectorAll(".index-word[data-p]").forEach((el) => {
    el.addEventListener("click", () => show({ t: "p", k: el.dataset.p }));
  });

  panel.querySelectorAll(".anchor, .anchor-chip, .anchor-word[data-ai]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleAnchor(+el.dataset.ai);
    });
  });
}

function toggleAnchor(i) {
  state.activeAnchor = state.activeAnchor === i ? null : i;
  const panel = document.getElementById("panel-content");
  panel.querySelectorAll(".anchor, .anchor-chip").forEach((el) => {
    el.classList.toggle("active", +el.dataset.ai === state.activeAnchor);
  });
  panel.querySelectorAll(".anchor-group[data-ai]").forEach((el) => {
    el.classList.toggle("focused", +el.dataset.ai === state.activeAnchor);
    el.classList.toggle("faded", state.activeAnchor != null && +el.dataset.ai !== state.activeAnchor);
  });
  applyAnchorDim();
  if (state.activeAnchor != null) {
    const group = panel.querySelector(`.anchor-group[data-ai="${state.activeAnchor}"]`);
    if (group) group.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

/* ---------- panel: word mode ---------- */

function drawWordPanel(word) {
  const verses = state.wordIndex.get(word) || [];
  const shown = verses.slice(0, 200);
  const re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"), "i");

  let html = `
    <div class="verse-kicker"><span class="section-dot" style="background:#241d12"></span>
      Anchor word · Treasury of Scripture Knowledge</div>
    <h2 class="verse-ref word-title">“${esc(word)}”</h2>
    <p class="verse-stats">${verses.length} verse${verses.length === 1 ? "" : "s"} hang cross-references on this phrase${verses.length > state.maxWordLeaves ? ` — graph shows the first ${state.maxWordLeaves}` : ""}.
      Click a verse to enter its neighborhood.</p>
    <div class="connections-heading">Verses · in canonical order</div>`;

  for (const v of shown) {
    const sec = sectionOf(v);
    const text = state.texts[v];
    const marked = esc(text).replace(re, (m) => `<mark>${m}</mark>`);
    html += `
      <div class="conn" data-id="${v}">
        <div class="conn-head">
          <span class="conn-ref"><span class="section-dot" style="background:${sec.color}"></span>${esc(refLabel(v))}</span>
        </div>
        <div class="conn-text">${marked}</div>
      </div>`;
  }
  if (verses.length > shown.length) {
    html += `<p class="empty-note">…and ${verses.length - shown.length} more.</p>`;
  }

  const panel = document.getElementById("panel-content");
  panel.innerHTML = html;
  window.scrollTo({ top: 0 });
  panel.querySelectorAll(".conn").forEach((el) => {
    el.addEventListener("click", () => show({ t: "v", k: +el.dataset.id }));
  });
}

/* ---------- panel: topic mode ---------- */

function topicVotesTotal(rows) {
  let sum = 0;
  for (const r of rows) sum += r.votes;
  return sum;
}

function fmtVotes(n) {
  return n >= 10000 ? Math.round(n / 1000) + "k"
       : n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);
}

function drawTopicPanel(topic) {
  const passages = state.topics.get(topic) || [];
  const maxVotes = Math.max(1, ...passages.map((p) => p.votes));

  let html = `
    <div class="verse-kicker"><span class="section-dot" style="background:#8b2a1d"></span>
      Topic · openbible.info topical bible</div>
    <h2 class="verse-ref">${esc(topic)}</h2>
    <p class="verse-stats">${passages.length} passages, ranked by ${fmtVotes(topicVotesTotal(passages))} reader votes.
      Click a passage to enter its cross-reference neighborhood.</p>`;

  const related = state.related.get(topic) || [];
  if (related.length) {
    html += `
      <div class="connections-heading">Related topics · by meaning</div>
      <div class="index-cloud related-cloud">` +
      related.map(([name, sim]) =>
        `<button class="index-word" data-t="${esc(name)}">${esc(name)} <span class="index-count">${sim}%</span></button>`
      ).join("") + `</div>`;
  }

  html += `<div class="connections-heading">Passages · by votes</div>`;

  for (const p of passages) {
    const sec = sectionOf(p.t);
    const text = rangeText(p.t, p.span);
    const shown = text.length > 260 ? text.slice(0, 257) + "…" : text;
    html += `
      <div class="conn" data-id="${p.t}">
        <div class="conn-head">
          <span class="conn-ref"><span class="section-dot" style="background:${sec.color}"></span>${esc(refLabel(p.t, p.span))}</span>
          <span class="conn-votes"><span class="bar" style="width:${Math.max(3, 36 * p.votes / maxVotes)}px"></span>${fmtVotes(p.votes)}</span>
        </div>
        <div class="conn-text">${esc(shown)}</div>
      </div>`;
  }

  const panel = document.getElementById("panel-content");
  panel.innerHTML = html;
  window.scrollTo({ top: 0 });
  panel.querySelectorAll(".conn").forEach((el) => {
    el.addEventListener("click", () => show({ t: "v", k: +el.dataset.id }));
  });
  panel.querySelectorAll(".related-cloud .index-word").forEach((el) => {
    el.addEventListener("click", () => show({ t: "t", k: el.dataset.t }));
  });
}

/* ---------- graph & panel: person mode ---------- */

function personOf(key) { return state.people[state.peopleByKey.get(key)]; }

function drawPersonGraph(key) {
  const { width, height } = svg.node().getBoundingClientRect();
  const p = personOf(key);
  const verses = p.verses.slice(0, state.maxWordLeaves);

  const nodes = [
    { id: "p", center: true, word: true, fx: width / 2, fy: height / 2,
      r: 15, color: "#63417a",
      label: p.display.length > 24 ? p.display.slice(0, 22) + "…" : p.display },
    ...verses.map((v) => ({ id: v, r: 4, color: sectionOf(v).color, label: "" })),
  ];
  const links = verses.map((v) => ({ source: "p", target: v, width: 0.7, opacity: 0.3 }));

  const { nodeSel } = runSimulation(nodes, links, {
    linkDistance: 85 + Math.min(verses.length, 40),
    linkStrength: 0.25,
    charge: -70,
  });

  nodeSel
    .on("click", (_, d) => { if (!d.word) show({ t: "v", k: d.id }); })
    .on("mouseenter", (event, d) => { if (!d.word) showTooltip(event, d, null); })
    .on("mousemove", (event, d) => { if (!d.word) showTooltip(event, d, null); })
    .on("mouseleave", () => { tooltip.hidden = true; });
}

function drawPersonPanel(key) {
  const p = personOf(key);
  const shown = p.verses.slice(0, 200);
  const nameToken = p.display.split(/[ (]/)[0];
  const re = new RegExp("\\b" + nameToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[a-z']*", "gi");

  let html = `
    <div class="verse-kicker"><span class="section-dot" style="background:#63417a"></span>
      Person · Theographic Bible metadata</div>
    <h2 class="verse-ref">${esc(p.display)}</h2>
    <p class="verse-stats">Appears in ${p.verses.length.toLocaleString()} verse${p.verses.length === 1 ? "" : "s"}${p.verses.length > state.maxWordLeaves ? ` — graph shows the first ${state.maxWordLeaves}` : ""}.
      Click a verse to enter its cross-reference neighborhood.</p>
    <div class="connections-heading">Verses · in canonical order</div>`;

  for (const v of shown) {
    const sec = sectionOf(v);
    const marked = esc(state.texts[v]).replace(re, (m) => `<mark>${m}</mark>`);
    html += `
      <div class="conn" data-id="${v}">
        <div class="conn-head">
          <span class="conn-ref"><span class="section-dot" style="background:${sec.color}"></span>${esc(refLabel(v))}</span>
        </div>
        <div class="conn-text">${marked}</div>
      </div>`;
  }
  if (p.verses.length > shown.length) {
    html += `<p class="empty-note">…and ${p.verses.length - shown.length} more.</p>`;
  }

  const panel = document.getElementById("panel-content");
  panel.innerHTML = html;
  window.scrollTo({ top: 0 });
  panel.querySelectorAll(".conn").forEach((el) => {
    el.addEventListener("click", () => show({ t: "v", k: +el.dataset.id }));
  });
}

/* ---------- panel: word & topic indexes ---------- */

function drawIndexPanel(kind = "words") {
  let heading, kicker, blurb, entries, dot, placeholder;
  if (kind === "topics") {
    kicker = "Topic index";
    heading = "Start from a topic";
    dot = "#8b2a1d";
    placeholder = "Filter topics…";
    entries = [...state.topics.entries()]
      .map(([t, rows]) => [t, topicVotesTotal(rows)])
      .sort((a, b) => b[1] - a[1])
      .map(([t, votes]) => ({ key: t, label: t, count: fmtVotes(votes), view: { t: "t", k: t } }));
    blurb = `openbible.info readers voted on which passages best answer
      ${entries.length.toLocaleString()} topics — all of them are below, most-voted first.
      Click one to see its passages.`;
  } else if (kind === "people") {
    kicker = "People index";
    heading = "Start from a person";
    dot = "#63417a";
    placeholder = "Filter people…";
    entries = state.people.map((p) => ({
      key: p.key, label: p.display, count: p.verses.length, view: { t: "p", k: p.key },
    }));
    blurb = `Every named person the Theographic Bible metadata links to the text —
      ${entries.length.toLocaleString()} people, ordered by how many verses they appear in.
      Click one to see their verses.`;
  } else {
    kicker = "Word index";
    heading = "Start from a word";
    dot = "#241d12";
    placeholder = "Filter words…";
    entries = [...state.wordIndex.entries()]
      .filter(([, v]) => v.length >= 3)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([w, v]) => ({ key: w, label: w, count: v.length, view: { t: "w", k: w } }));
    blurb = `The Treasury of Scripture Knowledge hangs its cross-references on
      words and phrases. All ${entries.length.toLocaleString()} that recur in three or more
      verses are below, most recurrent first — click one to see every verse it opens.`;
  }

  let html = `
    <div class="verse-kicker"><span class="section-dot" style="background:${dot}"></span>
      ${kicker}</div>
    <h2 class="verse-ref">${heading}</h2>
    <p class="verse-stats">${blurb}</p>
    <input class="index-filter" type="text" placeholder="${placeholder}" spellcheck="false">
    <p class="index-filter-count"></p>
    <div class="index-cloud">` +
    entries.map((e, i) =>
      `<button class="index-word" data-i="${i}" data-k="${esc(e.key)}">${esc(e.label)} <span class="index-count">${e.count}</span></button>`
    ).join("") + `</div>`;

  const panel = document.getElementById("panel-content");
  panel.innerHTML = html;
  window.scrollTo({ top: 0 });

  const cloud = panel.querySelector(".index-cloud");
  cloud.addEventListener("click", (e) => {
    const btn = e.target.closest(".index-word");
    if (btn) show(entries[+btn.dataset.i].view);
  });

  const filter = panel.querySelector(".index-filter");
  const countEl = panel.querySelector(".index-filter-count");
  const chips = [...cloud.children];
  filter.addEventListener("input", () => {
    const q = filter.value.toLowerCase().trim();
    let shown = 0;
    for (const chip of chips) {
      const hit = !q || chip.dataset.k.includes(q);
      chip.style.display = hit ? "" : "none";
      if (hit) shown++;
    }
    countEl.textContent = q ? `${shown.toLocaleString()} match${shown === 1 ? "" : "es"}` : "";
  });
  filter.focus();
}

/* ---------- trail ---------- */

function drawTrail() {
  const nav = document.getElementById("trail");
  nav.innerHTML = "";
  state.trail.forEach((view, i) => {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.className = "trail-sep";
      sep.textContent = "→";
      nav.appendChild(sep);
    }
    const b = document.createElement("button");
    b.className = "trail-crumb" + (sameView(view, state.view) ? " current" : "");
    b.textContent = view.t === "v" ? refLabel(view.k)
                  : view.t === "w" ? `“${view.k}”`
                  : view.t === "p" ? personOf(view.k).display : `✦ ${view.k}`;
    b.addEventListener("click", () => show(view, { pushTrail: false }));
    nav.appendChild(b);
  });
}

function buildLegend() {
  document.getElementById("legend").innerHTML = SECTIONS
    .map((s) => `<span class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${s.name}</span>`)
    .join("") +
    `<span class="legend-item"><span class="legend-dot" style="background:none;border-top:2px solid #8b2a1d;border-radius:0;height:0"></span>edge crosses testaments</span>`;
}

/* ---------- search ---------- */

const BOOK_ALIASES = new Map();
BOOKS.forEach(([osis, name]) => {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  BOOK_ALIASES.set(norm(osis), osis);
  BOOK_ALIASES.set(norm(name), osis);
  const compact = norm(name);
  for (let len = 3; len < compact.length; len++) {
    const prefix = compact.slice(0, len);
    if (!BOOK_ALIASES.has(prefix)) BOOK_ALIASES.set(prefix, osis);
  }
});
[["psalms", "Ps"], ["ps", "Ps"], ["sos", "Song"], ["song", "Song"], ["jn", "John"],
 ["jhn", "John"], ["mt", "Matt"], ["mk", "Mark"], ["lk", "Luke"], ["rv", "Rev"],
 ["1jn", "1John"], ["2jn", "2John"], ["3jn", "3John"], ["dt", "Deut"], ["gn", "Gen"],
 ["ex", "Exod"], ["lv", "Lev"], ["nm", "Num"], ["php", "Phil"], ["phm", "Phlm"],
].forEach(([a, o]) => BOOK_ALIASES.set(a, o));

function parseRef(input) {
  const m = input.trim().match(/^(\d?\s*[A-Za-z .]+?)\s*(\d+)\s*[:. ]?\s*(\d+)?\s*$/);
  if (!m) return null;
  const book = BOOK_ALIASES.get(m[1].toLowerCase().replace(/[^a-z0-9]/g, ""));
  if (!book) return null;
  const ch = m[2];
  const v = m[3] || "1";
  return state.idIndex.get(`${book}.${ch}.${v}`) ??
         state.idIndex.get(`${book}.${ch}.1`) ??
         state.idIndex.get(`${book}.1.1`);
}

function stemToken(t) {
  return t.replace(/(iness|ness|ously|ious|ies|ily|ing|ous|ety|ed|es|ty|y|s)$/, "");
}

function fuzzyTopicMatch(q) {
  const qStems = q.split(/\s+/).map(stemToken).filter((s) => s.length >= 3);
  if (!qStems.length) return null;
  let best = null, bestScore = 0;
  for (const [topic, rows] of state.topics) {
    const tStems = topic.split(/\s+/).map(stemToken);
    let hits = 0;
    for (const qs of qStems) {
      if (tStems.some((ts) => ts.length >= 3 &&
          (ts.startsWith(qs) || qs.startsWith(ts)) &&
          Math.min(ts.length, qs.length) >= 4)) hits++;
    }
    if (hits === qStems.length) {
      const score = 1e9 / (topic.length + 1) + topicVotesTotal(rows) / 1e6;
      if (score > bestScore) { bestScore = score; best = topic; }
    }
  }
  return best;
}

document.getElementById("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("search-input");
  const raw = input.value;
  input.value = "";

  const idx = parseRef(raw);
  if (idx != null) { show({ t: "v", k: idx }); return; }

  const q = raw.toLowerCase().trim();
  const personExact = state.people.find((p) => p.display.toLowerCase() === q);
  if (personExact) { show({ t: "p", k: personExact.key }); return; }

  if (state.topics.has(q)) { show({ t: "t", k: q }); return; }

  const word = normWord(raw);
  if (state.wordIndex.has(word)) { show({ t: "w", k: word }); return; }

  if (q) {
    const topicMatches = [...state.topics.keys()].filter((t) => t.includes(q))
      .sort((a, b) => topicVotesTotal(state.topics.get(b)) - topicVotesTotal(state.topics.get(a)));
    if (topicMatches.length) { show({ t: "t", k: topicMatches[0] }); return; }
  }
  if (word) {
    const wordMatches = [...state.wordIndex.keys()].filter((w) => w.includes(word))
      .sort((a, b) => state.wordIndex.get(b).length - state.wordIndex.get(a).length);
    if (wordMatches.length) { show({ t: "w", k: wordMatches[0] }); return; }
  }
  if (q && q.length >= 3) {
    const person = state.people.find((p) => p.display.toLowerCase().includes(q));
    if (person) { show({ t: "p", k: person.key }); return; }
  }
  if (q) {
    const fuzzy = fuzzyTopicMatch(q);
    if (fuzzy) { show({ t: "t", k: fuzzy }); return; }
  }
  input.placeholder = "Nothing found — try “Rom 8:28”, “mercy”, or “forgiveness”";
});

document.getElementById("index-btn").addEventListener("click", () => show({ t: "i", k: "words" }));
document.getElementById("topics-btn").addEventListener("click", () => show({ t: "i", k: "topics" }));
document.getElementById("people-btn").addEventListener("click", () => show({ t: "i", k: "people" }));

const thresholdInput = document.getElementById("threshold");
thresholdInput.addEventListener("input", () => {
  state.threshold = +thresholdInput.value;
  document.getElementById("threshold-value").textContent = state.threshold;
  if (state.view) show(state.view, { pushTrail: false });
});

window.addEventListener("hashchange", () => {
  const target = decodeURIComponent(location.hash.slice(1));
  if (state.view && target === hashFor(state.view)) return;
  navigateFromHash();
});

window.addEventListener("resize", () => {
  if (state.view) show(state.view, { pushTrail: false });
});

load();
