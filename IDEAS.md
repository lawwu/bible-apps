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

## Understanding-the-Bible shortlist (2026-07)

Ideas aimed squarely at helping someone understand the text itself, ranked by
how much they compound on data and engines already in this repo.

### 4. Word-study explorer — the BSB at the lemma level
Click any word in any verse → the Hebrew/Greek word behind it, its gloss, and
every other verse where that lemma occurs. The Berean tables (public domain,
same source as `bsb.txt`) map every BSB word to its source word and Strong's
number; STEPBible's TAHOT/TAGNT data (CC-BY) adds morphology. The single
highest-density understanding tool on this list — *hesed*, *agapao* vs
*phileo*, *kosmos* vs *aion* — and it slots straight into verse-explorer's
existing word-index UX. The embedding tooling (`build_related.py`) could add
"semantically nearby lemmas" nearly for free.

### 5. The OT in the NT — quotation explorer
The NT quotes the OT ~350 times outright and alludes constantly. A side-by-side
viewer: NT verse, its OT source, and where the wording differs (the diff
engine from `translations/` reused verse-against-verse instead of
translation-against-translation) — including why a quote doesn't match your
OT (Septuagint vs Hebrew). Candidate pairs fall out of `cross_references.txt`:
the heaviest-voted OT→NT edges plus n-gram overlap detection in the BSB;
public-domain quotation lists cross-check it. This is how the apostles read
their Bibles — the spine of biblical theology, and nobody presents it well.

### 6. Per-verse commentary reader — five centuries at every verse
TSK is already in the repo; Matthew Henry, Calvin, Gill, JFB, Barnes, and
Spurgeon's Treasury of David are all public domain and available in
machine-readable dumps. Click any verse → what the commentators said, in one
column, static JSON per chapter. Adjacent to the Gutenberg-RAG idea below but
deterministic — no LLM, no hosting, just a data join. The closest a static
site can get to handing someone a study Bible. Main work is normalizing the
commentary sources' verse addressing.

### 7. Bible atlas — where it happened
OpenBible.info publishes geocoded coordinates for the Bible's ~1,300
identifiable places (CC-BY, same source family as the cross-references), and
Theographic (already in-repo) links places to verses. Leaflet experience
exists from `church-map/`. The distinctive feature: animated narrative
journeys — Abraham's migration, the Exodus, David's flight from Saul, Paul's
four journeys — each leg linked to the chapter narrating it. "Where is this
happening?" is one of the most common comprehension gaps in Bible reading.

### 8. Four witnesses — Gospel harmony / parallel-passage viewer
Pericope-aligned side-by-side Gospels with differences highlighted — the
`translations/` diff engine again, this time across authors rather than
translations. A. T. Robertson's 1922 harmony is public domain for the
alignment; embeddings (already in the toolchain) can compute candidate
alignments too. Same engine then covers Kings↔Chronicles, Samuel↔Psalms
superscriptions, Isaiah 36–39↔2 Kings 18–20. Seeing what each Evangelist
adds, omits, and emphasizes is a whole seminary course in one page.

### 9. From Eden to Patmos — the whole-Bible timeline
The `kings-timeline/` engine generalized to the full canon: patriarchs,
exodus, judges, united kingdom, the existing divided-kingdom span, exile,
return, the silent centuries, the life of Christ, the apostolic age — with
each book's writing and setting placed on it. Answers the questions readers
actually have: where do Job, Joel, and Obadiah fit? Theographic's events and
periods data helps; the ESV Global Study Bible charts pattern is already
established in-repo.

### 10. The line of promise — genealogy tree, Adam to Jesus
The denomination/translation tree engine fed with Theographic's
person-relationship data (already used by verse-explorer's People index):
click Boaz and light his whole lineage; render Matthew's and Luke's
genealogies of Jesus as diverging-and-reconverging paths; link each king to
his reign in the kings timeline. The engine exists, the data exists — this is
mostly a build script.

### 11. Red letters, every color — who said it?
Attribute every quotation in Scripture to its speaker: God in the first
person, Jesus, angels, Satan, prophets, fools. One-time LLM batch pass over
the BSB (its quotation punctuation does half the work), verified by spot
checks, emitted as static JSON — the established `preached/` pattern. Unlocks
views nobody has: every question Jesus asked (~300), every prayer in the
Bible, everything God says about Himself.

### Smaller cuts
- **Six degrees of Scripture** — shortest cross-reference path between any two
  verses; a verse-explorer feature, not a new app.
- **Memory trainer** — spaced repetition (SM-2 in localStorage) over verse
  packs seeded from the topical-votes data; first-letters recall mode. The
  repo's first daily-habit app; zero new data.
- **The shape of the Psalms** — all 150 classified by genre (lament, praise,
  thanksgiving, royal…) and emotional arc; "find a psalm for today"; the
  Psalter's drift from lament-heavy Book I to praise-heavy Book V, visualized.
- **Manuscript-variant deep dive** — expand the absent-verses annotations in
  `translations/` into a layman's tour of the ~40 most significant variants.
- **Book one-pagers** — author, date, audience, structure, key verses for all
  66 books; the "book intro" every app can deep-link to.
- **By the numbers** — tf-idf fingerprint words per book, question counts,
  names-of-God frequency; a stats dashboard over `bsb.txt`.

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
