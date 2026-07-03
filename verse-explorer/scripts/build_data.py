#!/usr/bin/env python3
"""Build compact JSON data files for the verse explorer.

Inputs:
  - cross_references.txt  (OpenBible.info, CC-BY: From Verse / To Verse / Votes)
  - kjv.json              (scrollmapper bible_databases KJV dump)
  - tsk/tskxref.txt       (Treasury of Scripture Knowledge, cp1252,
                           tab-delimited: book chapter verse order word refs)

Outputs (written to ../data/):
  - verses.json  { meta, ids: [osisId...], texts: [verseText...] }
  - edges.json   flat [srcIdx, dstIdx, votes, span] rows; span = extra verses
                 in the target range beyond the first (0 for single verses).
                 Votes come from OpenBible; TSK-only pairs get votes=0.
  - anchors.json { srcIdx: [[word, [target, ...]], ...] } in TSK sort order;
                 each target is either a verse index or [index, span]
  - topics.json  { topic: [[startIdx, span, votes], ...] } sorted by votes
                 descending, capped at the top 40 passages per topic

Verse ranges like Col.1.16-Col.1.17 are collapsed to their first verse for
graph identity; the span lets the client render the full range text.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CROSS_REFS = os.path.join(os.path.dirname(ROOT), "cross_references.txt")
TSK = os.path.join(os.path.dirname(ROOT), "tsk", "tskxref.txt")
TOPIC_VOTES = os.path.join(os.path.dirname(ROOT), "openbible-topical-verses",
                           "topic-votes.txt")
KJV = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "kjv.json")
OUT = os.path.join(ROOT, "data")

OSIS_ORDER = [
    "Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth", "1Sam",
    "2Sam", "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra", "Neh", "Esth", "Job",
    "Ps", "Prov", "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek", "Dan", "Hos",
    "Joel", "Amos", "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag",
    "Zech", "Mal", "Matt", "Mark", "Luke", "John", "Acts", "Rom", "1Cor",
    "2Cor", "Gal", "Eph", "Phil", "Col", "1Thess", "2Thess", "1Tim", "2Tim",
    "Titus", "Phlm", "Heb", "Jas", "1Pet", "2Pet", "1John", "2John", "3John",
    "Jude", "Rev",
]


def load_verses():
    with open(KJV) as f:
        kjv = json.load(f)
    ids, texts = [], []
    for osis, book in zip(OSIS_ORDER, kjv["books"]):
        for ch in book["chapters"]:
            for v in ch["verses"]:
                ids.append(f"{osis}.{ch['chapter']}.{v['verse']}")
                texts.append(v["text"].strip())
    return ids, texts


def first_verse(ref):
    return ref.split("-")[0]


def range_span(ref, index):
    """Number of verses in the range beyond the first, clamped to the text."""
    if "-" not in ref:
        return 0
    start, end = ref.split("-", 1)
    i, j = index.get(start), index.get(end)
    if i is None or j is None or j <= i:
        return 0
    return min(j - i, 20)


TSK_ABBREVS = [
    "ge", "ex", "le", "nu", "de", "jos", "jud", "ru", "1sa", "2sa", "1ki",
    "2ki", "1ch", "2ch", "ezr", "ne", "es", "job", "ps", "pr", "ec", "so",
    "isa", "jer", "la", "eze", "da", "ho", "joe", "am", "ob", "jon", "mic",
    "na", "hab", "zep", "hag", "zec", "mal", "mt", "mr", "lu", "joh", "ac",
    "ro", "1co", "2co", "ga", "eph", "php", "col", "1th", "2th", "1ti",
    "2ti", "tit", "phm", "heb", "jas", "1pe", "2pe", "1jo", "2jo", "3jo",
    "jude", "re",
]
TSK_TO_OSIS = dict(zip(TSK_ABBREVS, OSIS_ORDER))
REF_RE = re.compile(r"^([1-3]?[a-z]+)\s+(\d+):(.+)$")


def parse_tsk_refs(refs, index):
    """Yield (verseIdx, span) for a semicolon-delimited TSK reference list.

    Handles comma lists (ps 33:6,9) and in-chapter ranges (pr 8:22-30).
    """
    for group in refs.split(";"):
        m = REF_RE.match(group.strip())
        if not m:
            continue
        book = TSK_TO_OSIS.get(m.group(1))
        if not book:
            continue
        ch = m.group(2)
        for piece in m.group(3).split(","):
            rng = re.match(r"^(\d+)(?:-(\d+))?$", piece.strip())
            if not rng:
                continue
            start = int(rng.group(1))
            idx = index.get(f"{book}.{ch}.{start}")
            if idx is None:
                continue
            span = 0
            if rng.group(2):
                end = index.get(f"{book}.{ch}.{rng.group(2)}")
                if end is not None and end > idx:
                    span = min(end - idx, 20)
            yield idx, span


def load_tsk(index):
    """Return ({srcIdx: [[word, [target...]], ...]}, {(src, dst): span})."""
    anchors = {}
    pairs = {}
    with open(TSK, encoding="cp1252") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 6:
                continue
            b, c, v, _order, word, refs = parts[:6]
            src = index.get(f"{OSIS_ORDER[int(b) - 1]}.{c}.{v}")
            if src is None:
                continue
            targets = []
            seen = set()
            for t, span in parse_tsk_refs(refs, index):
                if t == src or t in seen:
                    continue
                seen.add(t)
                targets.append(t if span == 0 else [t, span])
                key = (src, t)
                if key not in pairs or span > pairs[key]:
                    pairs[key] = span
            if targets:
                anchors.setdefault(src, []).append([word.strip(), targets])
    return anchors, pairs


def verse_id_to_idx(vid, index):
    """Map an OpenBible bbcccvvv verse id to a verse index, or None."""
    if len(vid) != 8 or not vid.isdigit():
        return None
    book = int(vid[:2])
    if not 1 <= book <= 66:
        return None
    osis = f"{OSIS_ORDER[book - 1]}.{int(vid[2:5])}.{int(vid[5:8])}"
    return index.get(osis)


def load_topics(index, top_n=40, max_span=30):
    topics = {}
    skipped = 0
    with open(TOPIC_VOTES) as f:
        next(f)
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 4:
                continue
            topic, start_id, end_id, votes = parts[:4]
            start = verse_id_to_idx(start_id.strip(), index)
            if start is None:
                skipped += 1
                continue
            span = 0
            end = verse_id_to_idx(end_id.strip(), index) if end_id.strip() else None
            if end is not None and end > start:
                span = min(end - start, max_span)
            topics.setdefault(topic, []).append([start, span, int(votes)])
    for topic, rows in topics.items():
        rows.sort(key=lambda r: -r[2])
        del rows[top_n:]
    return topics, skipped


def main():
    ids, texts = load_verses()
    index = {vid: i for i, vid in enumerate(ids)}

    edges = {}
    skipped = 0
    with open(CROSS_REFS) as f:
        next(f)
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 3:
                continue
            src, dst, votes = first_verse(parts[0]), parts[1], int(parts[2])
            if votes < 0:
                skipped += 1
                continue
            dst_first = first_verse(dst)
            if src not in index or dst_first not in index:
                skipped += 1
                continue
            key = (index[src], index[dst_first])
            span = range_span(dst, index)
            prev = edges.get(key)
            if prev is None or votes > prev[0]:
                edges[key] = (votes, span)

    anchors, tsk_pairs = load_tsk(index)
    tsk_only = 0
    for (s, d), span in tsk_pairs.items():
        if (s, d) not in edges:
            edges[(s, d)] = (0, span)
            tsk_only += 1

    rows = [[s, d, v, sp] for (s, d), (v, sp) in sorted(edges.items())]

    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "verses.json"), "w") as f:
        json.dump(
            {
                "meta": "KJV text via scrollmapper/bible_databases; "
                        "cross-references CC-BY openbible.info",
                "ids": ids,
                "texts": texts,
            },
            f, separators=(",", ":"),
        )
    with open(os.path.join(OUT, "edges.json"), "w") as f:
        json.dump(rows, f, separators=(",", ":"))
    with open(os.path.join(OUT, "anchors.json"), "w") as f:
        json.dump(anchors, f, separators=(",", ":"), ensure_ascii=False)

    topics, topic_skipped = load_topics(index)
    with open(os.path.join(OUT, "topics.json"), "w") as f:
        json.dump(topics, f, separators=(",", ":"), ensure_ascii=False)

    n_anchors = sum(len(v) for v in anchors.values())
    print(f"verses: {len(ids)}  edges: {len(rows)}  skipped: {skipped}")
    print(f"anchors: {n_anchors} on {len(anchors)} verses  "
          f"tsk-only edges added: {tsk_only}")
    print(f"topics: {len(topics)}  passages: "
          f"{sum(len(v) for v in topics.values())}  skipped: {topic_skipped}")
    for name in ("verses.json", "edges.json", "anchors.json", "topics.json"):
        size = os.path.getsize(os.path.join(OUT, name))
        print(f"{name}: {size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
