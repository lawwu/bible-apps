#!/usr/bin/env python3
"""In Other Words — where Bible translations part ways.

Compares five public-domain translations verse by verse:

  KJV  (1769)  Textus Receptus          verse-explorer/data/verses.json
  YLT  (1898)  hyper-literal, TR        scrollmapper/bible_databases
  ASV  (1901)  critical text            scrollmapper/bible_databases
  WEB  (2000)  Byzantine majority NT    ebible.org (engwebp, verse-per-line)
  BSB  (2016)  critical text            bsb.txt (repo root)

For every verse: normalize (lowercase, strip punctuation, fold archaic forms
so "thou goeth" ≠ "you go" doesn't drown real differences), then score
divergence as the mean pairwise bag-of-words Jaccard distance.

Outputs translations/data/diff.json:
  - a translation×translation similarity matrix
  - the ~250 most divergent verses with all five texts
  - verses missing from some translations (the textual-criticism showcase)
  - per-book mean divergence

Sources land in translations/sources/ (gitignored); they are downloaded
automatically if absent.
"""
import io
import json
import os
import re
import sys
import urllib.request
import zipfile
from collections import Counter
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
ROOT = os.path.dirname(APP)
SOURCES = os.path.join(APP, "sources")

SCROLLMAPPER = "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/{}.json"
EBIBLE_WEB = "https://ebible.org/Scriptures/engwebp_vpl.zip"

TRANSLATIONS = [
    {"id": "KJV", "name": "King James Version", "year": 1769,
     "basis": "Textus Receptus"},
    {"id": "YLT", "name": "Young's Literal Translation", "year": 1898,
     "basis": "Textus Receptus, hyper-literal"},
    {"id": "ASV", "name": "American Standard Version", "year": 1901,
     "basis": "critical text"},
    {"id": "WEB", "name": "World English Bible", "year": 2000,
     "basis": "Byzantine majority text (NT)"},
    {"id": "BSB", "name": "Berean Standard Bible", "year": 2016,
     "basis": "critical text"},
]

OSIS = ["Gen", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth", "1Sam",
        "2Sam", "1Kgs", "2Kgs", "1Chr", "2Chr", "Ezra", "Neh", "Esth", "Job",
        "Ps", "Prov", "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek", "Dan",
        "Hos", "Joel", "Amos", "Obad", "Jonah", "Mic", "Nah", "Hab", "Zeph",
        "Hag", "Zech", "Mal", "Matt", "Mark", "Luke", "John", "Acts", "Rom",
        "1Cor", "2Cor", "Gal", "Eph", "Phil", "Col", "1Thess", "2Thess",
        "1Tim", "2Tim", "Titus", "Phlm", "Heb", "Jas", "1Pet", "2Pet",
        "1John", "2John", "3John", "Jude", "Rev"]

FULL_NAMES = [
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
    "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"]

NAME2OSIS = dict(zip(FULL_NAMES, OSIS))
NAME2OSIS.update({
    "Psalm": "Ps", "Song of Songs": "Song", "Canticles": "Song",
    "Revelation of John": "Rev", "Acts of the Apostles": "Acts",
})
# scrollmapper spells ordinals as Roman numerals: "I Samuel", "III John"
for _name, _osis in list(NAME2OSIS.items()):
    for _n, _roman in ((1, "I"), (2, "II"), (3, "III")):
        if _name.startswith(f"{_n} "):
            NAME2OSIS[f"{_roman} {_name[2:]}"] = _osis

# paratext/USFM codes used by ebible.org VPL files
USFM2OSIS = dict(zip(
    ["GEN", "EXO", "LEV", "NUM", "DEU", "JOS", "JDG", "RUT", "1SA", "2SA",
     "1KI", "2KI", "1CH", "2CH", "EZR", "NEH", "EST", "JOB", "PSA", "PRO",
     "ECC", "SNG", "ISA", "JER", "LAM", "EZK", "DAN", "HOS", "JOL", "AMO",
     "OBA", "JON", "MIC", "NAM", "HAB", "ZEP", "HAG", "ZEC", "MAL", "MAT",
     "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH", "PHP",
     "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS", "1PE",
     "2PE", "1JN", "2JN", "3JN", "JUD", "REV"], OSIS))
# ebible.org VPL files use some older-style codes
USFM2OSIS.update({"JOH": "John", "MAR": "Mark", "1JO": "1John",
                  "2JO": "2John", "3JO": "3John", "EZE": "Ezek",
                  "JAM": "Jas", "JOE": "Joel", "NAH": "Nah",
                  "PHI": "Phil", "SOL": "Song"})

# famous textual variants, for annotating the results
VARIANT_NOTES = {
    "Matt.6.13": "the doxology — “for thine is the kingdom…” — is absent from the earliest manuscripts",
    "Matt.17.21": "absent from the earliest manuscripts",
    "Matt.18.11": "absent from the earliest manuscripts",
    "Matt.23.14": "absent from the earliest manuscripts",
    "Mark.7.16": "absent from the earliest manuscripts",
    "Mark.9.44": "absent from the earliest manuscripts",
    "Mark.9.46": "absent from the earliest manuscripts",
    "Mark.11.26": "absent from the earliest manuscripts",
    "Mark.15.28": "absent from the earliest manuscripts",
    "Mark.16.9": "the longer ending of Mark (16:9–20) is disputed",
    "Luke.17.36": "absent from most early manuscripts",
    "Luke.23.17": "absent from the earliest manuscripts",
    "Luke.23.34": "“Father, forgive them” is absent from some early manuscripts",
    "John.5.4": "the angel stirring the water — absent from the earliest manuscripts",
    "John.7.53": "the woman caught in adultery (7:53–8:11) is absent from the earliest manuscripts",
    "Acts.8.37": "the eunuch's confession — absent from the earliest manuscripts",
    "Acts.15.34": "absent from the earliest manuscripts",
    "Acts.24.7": "absent from the earliest manuscripts",
    "Acts.28.29": "absent from the earliest manuscripts",
    "Rom.16.24": "absent from the earliest manuscripts",
    "1John.5.7": "the Comma Johanneum — the Trinitarian formula appears in no Greek manuscript before the 14th century",
    "Rom.16.25": "the closing doxology sits after 14:23 in many Byzantine manuscripts, so some editions place it elsewhere",
    "Rom.16.26": "the closing doxology sits after 14:23 in many Byzantine manuscripts, so some editions place it elsewhere",
    "Rom.16.27": "the closing doxology sits after 14:23 in many Byzantine manuscripts, so some editions place it elsewhere",
}
for _v in range(10, 21):
    VARIANT_NOTES.setdefault(f"Mark.16.{_v}",
                             "the longer ending of Mark (16:9–20) is disputed")
for _v in range(1, 12):
    VARIANT_NOTES.setdefault(f"John.8.{_v}",
                             "the woman caught in adultery (7:53–8:11) is absent from the earliest manuscripts")

# ---------- text normalization ----------

ARCHAIC = {
    "thee": "you", "thou": "you", "thy": "your", "thine": "your",
    "ye": "you", "hath": "has", "hast": "have", "doth": "does",
    "dost": "do", "saith": "says", "spake": "spoke", "shalt": "shall",
    "wilt": "will", "art": "are", "wast": "were", "wert": "were",
    "unto": "to", "yea": "yes", "nay": "no", "brethren": "brothers",
    "shew": "show", "shewed": "showed", "sheweth": "shows",
    "begat": "fathered", "whence": "where", "thence": "there",
    "hither": "here", "thither": "there", "aren": "are", "isn": "is",
}
# proper nouns and ordinary words ending in -eth that are not verbs
ETH_KEEP = {"seth", "sheth", "heth", "japheth", "nazareth", "elisabeth",
            "elizabeth", "ashtoreth", "shibboleth", "teeth", "beneath",
            "underneath", "eth"}
WORD_RE = re.compile(r"[a-z']+")


def normalize(text):
    text = text.lower().replace("’", "'").replace("‘", "'")
    words = []
    for w in WORD_RE.findall(text):
        w = w.strip("'")
        if not w:
            continue
        if w in ARCHAIC:
            w = ARCHAIC[w]
        elif w.endswith("eth") and len(w) >= 6 and w not in ETH_KEEP:
            w = w[:-3] + "s"       # goeth -> gos ≈ goes; uniform across texts
        elif w.endswith("est") and len(w) >= 6 and w[:-3] + "s" in ARCHAIC:
            w = w[:-3]
        words.append(w)
    return Counter(words)


def jaccard_distance(a, b):
    if not a and not b:
        return 0.0
    inter = sum((a & b).values())
    union = sum((a | b).values())
    return 1.0 - inter / union if union else 0.0


# ---------- loaders (each returns {"Gen.1.1": text}) ----------

def fetch(url, dest):
    if not os.path.exists(dest):
        print(f"  downloading {url}")
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        urllib.request.urlretrieve(url, dest)
    return dest


def load_kjv():
    v = json.load(open(os.path.join(ROOT, "verse-explorer", "data", "verses.json")))
    return dict(zip(v["ids"], v["texts"]))


def load_bsb():
    out = {}
    rx = re.compile(r"^(.+?) (\d+):(\d+)\t(.*)")
    for line in open(os.path.join(ROOT, "bsb.txt"), encoding="utf-8-sig"):
        m = rx.match(line)
        if not m:
            continue
        book = NAME2OSIS.get(m.group(1))
        if book:
            text = m.group(4).strip()
            if text:
                out[f"{book}.{m.group(2)}.{m.group(3)}"] = text
    return out


def load_scrollmapper(tid):
    path = fetch(SCROLLMAPPER.format(tid), os.path.join(SOURCES, f"{tid}.json"))
    data = json.load(open(path))
    out = {}
    for book in data["books"]:
        osis = NAME2OSIS.get(book["name"])
        if not osis:
            raise KeyError(f"unmapped book name: {book['name']}")
        for ch in book["chapters"]:
            for v in ch["verses"]:
                text = (v["text"] or "").strip()
                if text:
                    out[f"{osis}.{ch['chapter']}.{v['verse']}"] = text
    return out


def load_web():
    path = fetch(EBIBLE_WEB, os.path.join(SOURCES, "engwebp_vpl.zip"))
    rx = re.compile(r"^([A-Z0-9]{3}) (\d+):(\d+) (.*)")
    out = {}
    with zipfile.ZipFile(path) as z:
        with io.TextIOWrapper(z.open("engwebp_vpl.txt"), encoding="utf-8") as f:
            for line in f:
                m = rx.match(line)
                if not m:
                    continue
                osis = USFM2OSIS.get(m.group(1))
                if osis:
                    text = m.group(4).strip()
                    if text:
                        out[f"{osis}.{m.group(2)}.{m.group(3)}"] = text
    return out


# ---------- main ----------

def main():
    print("loading translations…")
    texts = {
        "KJV": load_kjv(),
        "YLT": load_scrollmapper("YLT"),
        "ASV": load_scrollmapper("ASV"),
        "WEB": load_web(),
        "BSB": load_bsb(),
    }
    order = [t["id"] for t in TRANSLATIONS]
    for tid in order:
        print(f"  {tid}: {len(texts[tid]):,} verses")

    # the canon = KJV verse ids (they order the output too)
    ids = list(load_kjv().keys())
    id_set = set(ids)

    print("normalizing…")
    norm = {tid: {vid: normalize(t) for vid, t in texts[tid].items()}
            for tid in order}

    print("scoring…")
    npairs = [(i, j) for i in range(len(order)) for j in range(i + 1, len(order))]
    pair_dist = {p: 0.0 for p in npairs}
    pair_n = {p: 0 for p in npairs}
    scores = {}      # vid -> mean pairwise distance (where both have text)
    missing = []     # vids absent in some translations

    for vid in ids:
        bags = [norm[tid].get(vid) for tid in order]
        have = [b is not None for b in bags]
        if not all(have):
            # count as missing only mid-chapter (skip versification offsets
            # at chapter ends, e.g. Rev 12:18 vs 13:1)
            b, c, v = vid.rsplit(".", 2)
            if f"{b}.{c}.{int(v) + 1}" in id_set:
                missing.append(vid)
        dsum, dn = 0.0, 0
        for (i, j) in npairs:
            if bags[i] is None or bags[j] is None:
                continue
            d = jaccard_distance(bags[i], bags[j])
            pair_dist[(i, j)] += d
            pair_n[(i, j)] += 1
            dsum += d
            dn += 1
        if dn >= 3:
            scores[vid] = dsum / dn

    matrix = [[1.0] * len(order) for _ in order]
    for (i, j), d in pair_dist.items():
        sim = round(1.0 - d / pair_n[(i, j)], 4)
        matrix[i][j] = matrix[j][i] = sim

    # per-book mean divergence
    book_sum, book_n = Counter(), Counter()
    for vid, s in scores.items():
        b = vid.split(".")[0]
        book_sum[b] += s
        book_n[b] += 1
    books = [{"osis": b, "score": round(book_sum[b] / book_n[b], 4)}
             for b in OSIS if book_n[b]]

    # top divergent verses (exclude missing-verse cases; they get their own list)
    missing_set = set(missing)
    top = sorted(((s, vid) for vid, s in scores.items()
                  if vid not in missing_set), reverse=True)[:250]
    top_out = [{
        "id": vid,
        "score": round(s, 4),
        "texts": [texts[tid].get(vid) for tid in order],
        **({"note": VARIANT_NOTES[vid]} if vid in VARIANT_NOTES else {}),
    } for s, vid in top]

    missing_out = [{
        "id": vid,
        "have": [1 if norm[tid].get(vid) is not None else 0 for tid in order],
        "texts": [texts[tid].get(vid) for tid in order],
        **({"note": VARIANT_NOTES[vid]} if vid in VARIANT_NOTES else {}),
    } for vid in missing]

    out = {
        "meta": {"built": date.today().isoformat(),
                 "translations": TRANSLATIONS,
                 "verses": len(scores)},
        "matrix": matrix,
        "books": books,
        "top": top_out,
        "missing": missing_out,
    }
    os.makedirs(os.path.join(APP, "data"), exist_ok=True)
    dest = os.path.join(APP, "data", "diff.json")
    json.dump(out, open(dest, "w"), separators=(",", ":"), ensure_ascii=False)
    print(f"wrote {dest} ({os.path.getsize(dest) // 1024}K)")

    # diagnostics
    print(f"\nverses scored: {len(scores):,} · missing somewhere: {len(missing)}")
    print("pairwise similarity:")
    for (i, j) in npairs:
        print(f"  {order[i]} ↔ {order[j]}: {matrix[i][j]:.3f}")
    print("most divergent:")
    for t in top_out[:10]:
        print(f"  {t['score']:.3f}  {t['id']}")
    print("calmest books:", [b['osis'] for b in sorted(books, key=lambda x: x['score'])[:5]])
    print("wildest books:", [b['osis'] for b in sorted(books, key=lambda x: -x['score'])[:5]])


if __name__ == "__main__":
    main()
