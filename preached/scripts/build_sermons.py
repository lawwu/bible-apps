#!/usr/bin/env python3
"""Extract sermon -> Scripture edges from Berean transcripts.

Inputs (from the berean_transcripts repo):
  - data/video_details_cache.json   (title, upload_date, url, duration)
  - data/transcripts/<video_id>.txt (whisper output with timestamps)

Outputs:
  - preached/data/sermons.json          full records for the Preached app
  - verse-explorer/data/preached.json   lite records + verse->sermon cites
    for the explorer's "Preached at Berean" section

Reference extraction handles spoken forms ("Romans chapter 8 verse 28",
"1 Peter 4:12", "Second Corinthians 5, 17") with ordinal lookback, and
rejects references that don't exist in the canon (whisper mishears).
"""
import json
import os
import re
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
TRANSCRIPTS = sys.argv[1] if len(sys.argv) > 1 else \
    "/Users/lawrencewu/github/berean_transcripts"

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

# spoken/written base names -> (needs_ordinal, {ordinal -> osis})
BASE_BOOKS = {
    "genesis": "Gen", "exodus": "Exod", "leviticus": "Lev", "numbers": "Num",
    "deuteronomy": "Deut", "joshua": "Josh", "judges": "Judg", "ruth": "Ruth",
    "ezra": "Ezra", "nehemiah": "Neh", "esther": "Esth", "job": "Job",
    "psalm": "Ps", "psalms": "Ps", "proverbs": "Prov",
    "ecclesiastes": "Eccl", "isaiah": "Isa", "jeremiah": "Jer",
    "lamentations": "Lam", "ezekiel": "Ezek", "daniel": "Dan",
    "hosea": "Hos", "joel": "Joel", "amos": "Amos", "obadiah": "Obad",
    "jonah": "Jonah", "micah": "Mic", "nahum": "Nah", "habakkuk": "Hab",
    "zephaniah": "Zeph", "haggai": "Hag", "zechariah": "Zech",
    "malachi": "Mal", "matthew": "Matt", "mark": "Mark", "luke": "Luke",
    "acts": "Acts", "romans": "Rom", "galatians": "Gal", "ephesians": "Eph",
    "philippians": "Phil", "colossians": "Col", "titus": "Titus",
    "philemon": "Phlm", "hebrews": "Heb", "james": "Jas", "jude": "Jude",
    "revelation": "Rev", "revelations": "Rev",
}
ORDINAL_BOOKS = {
    "samuel": {1: "1Sam", 2: "2Sam"},
    "kings": {1: "1Kgs", 2: "2Kgs"},
    "chronicles": {1: "1Chr", 2: "2Chr"},
    "corinthians": {1: "1Cor", 2: "2Cor"},
    "thessalonians": {1: "1Thess", 2: "2Thess"},
    "timothy": {1: "1Tim", 2: "2Tim"},
    "peter": {1: "1Pet", 2: "2Pet"},
    "john": {1: "1John", 2: "2John", 3: "3John"},  # bare "john" = gospel
}
ORDINAL_WORDS = {
    "1": 1, "2": 2, "3": 3, "1st": 1, "2nd": 2, "3rd": 3,
    "first": 1, "second": 2, "third": 3, "i": 1, "ii": 2, "iii": 3,
}

BOOK_NAMES = sorted(list(BASE_BOOKS) + list(ORDINAL_BOOKS), key=len, reverse=True)
REF_RE = re.compile(
    r"(?:\b(1st|2nd|3rd|first|second|third|1|2|3|i{1,3})[\s.]+)?"
    r"\b(" + "|".join(BOOK_NAMES) + r")\b"
    r"[\s,.]*(?:chapter\s+)?(\d{1,3})"
    r"(?:\s*(?::|,\s*verse[s]?|verse[s]?)\s*(\d{1,3}))?"
    r"(?:\s*[-–]\s*(\d{1,3}))?",
    re.I,
)
TS_RE = re.compile(r"^\[(\d\d):(\d\d):(\d\d)\.\d+ -->")

# single-chapter books cited by verse only: "3 John v. 1-7", "Jude verse 4"
SC_BOOKS = {"obadiah": "Obad", "philemon": "Phlm", "jude": "Jude", "john": None}
SC_RE = re.compile(
    r"(?:\b(2|3|second|third)[\s.]+)?"
    r"\b(obadiah|philemon|jude|john)\b"
    r"[\s,]*(?:v\.?|verse[s]?)\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?",
    re.I,
)
# bare "chapter:verse" for joining with a lone book name found elsewhere in a title
LONE_REF_RE = re.compile(r"\b(\d{1,3}):(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\b")


def load_canon():
    verses = json.load(open(os.path.join(ROOT, "verse-explorer", "data", "verses.json")))
    ids = verses["ids"]
    idx = {v: i for i, v in enumerate(ids)}
    chapters = defaultdict(int)   # (book, chapter) -> max verse
    book_ch = defaultdict(int)    # book -> max chapter
    for vid in ids:
        b, c, v = vid.split(".")
        c, v = int(c), int(v)
        chapters[(b, c)] = max(chapters[(b, c)], v)
        book_ch[b] = max(book_ch[b], c)
    return idx, chapters, book_ch


def resolve_book(ordinal, base):
    base = base.lower()
    if base in ORDINAL_BOOKS:
        n = ORDINAL_WORDS.get((ordinal or "").lower().rstrip("."))
        if base == "john" and n is None:
            return "John"
        if n is None:
            return None  # "Peter 4:12" without ordinal — ambiguous, drop
        return ORDINAL_BOOKS[base].get(n)
    return BASE_BOOKS.get(base)


def extract_refs(text, chapters, book_ch):
    """Yield (osis_book, chapter, verse_or_None, end_verse_or_None)."""
    for m in REF_RE.finditer(text):
        book = resolve_book(m.group(1), m.group(2))
        if not book:
            continue
        ch = int(m.group(3))
        if ch < 1 or ch > book_ch.get(book, 0):
            continue
        verse = int(m.group(4)) if m.group(4) else None
        end = int(m.group(5)) if m.group(5) else None
        if verse is not None and not 1 <= verse <= chapters.get((book, ch), 0):
            continue
        if end is not None and (verse is None or end <= verse or
                                end > chapters.get((book, ch), 0)):
            end = None
        yield book, ch, verse, end
    for m in SC_RE.finditer(text):
        base = m.group(2).lower()
        if base == "john":
            n = ORDINAL_WORDS.get((m.group(1) or "").lower())
            if n not in (2, 3):
                continue
            book = f"{n}John"
        else:
            book = SC_BOOKS[base]
        verse = int(m.group(3))
        if not 1 <= verse <= chapters.get((book, 1), 0):
            continue
        end = int(m.group(4)) if m.group(4) else None
        if end is not None and (end <= verse or end > chapters.get((book, 1), 0)):
            end = None
        yield book, 1, verse, end


def title_fallback_ref(title, chapters, book_ch):
    """Join a lone book name with a chapter:verse ref elsewhere in the title."""
    books = []
    for m in REF_RE_BOOK_ONLY.finditer(title):
        book = resolve_book(m.group(1), m.group(2))
        if book:
            books.append(book)
    m = LONE_REF_RE.search(title)
    if len(set(books)) != 1 or not m:
        return None
    book = books[0]
    ch, verse = int(m.group(1)), int(m.group(2))
    end = int(m.group(3)) if m.group(3) else None
    if not 1 <= ch <= book_ch.get(book, 0):
        return None
    if not 1 <= verse <= chapters.get((book, ch), 0):
        return None
    if end is not None and (end <= verse or end > chapters.get((book, ch), 0)):
        end = None
    return book, ch, verse, end


REF_RE_BOOK_ONLY = re.compile(
    r"(?:\b(1st|2nd|3rd|first|second|third|1|2|3|i{1,3})[\s.]+)?"
    r"\b(" + "|".join(BOOK_NAMES) + r")\b", re.I)


def parse_transcript(path, chapters, book_ch):
    """Return (verse_cites, chapter_cites): {key: first_ts_seconds}."""
    verse_cites, chapter_cites = {}, {}
    ts = 0
    with open(path, errors="replace") as f:
        for line in f:
            m = TS_RE.match(line)
            if m:
                ts = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
            for book, ch, verse, end in extract_refs(line, chapters, book_ch):
                chapter_cites.setdefault(f"{book}.{ch}", ts)
                if verse is not None:
                    for v in range(verse, (end or verse) + 1):
                        verse_cites.setdefault(f"{book}.{ch}.{v}", ts)
    return verse_cites, chapter_cites


def clean_title(title):
    t = re.sub(r"berean community church", "", title, flags=re.I)
    t = re.sub(r"\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b", "", t)
    t = re.sub(r"\b\d{4}-\d{2}-\d{2}\b", "", t)
    t = re.sub(r"\b(wednesday|sunday)( night| morning)?( bible)? (study|service)\b", "", t, flags=re.I)
    t = re.sub(r"\bbible study\b", "", t, flags=re.I)
    t = re.sub(r"\blive\b", "", t, flags=re.I)
    t = REF_RE.sub("", t)
    t = LONE_REF_RE.sub("", t)
    t = re.sub(r"\bv\.? ?\d+([-–]\d+)?\b", "", t)
    t = re.sub(r"\s+", " ", t)
    t = re.sub(r"^[\s\-–|·&,:]+|[\s\-–|·&,:]+$", "", t)
    return t


def service_type(title):
    t = title.lower()
    if "wednesday" in t:
        return "Wednesday Bible study"
    if "sunday" in t or "service" in t:
        return "Sunday service"
    if "retreat" in t:
        return "Retreat"
    return "Message"


def main():
    idx, chapters, book_ch = load_canon()
    cache = json.load(open(os.path.join(TRANSCRIPTS, "data", "video_details_cache.json")))

    sermons = []
    skipped = 0
    for vid, meta in cache.items():
        path = os.path.join(TRANSCRIPTS, "data", "transcripts", f"{vid}.txt")
        if not os.path.exists(path):
            skipped += 1
            continue
        title = meta.get("title") or vid
        verse_cites, chapter_cites = parse_transcript(path, chapters, book_ch)

        # passage from the title = the sermon's own text (high confidence)
        passage = None
        title_refs = list(extract_refs(title, chapters, book_ch))
        if not title_refs:
            fb = title_fallback_ref(title, chapters, book_ch)
            if fb:
                title_refs = [fb]
        for book, ch, verse, end in title_refs:
            disp_ch = f"{book}.{ch}"
            if verse is not None:
                passage = [f"{book}.{ch}.{verse}", end or verse]
                for v in range(verse, (end or verse) + 1):
                    verse_cites.setdefault(f"{book}.{ch}.{v}", 0)
            else:
                passage = [f"{book}.{ch}.1", 0]
            chapter_cites.setdefault(disp_ch, 0)
            break

        up = meta.get("upload_date") or ""
        date = f"{up[:4]}-{up[4:6]}-{up[6:8]}" if len(up) == 8 else ""
        sermons.append({
            "id": vid,
            "title": clean_title(title),
            "type": service_type(title),
            "date": date,
            "url": meta.get("webpage_url") or f"https://www.youtube.com/watch?v={vid}",
            "dur": meta.get("duration") or 0,
            "passage": passage,
            "cites": sorted(verse_cites.items(), key=lambda kv: kv[1]),
            "chapters": sorted(chapter_cites.items(), key=lambda kv: kv[1]),
        })

    sermons.sort(key=lambda s: s["date"], reverse=True)

    out_full = os.path.join(ROOT, "preached", "data", "sermons.json")
    with open(out_full, "w") as f:
        json.dump({"church": "Berean Community Church",
                   "source": "https://bereancc.com/", "sermons": sermons},
                  f, separators=(",", ":"), ensure_ascii=False)

    # lite version for the explorer: verse -> [(sermonIdx, seconds)]
    lite = [[s["title"] or s["type"], s["date"], s["url"]] for s in sermons]
    cites = defaultdict(list)
    for si, s in enumerate(sermons):
        for osis, ts in s["cites"]:
            if osis in idx:
                cites[idx[osis]].append([si, ts])
    with open(os.path.join(ROOT, "verse-explorer", "data", "preached.json"), "w") as f:
        json.dump({"sermons": lite, "cites": cites}, f,
                  separators=(",", ":"), ensure_ascii=False)

    n_vc = sum(len(s["cites"]) for s in sermons)
    n_cc = sum(len(s["chapters"]) for s in sermons)
    n_pass = sum(1 for s in sermons if s["passage"])
    print(f"sermons: {len(sermons)} (no transcript: {skipped})")
    print(f"verse cites: {n_vc}  chapter cites: {n_cc}  title passages: {n_pass}")
    for name in (out_full, os.path.join(ROOT, "verse-explorer", "data", "preached.json")):
        print(f"{name.split('bible-apps/')[-1]}: {os.path.getsize(name)/1e6:.1f} MB")


if __name__ == "__main__":
    main()
