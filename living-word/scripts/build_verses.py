#!/usr/bin/env python3
"""Build per-chapter verse-level cross-reference files for expand-in-place.

For every chapter, writes data/verses/{book}-{chapter}.json:

  {
    "n":   <verse count in the chapter (BSB)>,
    "in":  {"<verse>": <times referenced anywhere in the TSK>, ...},
    "out": {"<verse>": [[book, chapter, verse], ...], ...}
  }

The app fetches one of these only when a chapter is unfolded into its verses,
so the full ~590k verse-level reference set never loads at once.
"""

import json
from collections import Counter, defaultdict
from pathlib import Path

from build_graph import TSK, VALID_CHAPTERS, parse_ref_group
from build_text import parse_bsb

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "verses"


def main():
    # verse counts per chapter from the BSB text
    counts = Counter()
    for book, chap, verse, _ in parse_bsb():
        counts[(book, chap)] = max(counts[(book, chap)], verse)

    inbound = Counter()                      # (b, c, v) -> times referenced
    outbound = defaultdict(dict)             # (b, c) -> verse -> [targets]

    with open(TSK, encoding="utf-8", errors="replace") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 6:
                continue
            try:
                book, chap, verse = int(parts[0]), int(parts[1]), int(parts[2])
            except ValueError:
                continue
            if f"{book}:{chap}" not in VALID_CHAPTERS:
                continue
            targets = outbound[(book, chap)].setdefault(verse, [])
            seen = set(map(tuple, targets))
            for group in parts[5].split(";"):
                for tb, tc, tv in parse_ref_group(group):
                    if f"{tb}:{tc}" not in VALID_CHAPTERS:
                        continue
                    inbound[(tb, tc, tv)] += 1
                    t = (tb, tc, tv)
                    if t not in seen and t != (book, chap, verse):
                        seen.add(t)
                        targets.append([tb, tc, tv])

    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for (book, chap), n in counts.items():
        data = {
            "n": n,
            "in": {
                str(v): inbound[(book, chap, v)]
                for v in range(1, n + 1)
                if inbound[(book, chap, v)]
            },
            "out": {
                str(v): t
                for v, t in sorted(outbound.get((book, chap), {}).items())
                if t
            },
        }
        path = OUT / f"{book}-{chap}.json"
        path.write_text(json.dumps(data, separators=(",", ":")))
        total += path.stat().st_size

    print(f"{len(counts)} chapters, {total // 1024} KB total, "
          f"avg {total // len(counts)} B/chapter")


if __name__ == "__main__":
    main()
