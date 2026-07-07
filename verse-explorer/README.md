# Every Word Entwined

An interactive Bible cross-reference neighborhood explorer. Center on any verse,
see its cross-references as a force-directed graph weighted by reader votes, and
click any node or list entry to travel there — walking the ~340,000 threads that
connect Scripture to itself.

## Run

```sh
python3 -m http.server 8742
# from the repo root — the explorer is at http://localhost:8742/verse-explorer/
# then open http://localhost:8742
```

It is a fully static site — any static host (GitHub Pages, Netlify, etc.) works.

## Rebuild the data

`data/verses.json`, `data/edges.json`, and `data/anchors.json` are generated
from `../cross_references.txt` (OpenBible.info export), `../tsk/tskxref.txt`
(Treasury of Scripture Knowledge, cp1252-encoded),
`../openbible-topical-verses/topic-votes.txt` (Topical Bible export, verse ids
in bbcccvvv form), and a KJV JSON dump:

```sh
curl -sL -o /tmp/kjv.json https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/KJV.json
python3 scripts/build_data.py /tmp/kjv.json
uv run --with sentence-transformers --with "numpy<2" python3 scripts/build_related.py
```

Edges with negative votes are dropped; TSK reference pairs missing from the
OpenBible set are added with votes=0 ("unvoted", hidden until the threshold
slider reaches 0). Verse ranges (e.g. `Col.1.16-Col.1.17`) collapse to their
first verse for graph identity; the extra-verse span is kept so the UI can
show the full range text.

## Features

- **Neighborhood graph** — center verse pinned, neighbors sized/pulled closer by
  votes; faint links between neighbors reveal tight clusters. Nodes colored by
  canon section; crimson edges cross between the Testaments.
- **Travel** — click any node or connection card to re-center; a breadcrumb
  trail tracks the walk. URL hash (`#Isa.53.5`) makes any view shareable.
- **Vote threshold slider** — from "only the strongest attested connections" to
  "every faint thread" (0 also reveals TSK-only unvoted references).
- **Anchor phrases** — each verse's TSK anchors are underlined in the text
  (96% match verbatim; the rest render as chips). Click one to dim the graph
  and connection list to just that phrase's references. Hovering a graph node
  shows which phrase it hangs on. Shared significant words are still
  ochre-highlighted inside connection cards.
- **Word index** — the "Words" button (or typing a word into search) opens the
  anchor-word index: click a word like "blessed" to see a star graph and list
  of every verse that hangs cross-references on that phrase, then dive in.
- **Topic index** — the "Topics" button opens openbible.info's Topical Bible:
  all 6,751 topics ("forgiveness", "anxiety"...) whose passages were ranked by
  reader votes, most-voted first with a type-to-filter box. Each topic page
  shows its top passages by votes; click one to enter its cross-reference
  neighborhood. Search accepts topics too. The word index likewise lists every
  anchor phrase recurring in 3+ verses.
- **Related topics by meaning** — every topic page shows its nearest topics
  in embedding space (all-MiniLM-L6-v2 over topic names, precomputed into
  `data/related.json` by `scripts/build_related.py`), so "anxiety" links to
  "worry and stress", "nervousness", and "panic attacks" even with no words
  in common. Search falls back to stem matching, so "anxiousness" lands on
  "anxiety".

- **People** — the "People" button indexes 3,067 people from the Theographic
  Bible Metadata; person pages list every verse they appear in, and verse pages
  show "People here" chips. Search finds people by name (`build_people.py`).
- **Preached at Berean** — verse pages list sermons from Berean Community
  Church that read or cite the verse, deep-linked to the moment in the video
  (built by `../preached/scripts/build_sermons.py`).

## Data credits

- Cross references and votes: [openbible.info](https://www.openbible.info/labs/cross-references/),
  CC-BY, descended from the Treasury of Scripture Knowledge.
- Topics: [openbible.info Topical Bible](https://www.openbible.info/topics/),
  CC-BY; each topic's passages capped at the top 40 by votes.
- Anchor phrases: Treasury of Scripture Knowledge (public domain),
  tab-delimited developer export (`tsk/tskxref.txt`).
- People: [Theographic Bible Metadata](https://github.com/robertrouse/theographic-bible-metadata), CC BY-SA 4.0.
- Sermons: [Berean Community Church](https://bereancc.com/), transcripts via the berean_transcripts pipeline.
- Text: King James Version via
  [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases).
