/* Preached — a sermon archive shaped like the Bible.
   Data: preached/data/sermons.json built from Berean transcripts. */

const BOOKS = [
  ["Gen", "Genesis", 50], ["Exod", "Exodus", 40], ["Lev", "Leviticus", 27],
  ["Num", "Numbers", 36], ["Deut", "Deuteronomy", 34], ["Josh", "Joshua", 24],
  ["Judg", "Judges", 21], ["Ruth", "Ruth", 4], ["1Sam", "1 Samuel", 31],
  ["2Sam", "2 Samuel", 24], ["1Kgs", "1 Kings", 22], ["2Kgs", "2 Kings", 25],
  ["1Chr", "1 Chronicles", 29], ["2Chr", "2 Chronicles", 36], ["Ezra", "Ezra", 10],
  ["Neh", "Nehemiah", 13], ["Esth", "Esther", 10], ["Job", "Job", 42],
  ["Ps", "Psalms", 150], ["Prov", "Proverbs", 31], ["Eccl", "Ecclesiastes", 12],
  ["Song", "Song of Solomon", 8], ["Isa", "Isaiah", 66], ["Jer", "Jeremiah", 52],
  ["Lam", "Lamentations", 5], ["Ezek", "Ezekiel", 48], ["Dan", "Daniel", 12],
  ["Hos", "Hosea", 14], ["Joel", "Joel", 3], ["Amos", "Amos", 9],
  ["Obad", "Obadiah", 1], ["Jonah", "Jonah", 4], ["Mic", "Micah", 7],
  ["Nah", "Nahum", 3], ["Hab", "Habakkuk", 3], ["Zeph", "Zephaniah", 3],
  ["Hag", "Haggai", 2], ["Zech", "Zechariah", 14], ["Mal", "Malachi", 4],
  ["Matt", "Matthew", 28], ["Mark", "Mark", 16], ["Luke", "Luke", 24],
  ["John", "John", 21], ["Acts", "Acts", 28], ["Rom", "Romans", 16],
  ["1Cor", "1 Corinthians", 16], ["2Cor", "2 Corinthians", 13], ["Gal", "Galatians", 6],
  ["Eph", "Ephesians", 6], ["Phil", "Philippians", 4], ["Col", "Colossians", 4],
  ["1Thess", "1 Thessalonians", 5], ["2Thess", "2 Thessalonians", 3],
  ["1Tim", "1 Timothy", 6], ["2Tim", "2 Timothy", 4], ["Titus", "Titus", 3],
  ["Phlm", "Philemon", 1], ["Heb", "Hebrews", 13], ["Jas", "James", 5],
  ["1Pet", "1 Peter", 5], ["2Pet", "2 Peter", 3], ["1John", "1 John", 5],
  ["2John", "2 John", 1], ["3John", "3 John", 1], ["Jude", "Jude", 1],
  ["Rev", "Revelation", 22],
];
const BOOK_NAME = new Map(BOOKS.map(([o, n]) => [o, n]));

let DATA = null;
let ANALYTICS = null;
let byChapter = new Map();   // "Gal.3" -> [{s: sermonIdx, ts, fromTitle}]
let byId = new Map();

/* classification palette — CVD-validated against the paper surface in this
   legend/stack order (olive, blue, gold); gold's low contrast is relieved by
   direct labels, 2px gaps, and the table view */
const CLS = [
  ["expository", "#6d8226", "walks through one passage"],
  ["mixed", "#4468b0", "one passage, ranging widely"],
  ["topical", "#bf8a14", "ranges across the canon"],
];
const CLS_COLOR = new Map(CLS.map(([k, c]) => [k, c]));

const main = document.getElementById("main");
const crumbs = document.getElementById("crumbs");

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function refLabel(osis) {
  const [b, c, v] = osis.split(".");
  return `${BOOK_NAME.get(b)} ${c}${v ? ":" + v : ""}`;
}

function tsLink(url, sec) {
  return url + (url.includes("?") ? "&" : "?") + "t=" + sec + "s";
}

function fmtTime(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
}

function passageLabel(s) {
  if (!s.passage) return null;
  const [start, endVerse] = s.passage;
  const [b, c, v] = start.split(".");
  let label = `${BOOK_NAME.get(b)} ${c}`;
  if (endVerse) label += `:${v}` + (endVerse > +v ? `–${endVerse}` : "");
  return label;
}

async function load() {
  [DATA, ANALYTICS] = await Promise.all([
    fetch("data/sermons.json").then((r) => r.json()),
    fetch("data/analytics.json").then((r) => r.json()).catch(() => null),
  ]);
  DATA.sermons.forEach((s, i) => {
    byId.set(s.id, i);
    const titleCh = s.passage ? s.passage[0].split(".").slice(0, 2).join(".") : null;
    for (const [ch, ts] of s.chapters) {
      if (!byChapter.has(ch)) byChapter.set(ch, []);
      byChapter.get(ch).push({ s: i, ts, fromTitle: ch === titleCh });
    }
  });
  document.getElementById("tagline").textContent =
    `${DATA.sermons.length.toLocaleString()} sermons from ${DATA.church}, mapped to the Scriptures they open`;
  route();
}

/* ---------- views ---------- */

function heat(n) {
  if (!n) return "";
  const a = Math.min(0.15 + n * 0.13, 0.95);
  return `background: rgba(169, 125, 28, ${a.toFixed(2)});` +
    (n >= 6 ? "border-color: #a97d1c;" : "");
}

function drawHome() {
  crumbs.innerHTML = "";
  let html = `
    <p class="page-kicker">The archive, shaped like the Bible</p>
    <h2 class="page-title">Where has this church walked?</h2>
    <p class="page-note">Each square is a chapter; the deeper the gold, the more sermons
    read or teach from it. Click any tinted square for its sermons. The pale regions are
    honest too — every pulpit has them.${ANALYTICS ?
      ` Or step back and see <a href="#analytics">the pulpit, measured →</a>` : ""}</p>`;

  const testaments = [["Old Testament", 0, 39], ["New Testament", 39, 66]];
  for (const [label, from, to] of testaments) {
    html += `<p class="testament-label">${label}</p>`;
    for (let bi = from; bi < to; bi++) {
      const [osis, name, chs] = BOOKS[bi];
      let cells = "";
      let total = 0;
      for (let c = 1; c <= chs; c++) {
        const n = (byChapter.get(`${osis}.${c}`) || []).length;
        total += n;
        cells += `<span class="chapter-cell${n ? " has" : ""}" style="${heat(n)}"
          ${n ? `data-ch="${osis}.${c}"` : ""} title="${name} ${c}${n ? ` · ${n} sermon${n > 1 ? "s" : ""}` : ""}"></span>`;
      }
      html += `<div class="book-row"><span class="book-name"><b>${name}</b></span>
        <span class="chapter-cells">${cells}</span></div>`;
    }
  }

  html += `<p class="grid-legend"><span class="chapter-cell" style="${heat(1)}"></span> one sermon
    <span class="chapter-cell" style="${heat(3)}"></span> a few
    <span class="chapter-cell" style="${heat(8)}"></span> a series lives here</p>`;

  main.innerHTML = html;
  main.querySelectorAll(".chapter-cell.has").forEach((el) => {
    el.addEventListener("click", () => { location.hash = el.dataset.ch; });
  });
  window.scrollTo({ top: 0 });
}

function drawChapter(ch) {
  const rows = (byChapter.get(ch) || []).slice()
    .sort((a, b) => (b.fromTitle - a.fromTitle) ||
      DATA.sermons[b.s].date.localeCompare(DATA.sermons[a.s].date));
  crumbs.innerHTML = `<a href="#">← all books</a>`;

  let html = `
    <p class="page-kicker">Chapter</p>
    <h2 class="page-title">${esc(refLabel(ch))}</h2>
    <p class="page-note">${rows.length} sermon${rows.length === 1 ? "" : "s"} read or teach from
    this chapter. Sermons preached <em>on</em> it come first.
    <a href="../verse-explorer/#${ch}.1">Open the chapter in the explorer →</a></p>`;

  for (const r of rows) {
    const s = DATA.sermons[r.s];
    const pass = passageLabel(s);
    html += `
      <a class="sermon-row" href="#s:${s.id}">
        <div class="sermon-meta">${s.date} · ${s.type}</div>
        <div class="sermon-title">${esc(s.title || s.type)}
          ${r.fromTitle && pass ? `<span class="badge">on ${esc(pass)}</span>` : ""}</div>
      </a>`;
  }
  if (!rows.length) html += `<p class="empty-note">No sermons found for this chapter.</p>`;

  main.innerHTML = html;
  window.scrollTo({ top: 0 });
}

function drawSermon(id) {
  const s = DATA.sermons[byId.get(id)];
  crumbs.innerHTML = `<a href="#">← all books</a>`;
  const pass = passageLabel(s);
  const isYT = /youtube|youtu\.be/.test(s.url);

  let html = `
    <p class="page-kicker">${esc(s.type)} · ${s.date}</p>
    <h2 class="page-title">${esc(s.title || s.type)}</h2>
    <div class="watch">
      ${isYT ? `<img class="thumb" src="https://i.ytimg.com/vi/${esc(s.id)}/hqdefault.jpg" alt="">` : ""}
      <div class="watch-info">
        <a class="watch-link" href="${esc(s.url)}" target="_blank" rel="noopener">Watch the sermon ↗</a>
        ${s.dur ? `<p>${Math.round(s.dur / 60)} minutes</p>` : ""}
        ${pass ? `<p>Preached on ${esc(pass)}</p>` : ""}
      </div>
    </div>`;

  const a = ANALYTICS && ANALYTICS.sermons[s.id];
  if (a && (a.cls !== "unclassified" || (a.words >= 500 && a.read))) {
    html += `<div class="badge-row">`;
    if (a.cls !== "unclassified") {
      html += `<span class="cls-chip" title="${a.series ?
          "part of a series walking through one book" :
          `${Math.round((a.conc || 0) * 100)}% of its citations stay in the main chapter`}">
        <i style="background:${CLS_COLOR.get(a.cls)}"></i>${a.cls}</span>`;
    }
    if (a.words >= 500 && a.read) {
      html += `<span class="cls-chip" title="share of the transcript matching the Bible text nearly verbatim">
        ≈${Math.round(a.read * 100)}% Scripture read aloud</span>`;
    }
    html += `</div>`;
  }
  if (a && a.quotes) {
    html += `<p class="cites-heading">Voices quoted · click a time to jump there</p>`;
    for (const [name, count, ts] of a.quotes) {
      html += `
        <div class="cite-row">
          <a class="cite-time" href="${esc(tsLink(s.url, ts))}" target="_blank" rel="noopener">${fmtTime(ts)}</a>
          <span class="cite-ref">${esc(name)}${count > 1 ? ` <span class="quote-n">× ${count}</span>` : ""}</span>
        </div>`;
    }
  }

  if (s.cites.length) {
    html += `<p class="cites-heading">Verses read or cited · click a time to jump there</p>`;
    for (const [osis, ts] of s.cites) {
      html += `
        <div class="cite-row">
          <a class="cite-time" href="${esc(tsLink(s.url, ts))}" target="_blank" rel="noopener">${fmtTime(ts)}</a>
          <a class="cite-ref" href="../verse-explorer/#${esc(osis)}">${esc(refLabel(osis))}</a>
        </div>`;
    }
  }

  const chOnly = s.chapters.filter(([ch]) =>
    !s.cites.some(([osis]) => osis.startsWith(ch + ".")));
  if (chOnly.length) {
    html += `<p class="cites-heading">Chapters mentioned</p>`;
    for (const [ch, ts] of chOnly) {
      html += `
        <div class="cite-row">
          <a class="cite-time" href="${esc(tsLink(s.url, ts))}" target="_blank" rel="noopener">${fmtTime(ts)}</a>
          <a class="cite-ref" href="#${esc(ch)}">${esc(refLabel(ch))}</a>
        </div>`;
    }
  }
  if (!s.cites.length && !chOnly.length) {
    html += `<p class="empty-note">No scripture references were detected in this transcript.</p>`;
  }

  main.innerHTML = html;
  window.scrollTo({ top: 0 });
}

/* ---------- analytics ---------- */

function pct(x) { return Math.round(x * 100) + "%"; }

function stackBar(parts, title) {
  // parts: [[label, count, color]], rendered as a 100%-stacked thin bar
  const total = parts.reduce((t, p) => t + p[1], 0);
  if (!total) return "";
  let segs = "";
  for (const [label, count, color] of parts) {
    if (!count) continue;
    segs += `<i class="seg" style="flex-grow:${count};background:${color}"
      title="${esc(title)} · ${label}: ${count} of ${total} (${pct(count / total)})"></i>`;
  }
  return `<div class="stack">${segs}</div>`;
}

function drawAnalytics() {
  const A = ANALYTICS;
  crumbs.innerHTML = `<a href="#">← the archive</a>`;
  const o = A.overall;
  const expShare = pct(o.expository / o.classified);
  const topVoice = A.people[0];

  let html = `
    <p class="page-kicker">The pulpit, measured</p>
    <h2 class="page-title">How does this church preach?</h2>
    <p class="page-note">Fifteen years of transcripts, read three ways: does a sermon walk
    through one passage or range across the canon, how much of it is Scripture read aloud,
    and whose voices get quoted from the pulpit. Estimates from transcript analysis — the
    method is described at the bottom.</p>

    <div class="stats-row">
      <div class="stat"><b>${o.n.toLocaleString()}</b>sermons</div>
      <div class="stat"><b>${o.hours.toLocaleString()}</b>hours of preaching</div>
      <div class="stat"><b>${expShare}</b>expository, of ${o.classified.toLocaleString()} classified</div>
      <div class="stat"><b>${pct(o.read_avg)}</b>of a sermon is Scripture read aloud</div>
      <div class="stat"><b>${esc(topVoice[0])}</b>most-quoted voice · ${topVoice[2]} sermons</div>
    </div>`;

  // ---- classification split
  html += `
    <p class="sec-heading">Expository, mixed, or topical</p>
    <p class="chart-note">A sermon counts as <b>expository</b> when it belongs to a series
    walking through one book, or when its citations stay concentrated in its main chapter;
    <b>topical</b> when they scatter. ${(o.n - o.classified).toLocaleString()} recordings —
    testimonies, VBS weeks, performances, silent transcripts — cite too little Scripture
    to classify.</p>
    ${stackBar(CLS.map(([k, c]) => [k, o[k], c]), "All classified sermons")}
    <p class="leg-row">${CLS.map(([k, c, hint]) =>
      `<span class="leg" title="${hint}"><i style="background:${c}"></i>${k} · ${o[k]}</span>`).join("")}</p>`;

  // ---- by year
  const years = Object.entries(A.years).filter(([y, v]) =>
    +y >= 2015 && (v.expository + v.mixed + v.topical) >= 10);
  html += `<p class="sec-heading">Year by year</p>`;
  for (const [y, v] of years) {
    const cn = v.expository + v.mixed + v.topical;
    html += `
      <div class="yr-row">
        <span class="yr">${y}</span>
        ${stackBar(CLS.map(([k, c]) => [k, v[k], c]), y)}
        <span class="yr-n">${cn}</span>
      </div>`;
  }
  html += `
    <details class="data-table"><summary>the numbers</summary>
      <table><tr><th>year</th><th>expository</th><th>mixed</th><th>topical</th>
      <th>unclassified</th><th>Scripture read</th></tr>
      ${years.map(([y, v]) => `<tr><td>${y}</td><td>${v.expository}</td><td>${v.mixed}</td>
        <td>${v.topical}</td><td>${v.unclassified}</td><td>${pct(v.read)}</td></tr>`).join("")}
      </table></details>`;

  // ---- reading share by year
  html += `
    <p class="sec-heading">Scripture read aloud</p>
    <p class="chart-note">The share of the average sermon that matches the Bible text
    nearly verbatim — the passage read at the start, and every quotation along the way.</p>`;
  const readMax = 0.3;
  for (const [y, v] of years) {
    html += `
      <div class="yr-row">
        <span class="yr">${y}</span>
        <div class="hbar-track"><i class="hbar" style="width:${Math.min(100, v.read / readMax * 100)}%"></i></div>
        <span class="yr-n">${pct(v.read)}</span>
      </div>`;
  }

  // ---- voices
  const voices = A.people.slice(0, 18);
  const vMax = voices[0][1];
  html += `
    <p class="sec-heading">The voices in the room</p>
    <p class="chart-note">Preachers quote their library. Mentions of well-known theologians,
    authors, and figures of church history across all ${o.n.toLocaleString()} transcripts —
    click any sermon's "voices quoted" times to hear the mention itself.</p>`;
  for (const [name, mentions, inSermons] of voices) {
    html += `
      <div class="voice-row" title="${esc(name)}: ${mentions} mentions across ${inSermons} sermons">
        <span class="voice-name">${esc(name)}</span>
        <div class="hbar-track"><i class="hbar" style="width:${mentions / vMax * 100}%"></i></div>
        <span class="yr-n">${mentions} · ${inSermons} sermon${inSermons > 1 ? "s" : ""}</span>
      </div>`;
  }

  html += `
    <p class="method-note">Method: classification watches where a sermon's Scripture
    references cluster — fully-qualified references plus bare "verse five" mentions
    attributed to the chapter the preacher is in — and marks series walking through a book
    (≥ ${pct(A.thresholds.expository)} concentration = expository, &lt; ${pct(A.thresholds.topical)} = topical).
    Reading share matches transcript 3-word shingles against the Berean Standard Bible, so
    readings from other translations register slightly low. Voices come from a curated list
    of ~90 names; whisper mishears some. All of it is honest arithmetic, none of it is a
    verdict — <a href="#">the archive</a> is the point.</p>`;

  main.innerHTML = html;
  window.scrollTo({ top: 0 });
}

/* ---------- routing ---------- */

function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return drawHome();
  if (h === "analytics" && ANALYTICS) return drawAnalytics();
  if (h.startsWith("s:") && byId.has(h.slice(2))) return drawSermon(h.slice(2));
  if (byChapter.has(h)) return drawChapter(h);
  drawHome();
}

window.addEventListener("hashchange", route);
load();
