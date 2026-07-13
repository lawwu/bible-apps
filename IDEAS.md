# Project ideas

Christian data/software project ideas, with notes on feasibility and what they
could build on. Ranked roughly by leverage — how much existing work in this
repo they compound on.

## Ranked shortlist

### 1. Sermon analytics suite ← v1 built (2026-07: `preached/#analytics`)
Three ideas that are really one project, built on the `preached/` pipeline
(1,330 Berean Community Church sermons, already transcribed and mapped to the
chapters they read and cite):

- **Classification** — expository, topical, or otherwise. Expository sermons
  cite one contiguous passage densely; topical ones scatter citations across
  the canon. Measurable from citation concentration/contiguity.
- **Basics** — percentage of the sermon spent reading Scripture (align
  transcript text against the Bible text), and who gets quoted (Spurgeon,
  Lewis, Keller… — informative about a pulpit's influences).
- **Rollups** — aggregate to church level: "this church is 78% expository and
  quotes Piper 40 times a year." Nobody publishes data like this.

### 2. Translation comparison ← v1 built (2026-07: `translations/`)
Use Bible APIs / local texts to compare translations verse-by-verse and rank
verses by divergence; aggregate to see which translations (NASB, ESV, …) are
most similar. We already have the BSB (`bsb.txt`); KJV/WEB/ASV are public
domain and need no API. Caution: NASB/ESV are copyrighted — compare via API,
but displaying full text at scale hits licensing terms. Start public-domain;
the KJV-vs-modern diffs are where the textual-basis differences live anyway.

### 3. TMS / 9Marks church map ← v1 built (2026-07: `church-map/`)
Scrape both church directories, publish the list and a map, and find areas
with no recommended church. Highest real-world usefulness; deliverable is a
Leaflet/MapLibre map on a static page, fitting this repo's pattern. Main work
is scraping hygiene and geocoding.

## The rest

- **Church statement-of-faith clustering** — folded into the church profile
  scraper design ([church-map/SCRAPER-DESIGN.md](church-map/SCRAPER-DESIGN.md)):
  the scraping problem is now bounded (we already have 7,500 church websites
  from the map), and clustering becomes the "confessional kinship" benchmark.
- **RAG / Q&A / embedding search over Christian books on Project Gutenberg**
  ([Books in Christianity, sorted by popularity](https://www.gutenberg.org/ebooks/bookshelf/417)) —
  buildable but well-trodden ground.
- **Sharing-the-gospel chatbot** — LLM app; needs hosting and careful design.
- **Breeze CHMS API wrapper** — easy; only matters if actively using Breeze.
- **Ministry Watch scraping + analytics** — doable; check ToS.
- **iPhone camera app: photo → vision LLM extracts verse references → ESV API
  returns text** (plus a text-input variant) — App Store friction; prototype
  as a mobile web page (camera → vision model → ESV API) first.
- **Sermon transcription with openai/whisper** — largely superseded: the
  berean_transcripts repo behind `preached/` already exists; whisper matters
  for expanding to other churches.
- ~~**Scraping OpenBible and surfacing that data**~~ — done: that's
  `verse-explorer/` and `living-word/`.
