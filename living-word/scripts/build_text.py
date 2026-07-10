#!/usr/bin/env python3
"""Split the shared KJV verses.json into per-book chapter text files.

Reads ../verse-explorer/data/verses.json (ids: ["Gen.1.1", ...], texts: [...])
and writes data/text/{bookKey}.json as {"<chapter>": ["<v1 text>", ...], ...}
so the app fetches only the book it is reading (~70 KB average).
"""

import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent / "verse-explorer" / "data" / "verses.json"
OUT = ROOT / "data" / "text"

OSIS = [
    "Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth", "1Sam",
    "2Sam", "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra", "Neh", "Esth", "Job",
    "Ps", "Prov", "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek", "Dan", "Hos",
    "Joel", "Amos", "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag",
    "Zech", "Mal", "Matt", "Mark", "Luke", "John", "Acts", "Rom", "1Cor",
    "2Cor", "Gal", "Eph", "Phil", "Col", "1Thess", "2Thess", "1Tim", "2Tim",
    "Titus", "Phlm", "Heb", "Jas", "1Pet", "2Pet", "1John", "2John", "3John",
    "Jude", "Rev",
]
BOOK_KEY = {code: i + 1 for i, code in enumerate(OSIS)}


def main():
    src = json.loads(SRC.read_text())
    ids, texts = src["ids"], src["texts"]

    books = defaultdict(lambda: defaultdict(dict))  # key -> chapter -> verse -> text
    for vid, text in zip(ids, texts):
        code, chap, verse = vid.rsplit(".", 2)
        books[BOOK_KEY[code]][int(chap)][int(verse)] = text

    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for key, chapters in books.items():
        out = {
            str(c): [vv[n] for n in sorted(vv)]
            for c, vv in sorted(chapters.items())
        }
        path = OUT / f"{key}.json"
        path.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
        total += path.stat().st_size
    print(f"{len(books)} books, {len(ids)} verses, {total // 1024} KB total")


if __name__ == "__main__":
    main()
