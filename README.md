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
  berean_transcripts repo by `preached/scripts/build_sermons.py`.
- **[The Line of Kings](kings-timeline/)** (`kings-timeline/`) — an
  interactive timeline of Israel and Judah, 1050–560 BC: kings color-coded by
  their verdict in Scripture, the prophets who confronted them, the books
  being written, and every reign linked into the cross-reference explorer.
  Dates follow the ESV Global Study Bible charts.

## Run locally

```sh
python3 -m http.server 8742
# then open http://localhost:8742
```

The site is fully static; the landing page is `index.html` at the repo root.
Deploys to GitHub Pages via `.github/workflows/pages.yml` on any push touching
the apps.

## Source data

- [`cross_references.txt`](cross_references.txt) — OpenBible.info
  cross-reference votes ([CC-BY](https://www.openbible.info/labs/cross-references/))
- [`tsk/`](tsk/) — Treasury of Scripture Knowledge phrase anchors (public domain)
- [`openbible-topical-verses/`](openbible-topical-verses/) — OpenBible.info
  Topical Bible votes ([CC-BY](https://www.openbible.info/topics/))
