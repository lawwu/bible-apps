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
let byChapter = new Map();   // "Gal.3" -> [{s: sermonIdx, ts, fromTitle}]
let byId = new Map();

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
  DATA = await fetch("data/sermons.json").then((r) => r.json());
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
    honest too — every pulpit has them.</p>`;

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

/* ---------- routing ---------- */

function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return drawHome();
  if (h.startsWith("s:") && byId.has(h.slice(2))) return drawSermon(h.slice(2));
  if (byChapter.has(h)) return drawChapter(h);
  drawHome();
}

window.addEventListener("hashchange", route);
load();
