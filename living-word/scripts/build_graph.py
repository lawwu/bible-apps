#!/usr/bin/env python3
"""Build chapter-level knowledge-graph JSON from the TSK cross-reference file.

Reads tsk/tskxref.txt (tab-delimited: book_key, chapter, verse, sort_order,
word, reference_list) and emits:

  data/graph.json    - nodes (chapters) + links (aggregated cross-refs)
  data/details.json  - per-chapter detail: top verses, top connections
"""

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# TSK source lives at the bible-apps repo root, shared with the other apps
TSK = ROOT.parent / "tsk" / "tskxref.txt"
OUT = ROOT / "data"

BOOKS = [
    # (name, abbrev, section, chapters)
    ("Genesis", "ge", "Law", 50), ("Exodus", "ex", "Law", 40),
    ("Leviticus", "le", "Law", 27), ("Numbers", "nu", "Law", 36),
    ("Deuteronomy", "de", "Law", 34),
    ("Joshua", "jos", "History", 24), ("Judges", "jud", "History", 21),
    ("Ruth", "ru", "History", 4), ("1 Samuel", "1sa", "History", 31),
    ("2 Samuel", "2sa", "History", 24), ("1 Kings", "1ki", "History", 22),
    ("2 Kings", "2ki", "History", 25), ("1 Chronicles", "1ch", "History", 29),
    ("2 Chronicles", "2ch", "History", 36), ("Ezra", "ezr", "History", 10),
    ("Nehemiah", "ne", "History", 13), ("Esther", "es", "History", 10),
    ("Job", "job", "Wisdom", 42), ("Psalms", "ps", "Wisdom", 150),
    ("Proverbs", "pr", "Wisdom", 31), ("Ecclesiastes", "ec", "Wisdom", 12),
    ("Song of Solomon", "so", "Wisdom", 8),
    ("Isaiah", "isa", "Major Prophets", 66), ("Jeremiah", "jer", "Major Prophets", 52),
    ("Lamentations", "la", "Major Prophets", 5), ("Ezekiel", "eze", "Major Prophets", 48),
    ("Daniel", "da", "Major Prophets", 12),
    ("Hosea", "ho", "Minor Prophets", 14), ("Joel", "joe", "Minor Prophets", 3),
    ("Amos", "am", "Minor Prophets", 9), ("Obadiah", "ob", "Minor Prophets", 1),
    ("Jonah", "jon", "Minor Prophets", 4), ("Micah", "mic", "Minor Prophets", 7),
    ("Nahum", "na", "Minor Prophets", 3), ("Habakkuk", "hab", "Minor Prophets", 3),
    ("Zephaniah", "zep", "Minor Prophets", 3), ("Haggai", "hag", "Minor Prophets", 2),
    ("Zechariah", "zec", "Minor Prophets", 14), ("Malachi", "mal", "Minor Prophets", 4),
    ("Matthew", "mt", "Gospels & Acts", 28), ("Mark", "mr", "Gospels & Acts", 16),
    ("Luke", "lu", "Gospels & Acts", 24), ("John", "joh", "Gospels & Acts", 21),
    ("Acts", "ac", "Gospels & Acts", 28),
    ("Romans", "ro", "Pauline Epistles", 16), ("1 Corinthians", "1co", "Pauline Epistles", 16),
    ("2 Corinthians", "2co", "Pauline Epistles", 13), ("Galatians", "ga", "Pauline Epistles", 6),
    ("Ephesians", "eph", "Pauline Epistles", 6), ("Philippians", "php", "Pauline Epistles", 4),
    ("Colossians", "col", "Pauline Epistles", 4), ("1 Thessalonians", "1th", "Pauline Epistles", 5),
    ("2 Thessalonians", "2th", "Pauline Epistles", 3), ("1 Timothy", "1ti", "Pauline Epistles", 6),
    ("2 Timothy", "2ti", "Pauline Epistles", 4), ("Titus", "tit", "Pauline Epistles", 3),
    ("Philemon", "phm", "Pauline Epistles", 1),
    ("Hebrews", "heb", "General Epistles", 13), ("James", "jas", "General Epistles", 5),
    ("1 Peter", "1pe", "General Epistles", 5), ("2 Peter", "2pe", "General Epistles", 3),
    ("1 John", "1jo", "General Epistles", 5), ("2 John", "2jo", "General Epistles", 1),
    ("3 John", "3jo", "General Epistles", 1), ("Jude", "jude", "General Epistles", 1),
    ("Revelation", "re", "Revelation", 22),
]

ABBREV_TO_KEY = {b[1]: i + 1 for i, b in enumerate(BOOKS)}
KEY_TO_NAME = {i + 1: b[0] for i, b in enumerate(BOOKS)}
KEY_TO_SECTION = {i + 1: b[2] for i, b in enumerate(BOOKS)}

REF_RE = re.compile(r"^([0-9]?[a-z]+)\s+(\d+):(\d+(?:[-,][\d:,-]*\d)?)$")
UNDERSCORE_RE = re.compile(r"^([0-9]?[A-Za-z]+)(\d+)_(\d+)$")


def parse_ref_group(raw):
    """Parse one semicolon-delimited ref like 'ps 33:6,9' or 'pr 8:22-24'.

    Returns list of (book_key, chapter, verse) for individual verses.
    Ranges are expanded within a chapter; cross-chapter ranges keep endpoints.
    """
    raw = raw.strip().lower().replace(" ,", ",").replace(", ", ",")
    m = UNDERSCORE_RE.match(raw)
    if m:
        raw = f"{m.group(1).lower()} {m.group(2)}:{m.group(3)}"
    m = REF_RE.match(raw)
    if not m:
        return []
    abbr, chap, verse_part = m.group(1), int(m.group(2)), m.group(3)
    book = ABBREV_TO_KEY.get(abbr)
    if book is None:
        return []
    verses = []
    for piece in verse_part.split(","):
        if not piece:
            continue
        if "-" in piece:
            lo, hi = piece.split("-", 1)
            if ":" in hi:  # cross-chapter range e.g. 1:1-2:3 -> keep endpoints
                hi_ch, hi_v = hi.split(":", 1)
                try:
                    verses.append((book, chap, int(lo)))
                    verses.append((book, int(hi_ch), int(hi_v)))
                except ValueError:
                    pass
                continue
            try:
                lo_i, hi_i = int(lo), int(hi)
            except ValueError:
                continue
            if hi_i - lo_i > 30:
                hi_i = lo_i + 30
            verses.extend((book, chap, v) for v in range(lo_i, hi_i + 1))
        else:
            try:
                verses.append((book, chap, int(piece)))
            except ValueError:
                continue
    return verses


VALID_CHAPTERS = {
    f"{i + 1}:{c}"
    for i, b in enumerate(BOOKS)
    for c in range(1, b[3] + 1)
}


def main():
    edge_weight = Counter()          # (src_chap_id, dst_chap_id) -> count
    verse_inbound = Counter()        # (book, chap, verse) -> times referenced
    verse_outbound = Counter()       # (book, chap, verse) -> refs it makes
    chapter_entries = Counter()      # chap_id -> tsk entry count
    skipped = 0

    with open(TSK, encoding="utf-8", errors="replace") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 6:
                continue
            try:
                book, chap, verse = int(parts[0]), int(parts[1]), int(parts[2])
            except ValueError:
                continue
            if book > 66:
                continue
            src_chap = f"{book}:{chap}"
            if src_chap not in VALID_CHAPTERS:
                skipped += 1
                continue
            chapter_entries[src_chap] += 1
            for group in parts[5].split(";"):
                targets = parse_ref_group(group)
                if not targets:
                    if group.strip():
                        skipped += 1
                    continue
                seen_chaps = set()
                for tb, tc, tv in targets:
                    dst_chap = f"{tb}:{tc}"
                    if dst_chap not in VALID_CHAPTERS:
                        skipped += 1
                        continue
                    verse_inbound[(tb, tc, tv)] += 1
                    if dst_chap not in seen_chaps:
                        seen_chaps.add(dst_chap)
                        if dst_chap != src_chap:
                            edge_weight[(src_chap, dst_chap)] += 1
                verse_outbound[(book, chap, verse)] += len(targets)

    # Merge directed edges into undirected weights
    undirected = Counter()
    for (a, b), w in edge_weight.items():
        key = (a, b) if a <= b else (b, a)
        undirected[key] += w

    # Node strength = sum of all undirected edge weights touching the chapter
    strength = Counter()
    for (a, b), w in undirected.items():
        strength[a] += w
        strength[b] += w

    # Keep the graph readable: an edge survives if it is strong globally OR
    # among the top-K strongest for either endpoint.
    TOP_K = 4
    GLOBAL_MIN = 25
    per_node = defaultdict(list)
    for (a, b), w in undirected.items():
        per_node[a].append((w, b))
        per_node[b].append((w, a))
    keep = set()
    for node, lst in per_node.items():
        lst.sort(reverse=True)
        for w, other in lst[:TOP_K]:
            key = (node, other) if node <= other else (other, node)
            keep.add(key)
    links = []
    for (a, b), w in undirected.items():
        if w >= GLOBAL_MIN or (a, b) in keep:
            links.append({"source": a, "target": b, "w": w})

    nodes = []
    for i, (name, abbr, section, nchap) in enumerate(BOOKS):
        book_key = i + 1
        for c in range(1, nchap + 1):
            cid = f"{book_key}:{c}"
            nodes.append({
                "id": cid,
                "label": f"{name} {c}",
                "book": name,
                "section": section,
                "strength": strength.get(cid, 0),
            })

    graph = {
        "meta": {
            "entries": sum(chapter_entries.values()),
            "totalRefs": sum(verse_inbound.values()),
            "links": len(links),
        },
        "nodes": nodes,
        "links": links,
    }

    # Per-chapter details
    verses_by_chapter = defaultdict(Counter)
    for (b, c, v), n in verse_inbound.items():
        verses_by_chapter[f"{b}:{c}"][v] += n

    conn_by_chapter = defaultdict(list)
    for (a, b), w in undirected.items():
        conn_by_chapter[a].append((w, b))
        conn_by_chapter[b].append((w, a))

    details = {}
    for node in nodes:
        cid = node["id"]
        top_verses = verses_by_chapter[cid].most_common(8)
        conns = sorted(conn_by_chapter[cid], reverse=True)[:12]
        details[cid] = {
            "verses": [[v, n] for v, n in top_verses],
            "conn": [[c, w] for w, c in conns],
        }

    OUT.mkdir(exist_ok=True)
    with open(OUT / "graph.json", "w") as f:
        json.dump(graph, f, separators=(",", ":"))
    with open(OUT / "details.json", "w") as f:
        json.dump(details, f, separators=(",", ":"))

    total_w = sum(l["w"] for l in links)
    print(f"nodes: {len(nodes)}  links kept: {len(links)} / {len(undirected)}")
    print(f"total cross-refs in kept links: {total_w}")
    print(f"skipped unparseable groups: {skipped}")
    print(f"graph.json: {(OUT / 'graph.json').stat().st_size // 1024} KB")
    print(f"details.json: {(OUT / 'details.json').stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
