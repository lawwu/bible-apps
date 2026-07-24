# Bible apps

Small explorations in the data of Scripture — its cross-references, topics,
kings, and prophets.

**Live: https://lawwu.github.io/bible-apps/**

Made with [Open Bible](https://www.openbible.info/) data and Claude Fable 5 (High).

## The apps

- **[Every Word Entwined](verse-explorer/)** (`verse-explorer/`) — wander the
  ~340,000 cross-reference threads that bind Scripture to itself, starting
  from a topic, an anchor word, or any verse. See its
  [README](verse-explorer/README.md) for features and the data pipeline.
- **[Preached](preached/)** (`preached/`) — a sermon archive shaped like the
  Bible: 1,330 Berean Community Church sermons mapped to the chapters they
  read and cite, with timestamp links to the exact moment. Built from the
  berean_transcripts repo by `preached/scripts/build_sermons.py`. Includes
  pulpit analytics (`preached/#analytics`, built by
  `preached/scripts/build_analytics.py`): expository/mixed/topical
  classification, the share of each sermon that is Scripture read aloud,
  and which theologians get quoted — per sermon and rolled up by year.
- **[The Living Word](living-word/)** (`living-word/`) — a 3D knowledge graph
  of Scripture: all 1,189 chapters as glowing nodes, ~590,000 TSK
  cross-references distilled into ~3,500 chapter-level threads, with
  systematic-theology doctrines, people of the Bible, and top OpenBible
  topics as overlays, plus a built-in KJV reader that highlights each
  chapter's most cross-referenced verses. See its
  [README](living-word/README.md) for the data pipeline.
- **[In Other Words](translations/)** (`translations/`) — five public-domain
  translations (KJV, YLT, ASV, WEB, BSB) compared verse by verse: a
  similarity matrix, the ~250 verses where wording diverges most, the verses
  absent from critical-text Bibles (annotated with their manuscript story),
  and per-book divergence. Built by `translations/scripts/build_diff.py`,
  which downloads sources into the gitignored `translations/sources/`.
- **[A Church Nearby](church-map/)** (`church-map/`) — the 9Marks church
  search and The Master's Seminary church finder combined on one Leaflet
  map: ~7,500 churches in 67 countries, cross-matched where a church appears
  in both, plus the U.S. metros farthest from any listed church. Built by
  `church-map/scripts/build_churches.py` (sources gitignored under
  `church-map/sources/`). A church-profile scraper
  (`church-map/scraper/scrape.py`, design in
  [SCRAPER-DESIGN.md](church-map/SCRAPER-DESIGN.md)) politely probes each
  church's website and extracts sourced, quote-backed metadata into
  `church-map/data/profiles.jsonl`.
- **[The Line of Kings](kings-timeline/)** (`kings-timeline/`) — an
  interactive timeline of Israel and Judah, 1050–560 BC: kings color-coded by
  their verdict in Scripture, the prophets who confronted them, the books
  being written, and every reign linked into the cross-reference explorer.
  Dates follow the ESV Global Study Bible charts.
- **[The Denomination Tree](denomination-tree/)** (`denomination-tree/`) — a
  family tree of Christian denominations, AD 33 to today: the Great Schism,
  the four Reformation streams, the awakenings, Azusa Street, the mainline
  mergers and the newest splits — every branch clickable to light its whole
  lineage. Same engine as the Translation Tree.
- **[The Translation Tree](translation-tree/)** (`translation-tree/`) — a
  family tree of the English Bible, 1382–2025: Wycliffe and Tyndale down
  through the KJV to the ESV, NASB, LSB, NIV and the rest, color-coded by
  textual stream (Vulgate, Textus Receptus, or critical Greek text). Click
  any Bible to light up its whole lineage, ancestors and heirs alike.
- **[Theological Triage](theological-triage/)** (`theological-triage/`) — Al
  Mohler's four-level sorting of doctrine, demonstrated as an emergency ward:
  the four priority tags (with Marc Minter's fourth level for matters of
  conscience), Joe Rigney's three weighing questions, an interactive sorting
  room with twelve cases to triage yourself, and the four classic failure
  modes — fundamentalist, liberal, Procrustean, and legalist.

## Run locally

```sh
python3 -m http.server 8742
# then open http://localhost:8742
```

The site is fully static; the landing page is `index.html` at the repo root.
Every page includes the shared navigation bar (`shared/nav.js`), which stitches
the apps into one site — it injects its own styles and publishes its height as
the `--appnav-h` CSS variable so apps with fixed overlays (The Living Word) can
offset around it. Deploys to GitHub Pages via `.github/workflows/pages.yml` on
any push touching the apps.

## Source data

- [`cross_references.txt`](cross_references.txt) — OpenBible.info
  cross-reference votes ([CC-BY](https://www.openbible.info/labs/cross-references/))
- [`tsk/`](tsk/) — Treasury of Scripture Knowledge phrase anchors (public domain)
- [`bsb.txt`](bsb.txt) — Berean Standard Bible text ([public domain](https://berean.bible/licensing.htm), berean.bible)
- [`openbible-topical-verses/`](openbible-topical-verses/) — OpenBible.info
  Topical Bible votes ([CC-BY](https://www.openbible.info/topics/))
