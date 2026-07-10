#!/usr/bin/env python3
"""Build the Topical Bible overlay from OpenBible topic votes.

Reads ../verse-explorer/data/topics.json (topic -> [[verseIdx, span, votes]])
and the shared KJV verses.json, keeps the top topics by peak votes, and writes
data/topics.json with each topic's top verses (with text) and the chapters
they live in.

Data: CC-BY openbible.info Topical Bible.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VE_DATA = ROOT.parent / "verse-explorer" / "data"
OUT = ROOT / "data" / "topics.json"

TOP_TOPICS = 150
VERSES_PER_TOPIC = 8
CHAPTER_LINKS_PER_TOPIC = 6

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
BOOK_NAME = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua",
    "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
    "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job",
    "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah",
    "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
    "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai",
    "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
    "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation",
]


def main():
    verses = json.loads((VE_DATA / "verses.json").read_text())
    ids, texts = verses["ids"], verses["texts"]
    topics = json.loads((VE_DATA / "topics.json").read_text())

    ranked = sorted(
        ((name, refs) for name, refs in topics.items() if refs),
        key=lambda kv: -max(r[2] for r in kv[1]),
    )[:TOP_TOPICS]

    out = []
    for name, refs in ranked:
        entries = []
        chapters = []
        for idx, span, votes in sorted(refs, key=lambda r: -r[2]):
            if len(entries) >= VERSES_PER_TOPIC:
                break
            if votes <= 0 or idx >= len(ids):
                continue
            code, chap, verse = ids[idx].rsplit(".", 2)
            book = BOOK_KEY[code]
            label = f"{BOOK_NAME[book - 1]} {chap}:{verse}"
            if span > 0:
                end_code, end_chap, end_verse = ids[min(idx + span, len(ids) - 1)].rsplit(".", 2)
                if end_code == code and end_chap == chap:
                    label += f"–{end_verse}"
            chapter_id = f"{book}:{chap}"
            entries.append([label, chapter_id, texts[idx], votes])
            if chapter_id not in chapters:
                chapters.append(chapter_id)
        if len(entries) < 3:
            continue
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        out.append({
            "id": f"ob:{slug}",
            "label": name,
            "refs": chapters[:CHAPTER_LINKS_PER_TOPIC],
            "verses": entries,
        })

    OUT.write_text(json.dumps({"topics": out}, separators=(",", ":"), ensure_ascii=False))
    print(f"{len(out)} topics, {OUT.stat().st_size // 1024} KB")
    print("sample:", [t["label"] for t in out[:10]])


if __name__ == "__main__":
    main()
