/* In Other Words — where Bible translations part ways.
   Data: translations/data/diff.json built by scripts/build_diff.py. */

const BOOK_NAME = new Map([
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
]);
const OT = new Set([...BOOK_NAME.keys()].slice(0, 39));

let D = null;
let filter = "all";
const main = document.getElementById("main");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const refLabel = (id) => {
  const [b, c, v] = id.split(".");
  return `${BOOK_NAME.get(b)} ${c}:${v}`;
};
const explorerLink = (id) => `../verse-explorer/#${id}`;

/* similarity 0.4–0.85 → gold tint depth (sequential, one hue) */
function simTint(v) {
  const t = Math.max(0, Math.min(1, (v - 0.35) / 0.5));
  return `background: rgba(169, 125, 28, ${(0.06 + t * 0.55).toFixed(2)})`;
}

function verseTexts(item) {
  const ids = D.meta.translations.map((t) => t.id);
  return `<div class="verse-texts">${item.texts.map((t, i) => `
    <div class="vt${t == null ? " absent" : ""}">
      <b>${ids[i]}</b>
      <span>${t == null ? "— not present —" : esc(t)}</span>
    </div>`).join("")}
    <div class="vt"><b></b><span><a href="${explorerLink(item.id)}">open in the explorer →</a></span></div>
  </div>`;
}

function render() {
  const T = D.meta.translations;
  const m = D.matrix;

  // closest / farthest pairs for the note
  let best = [0, 1], worst = [0, 1];
  for (let i = 0; i < T.length; i++) {
    for (let j = i + 1; j < T.length; j++) {
      if (m[i][j] > m[best[0]][best[1]]) best = [i, j];
      if (m[i][j] < m[worst[0]][worst[1]]) worst = [i, j];
    }
  }

  let html = `
    <p class="page-kicker">Translation comparison · ${D.meta.verses.toLocaleString()} verses</p>
    <h2 class="page-title">Where do translations part ways?</h2>
    <p class="page-note">Every English Bible is a chain of ten thousand judgment calls —
    which manuscripts to trust, and which words to spend. Here are five public-domain
    translations spanning 250 years, compared verse by verse: the verses where they
    disagree most, the verses that aren't in every Bible at all, and which translations
    are closest kin.</p>

    <div class="trans-row">${T.map((t) => `
      <div class="trans"><b>${t.id}</b>${esc(t.name)}<br><i>${t.year} · ${esc(t.basis)}</i></div>`).join("")}
    </div>

    <p class="sec-heading">How close are they?</p>
    <p class="chart-note">Average word overlap across all ${D.meta.verses.toLocaleString()}
    verses, after folding archaic English ("thou goeth" reads as "you go"). The deeper the
    gold, the closer the kin. Closest: <b>${T[best[0]].id} ↔ ${T[best[1]].id}</b>
    (${Math.round(m[best[0]][best[1]] * 100)}%) — kinship by descent: the ASV is a revision
    in the King James lineage, and the WEB in turn revises the ASV. Farthest apart:
    <b>${T[worst[0]].id} ↔ ${T[worst[1]].id}</b> (${Math.round(m[worst[0]][worst[1]] * 100)}%) —
    a hyper-literal Victorian rendering against the most idiomatic modern one.</p>
    <table class="matrix"><tr><th></th>${T.map((t) => `<th>${t.id}</th>`).join("")}</tr>
    ${T.map((t, i) => `<tr><th>${t.id}</th>${T.map((u, j) => i === j
      ? `<td class="self">—</td>`
      : `<td style="${simTint(m[i][j])}" title="${t.id} ↔ ${u.id}: ${(m[i][j] * 100).toFixed(1)}% average word overlap">${Math.round(m[i][j] * 100)}%</td>`).join("")}</tr>`).join("")}
    </table>

    <p class="sec-heading">The verses that aren't in every Bible</p>
    <p class="chart-note">Not style — manuscripts. These verses appear in the Textus
    Receptus behind the KJV but are absent from the earliest witnesses, so modern
    critical-text translations set them aside (usually to a footnote). A filled dot
    means the translation prints the verse.</p>
    <p class="dots-legend">${T.map((t) => `${t.id}<span class="dot yes"></span>`).join(" ")}</p>
    ${D.missing.map((item) => `
      <div class="verse-row" data-vid="${item.id}">
        <button class="verse-head miss-head" aria-expanded="false">
          <span class="verse-ref">${refLabel(item.id)}</span>
          <span class="dots">${item.have.map((h) =>
            `<span class="dot ${h ? "yes" : "no"}"></span>`).join("")}</span>
          <span class="verse-score">${item.note ? "✳" : ""}</span>
        </button>
        <div class="verse-detail" hidden>
          ${item.note ? `<p class="verse-note">${esc(item.note)}</p>` : ""}
          ${verseTexts(item)}
        </div>
      </div>`).join("")}

    <p class="sec-heading">The ${D.top.length} most different verses</p>
    <p class="chart-note">Ranked by how little wording the five translations share —
    mostly the canon's hardest Hebrew and Greek: Job's whirlwind, the proverbs'
    compression, prophets' rare words. Click a verse to read all five side by side.</p>
    <div class="filters" role="group" aria-label="Filter by testament">
      <button data-f="all" class="active">All</button>
      <button data-f="ot">Old Testament</button>
      <button data-f="nt">New Testament</button>
    </div>
    <div id="top-list"></div>

    <p class="sec-heading">Where the disagreement lives</p>
    <p class="chart-note">Average divergence by book. Poetry and prophecy scatter
    translators; genealogies and epistles hold them together.</p>
    <div id="book-list"></div>

    <p class="method-note">Method: texts are lowercased, stripped of punctuation, and
    archaic forms are folded (thee → you, goeth → goes) so 250 years of English drift
    doesn't drown the real differences. Divergence is the average pairwise bag-of-words
    distance. It measures wording, not meaning — two renderings can differ in every word
    and say the same thing. Where they can't, a ✳ marks a known manuscript variant.
    Built by <code>translations/scripts/build_diff.py</code>.</p>`;

  main.innerHTML = html;
  drawTop();
  drawBooks();

  main.querySelectorAll(".miss-head").forEach((btn) => {
    btn.addEventListener("click", () => toggle(btn));
  });
  main.querySelectorAll(".filters button").forEach((btn) => {
    btn.addEventListener("click", () => {
      filter = btn.dataset.f;
      main.querySelectorAll(".filters button").forEach((b) =>
        b.classList.toggle("active", b === btn));
      drawTop();
    });
  });
}

function toggle(btn) {
  const detail = btn.parentElement.querySelector(".verse-detail");
  const open = detail.hidden;
  detail.hidden = !open;
  btn.setAttribute("aria-expanded", String(open));
}

function drawTop() {
  const rows = D.top.filter((t) => {
    if (filter === "all") return true;
    const isOT = OT.has(t.id.split(".")[0]);
    return filter === "ot" ? isOT : !isOT;
  });
  const max = D.top[0].score;
  document.getElementById("top-list").innerHTML = rows.map((item, i) => `
    <div class="verse-row" data-vid="${item.id}">
      <button class="verse-head" aria-expanded="false">
        <span class="verse-rank">${i + 1}</span>
        <span class="verse-ref">${refLabel(item.id)}</span>
        <span class="score-track"><i class="score-bar" style="width:${(item.score / max * 100).toFixed(1)}%"></i></span>
        <span class="verse-score">${item.score.toFixed(2)}</span>
      </button>
      <div class="verse-detail" hidden>
        ${item.note ? `<p class="verse-note">${esc(item.note)}</p>` : ""}
        ${verseTexts(item)}
      </div>
    </div>`).join("");
  document.querySelectorAll("#top-list .verse-head").forEach((btn) => {
    btn.addEventListener("click", () => toggle(btn));
  });
}

function drawBooks() {
  const books = D.books.slice().sort((a, b) => b.score - a.score);
  const max = books[0].score;
  document.getElementById("book-list").innerHTML = books.map((b) => `
    <div class="book-row" title="${BOOK_NAME.get(b.osis)}: average divergence ${b.score.toFixed(3)}">
      <span class="book-name">${BOOK_NAME.get(b.osis)}</span>
      <span class="book-track"><i class="book-bar" style="width:${(b.score / max * 100).toFixed(1)}%"></i></span>
      <span class="book-val">${b.score.toFixed(2)}</span>
    </div>`).join("");
}

fetch("data/diff.json")
  .then((r) => r.json())
  .then((d) => { D = d; render(); })
  .catch(() => {
    main.innerHTML = `<p class="loading-note">Couldn't load the comparison data.</p>`;
  });
