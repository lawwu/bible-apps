# The Living Word — a knowledge graph of Scripture

An interactive 3D knowledge graph of the Bible, in the spirit of
[Marble's curriculum map](https://withmarble.com/curriculum/). Every chapter of
the Bible is a glowing node; edges are cross-references from the Treasury of
Scripture Knowledge, distilled from ~590,000 verse-level references into ~3,500
strong chapter-to-chapter connections. Curated overlays add systematic-theology
doctrines and people of the Bible as secondary node types.

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
- **Click a node** to focus it: a chapter shows its most-referenced verses,
  strongest connected chapters, and the doctrines/people it appears in;
  a doctrine or person shows its key passages
- **Search** chapters, doctrines, and people (top right)
- **Filter chips** (bottom left) toggle canon sections, Theology, and People

## Data

| File | Contents |
| --- | --- |
| `../tsk/tskxref.txt` | Source: Treasury of Scripture Knowledge cross-references (public domain, shared at the repo root), 63,682 entries |
| `data/graph.json` | 1,189 chapter nodes + thresholded chapter-level edges, built by the pipeline |
| `data/details.json` | Per-chapter detail: top inbound-referenced verses, top connections |
| `data/overlay.json` | Hand-curated: 32 systematic-theology doctrines and 43 Bible people with key passages |

### Pipeline

```sh
python3 scripts/build_graph.py
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
