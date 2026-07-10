#!/usr/bin/env python3
"""Split the Berean Standard Bible into per-book chapter text files.

Reads ../bsb.txt (official tab-delimited download from bereanbible.com,
public domain) and writes data/text/{bookKey}.json as
{"<chapter>": ["<v1 text>", ...], ...} so the app fetches only the book it
is reading (~70 KB average).
"""

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent / "bsb.txt"
OUT = ROOT / "data" / "text"

# BSB book names in canonical order; index + 1 = book key
BSB_BOOKS = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua",
    "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
    "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job",
    "Psalm", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah",
    "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
    "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai",
    "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
    "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation",
]
BOOK_KEY = {name: i + 1 for i, name in enumerate(BSB_BOOKS)}

REF_RE = re.compile(r"^(.+?) (\d+):(\d+)$")


def parse_bsb():
    """Yield (book_key, chapter, verse, text) from the official BSB file."""
    with open(SRC, encoding="utf-8-sig", newline="") as f:
        for line in f:
            parts = line.rstrip("\r\n").split("\t")
            if len(parts) != 2:
                continue
            m = REF_RE.match(parts[0])
            if not m or m.group(1) not in BOOK_KEY:
                continue
            yield BOOK_KEY[m.group(1)], int(m.group(2)), int(m.group(3)), parts[1]


def main():
    books = defaultdict(lambda: defaultdict(dict))  # key -> chapter -> verse -> text
    count = 0
    for book, chap, verse, text in parse_bsb():
        books[book][chap][verse] = text
        count += 1

    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for key, chapters in books.items():
        out = {}
        for c, vv in sorted(chapters.items()):
            # index by verse number so rare versification gaps don't shift verses
            arr = [""] * max(vv)
            for n, t in vv.items():
                arr[n - 1] = t
            out[str(c)] = arr
        path = OUT / f"{key}.json"
        path.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
        total += path.stat().st_size
    print(f"{len(books)} books, {count} verses, {total // 1024} KB total")


if __name__ == "__main__":
    main()
