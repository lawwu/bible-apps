# The Living Word — a knowledge graph of Scripture

An interactive 3D knowledge graph of the Bible, in the spirit of
[Marble's curriculum map](https://withmarble.com/curriculum/). Every chapter of
the Bible is a glowing node; edges are cross-references from the Treasury of
Scripture Knowledge, distilled from ~590,000 verse-level references into ~3,500
strong chapter-to-chapter connections. Overlays add systematic-theology
doctrines, people of the Bible, and the most-voted OpenBible Topical Bible
topics as secondary node types, and a built-in reader shows every chapter in
the Berean Standard Bible with its most cross-referenced verses highlighted.

**Live: https://lawwu.github.io/bible-apps/living-word/**

## Run it locally

```sh
# from the bible-apps repo root
python3 -m http.server 8742
# open http://localhost:8742/living-word/
```

(Any static file server works. An internet connection is required at runtime —
three.js and 3d-force-graph load from esm.sh, fonts from Google Fonts.)

## Explore

- **Drag** to orbit, **scroll** to zoom, **right-drag** to pan
- **Click a node** to focus it: a chapter shows its most-referenced verses
  (with the BSB text), strongest connected chapters, and the doctrines,
  people, and topics it appears in; a doctrine or person shows its key
  passages; a topic shows its top-voted verses with text
- **Read this chapter** (or click any verse row) opens the reader: the full
  BSB chapter with its most cross-referenced verses highlighted and marked
  with their reference counts, plus previous/next navigation through the canon
- **Search** chapters, doctrines, people, and topics (top right)
- **Filter chips** (bottom left) toggle canon sections, Theology, People,
  and Topics

## Data

| File | Contents |
| --- | --- |
| `../tsk/tskxref.txt` | Source: Treasury of Scripture Knowledge cross-references (public domain, shared at the repo root), 63,682 entries |
| `data/graph.json` | 1,189 chapter nodes + thresholded chapter-level edges, built by the pipeline |
| `data/details.json` | Per-chapter detail: top inbound-referenced verses, top connections |
| `data/overlay.json` | Hand-curated: 32 systematic-theology doctrines and 43 Bible people with key passages |
| `data/topics.json` | Top 150 OpenBible Topical Bible topics (CC-BY openbible.info) with top-voted verses and BSB text |
| `../bsb.txt` | Berean Standard Bible, official tab-delimited download from bereanbible.com (public domain) |
| `data/text/{1..66}.json` | BSB text per book, fetched on demand by the reader |

### Pipeline

```sh
python3 scripts/build_graph.py    # TSK -> graph.json + details.json
python3 scripts/build_text.py    # bsb.txt -> data/text/{book}.json
python3 scripts/build_topics.py  # OpenBible topic votes -> data/topics.json
```

Parses the TSK file, expands verse lists/ranges, aggregates references to
chapter level, and keeps an edge if it is globally strong (≥25 references) or
among the top 4 strongest for either endpoint — keeping the graph readable at
Marble scale. Node size encodes total cross-reference strength; color encodes
canon section (Law, History, Wisdom, Prophets, Gospels, Epistles, Revelation).

## Stack

Vanilla ES modules, no build step: [3d-force-graph](https://github.com/vasturiano/3d-force-graph)
(three.js WebGL, d3-force-3d layout, UnrealBloom post-processing), loaded via
import map from esm.sh.
