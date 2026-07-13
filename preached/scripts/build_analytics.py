#!/usr/bin/env python3
"""Sermon analytics for the Preached app.

For every sermon in preached/data/sermons.json, compute:

  1. Scripture-reading share — the fraction of transcript words that match
     the Bible text nearly verbatim. Detected by hashing every 3-word
     shingle of the BSB (public domain) and scoring each transcript word by
     the density of matching shingles in a sliding window. Quotes from other
     translations still share most 3-grams with the BSB, so this is a fair
     (slightly conservative) estimate.

  2. Classification — expository / mixed / topical, from how concentrated
     the sermon's verse citations are in its main chapter (plus adjacent
     chapters of the same book). Expository preaching stays in one passage;
     topical preaching ranges across the canon.

  3. Quoted voices — mentions of well-known theologians, authors, and
     figures of church history (curated patterns, word-boundary matched),
     with the timestamp of the first mention.

Inputs:
  - preached/data/sermons.json          (ids, cites, passage — build_sermons.py)
  - bsb.txt                             (repo root, "Book C:V\ttext")
  - berean_transcripts/data/transcripts/<id>.txt

Output:
  - preached/data/analytics.json
"""
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from build_sermons import (  # noqa: E402
    BASE_BOOKS, ORDINAL_BOOKS, REF_RE, SC_RE, extract_refs, load_canon)

TRANSCRIPTS = sys.argv[1] if len(sys.argv) > 1 else \
    "/Users/lawrencewu/github/berean_transcripts"

TS_RE = re.compile(r"^\[(\d\d):(\d\d):(\d\d)\.\d+ -->")
WORD_RE = re.compile(r"[a-z']+")
NOISE_RE = re.compile(r"\[[A-Z ]+\]|\(\w+\)")  # [SIDE CONVERSATION], (applause)
# Whisper writes numbers both ways: "verse 16" and "verse five".
_ONES = "one|two|three|four|five|six|seven|eight|nine"
_TEENS = "ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen"
_TENS = "twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety"
NUM = rf"(?:\d{{1,3}}|(?:{_TENS})(?:[-\s](?:{_ONES}))?|(?:{_TEENS})|(?:{_ONES}))"
_NUM_WORDS = {}
for i, w in enumerate(_ONES.split("|"), 1):
    _NUM_WORDS[w] = i
for i, w in enumerate(_TEENS.split("|"), 10):
    _NUM_WORDS[w] = i
for i, w in enumerate(_TENS.split("|"), 2):
    _NUM_WORDS[w] = i * 10


def num_val(s):
    s = s.lower().strip()
    if s.isdigit():
        return int(s)
    parts = re.split(r"[-\s]+", s)
    n = _NUM_WORDS.get(parts[0], 0)
    if len(parts) == 2:
        n += _NUM_WORDS.get(parts[1], 0)
    return n


# bare "verse 14" / "verses one through three" with no book — attributed to
# the chapter the preacher is currently in (context tracking)
BARE_VERSE_RE = re.compile(
    rf"\b(?:verses?|vv?\.)\s+({NUM})\b"
    rf"(?:\s*(?:through|to|[-–])\s*{NUM})?", re.I)
# bare "chapter 15" / "chapter fifteen" — moves context within current book
BARE_CHAPTER_RE = re.compile(rf"\bchapters?\s+({NUM})\b", re.I)

SHINGLE = 3          # words per shingle
WINDOW = 10          # words either side when scoring density
DENSITY = 0.32       # share of matching shingles for a word to count as reading
MIN_EVENTS = 5       # below this many citation events a sermon is unclassified
EXPOSITORY = 0.60    # concentration thresholds
TOPICAL = 0.35

# canonical name -> pattern (lowercase transcript). Distinctive surnames match
# alone; ambiguous ones require the full name.
VOICES = {
    "Charles Spurgeon": r"spurgeon",
    "C.S. Lewis": r"c\.? ?s\.? lewis",
    "John Calvin": r"calvin",
    "Martin Luther": r"martin luther(?! king)|\bluther\b(?! king)",
    "Martin Luther King": r"martin luther king|\bmlk\b",
    "John Piper": r"\bpiper\b",
    "Tim Keller": r"\bkeller\b",
    "John MacArthur": r"macarthur|mcarthur",
    "R.C. Sproul": r"sproul",
    "A.W. Tozer": r"tozer",
    "Jonathan Edwards": r"jonathan edwards",
    "John Wesley": r"john wesley|\bwesley\b",
    "George Whitefield": r"whitefield|whitfield",
    "Augustine": r"augustine",
    "Thomas Aquinas": r"aquinas",
    "Dietrich Bonhoeffer": r"bonhoeffer",
    "J.I. Packer": r"packer",
    "John Stott": r"\bstott\b",
    "J.C. Ryle": r"\bryle\b",
    "John Owen": r"john owen",
    "John Bunyan": r"bunyan",
    "Richard Baxter": r"richard baxter",
    "Martyn Lloyd-Jones": r"lloyd[- ]jones",
    "D.A. Carson": r"d\.? ?a\.? carson|don carson",
    "Wayne Grudem": r"grudem",
    "Paul Washer": r"paul washer",
    "Matt Chandler": r"matt chandler",
    "David Platt": r"david platt",
    "Mark Dever": r"mark dever|\bdever\b",
    "Al Mohler": r"mohler",
    "Jim Elliot": r"jim elliot",
    "David Brainerd": r"brainerd",
    "George Müller": r"george m[uü]e?ller",
    "Hudson Taylor": r"hudson taylor",
    "William Carey": r"william carey",
    "Adoniram Judson": r"judson",
    "John Newton": r"john newton",
    "William Wilberforce": r"wilberforce",
    "John Knox": r"john knox",
    "William Tyndale": r"tyndale",
    "John Wycliffe": r"wycliffe|wickliffe",
    "Athanasius": r"athanasius",
    "Polycarp": r"polycarp",
    "John Chrysostom": r"chrysostom",
    "Anselm": r"\banselm\b",
    "Thomas à Kempis": r"kempis",
    "Blaise Pascal": r"\bpascal\b",
    "Søren Kierkegaard": r"kierkegaard",
    "B.B. Warfield": r"warfield",
    "Charles Hodge": r"charles hodge",
    "J. Gresham Machen": r"machen",
    "Francis Schaeffer": r"schaeffer",
    "Matthew Henry": r"matthew henry",
    "A.W. Pink": r"a\.? ?w\.? pink|arthur pink",
    "Sinclair Ferguson": r"sinclair ferguson",
    "Alistair Begg": r"alistair begg",
    "D.L. Moody": r"d\.? ?l\.? moody|dwight moody",
    "Billy Graham": r"billy graham",
    "Ravi Zacharias": r"zacharias",
    "Josh McDowell": r"mcdowell",
    "Lee Strobel": r"strobel",
    "William Lane Craig": r"william lane craig",
    "John Lennox": r"john lennox",
    "N.T. Wright": r"n\.? ?t\.? wright",
    "F.F. Bruce": r"f\.? ?f\.? bruce",
    "Dallas Willard": r"dallas willard",
    "Philip Yancey": r"yancey",
    "Rick Warren": r"rick warren",
    "Max Lucado": r"lucado",
    "Chuck Swindoll": r"swindoll",
    "G.K. Chesterton": r"chesterton",
    "Corrie ten Boom": r"ten boom",
    "Elisabeth Elliot": r"elisabeth elliot|elizabeth elliot",
    "Amy Carmichael": r"amy carmichael",
    "Oswald Chambers": r"oswald chambers",
    "Andrew Murray": r"andrew murray",
    "E.M. Bounds": r"e\.? ?m\.? bounds",
    "Watchman Nee": r"watchman nee",
    "Thomas Watson": r"thomas watson",
    "Jerry Bridges": r"jerry bridges",
    "Iain Murray": r"iain murray",
    "Joni Eareckson Tada": r"eareckson|joni tada",
    "Charles Stanley": r"charles stanley",
    "Warren Wiersbe": r"wiersbe",
    "Leonard Ravenhill": r"ravenhill",
    "Robert Murray M'Cheyne": r"m'?cheyne|mccheyne",
    "Thomas Brooks": r"thomas brooks",
    "Jeremiah Burroughs": r"burroughs",
    "Octavius Winslow": r"winslow",
    "Andrew Bonar": r"\bbonar\b",
}
VOICE_RES = {name: re.compile(pat) for name, pat in VOICES.items()}


def tokenize(text):
    return WORD_RE.findall(text.lower())


def load_bible_shingles():
    shingles = set()
    with open(os.path.join(ROOT, "bsb.txt"), encoding="utf-8-sig") as f:
        for line in f:
            if "\t" not in line:
                continue
            ref, _, text = line.partition("\t")
            if not re.match(r".+ \d+:\d+$", ref.strip()):
                continue
            words = tokenize(text)
            for i in range(len(words) - SHINGLE + 1):
                shingles.add(hash(tuple(words[i:i + SHINGLE])))
    return shingles


def parse_transcript(path):
    """Return list of (ts_seconds, text) segments, noise removed."""
    segs = []
    ts = 0
    with open(path, errors="replace") as f:
        for line in f:
            m = TS_RE.match(line)
            if m:
                ts = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
                line = line.split("]", 1)[-1]
            text = NOISE_RE.sub(" ", line).strip()
            if text:
                segs.append((ts, text))
    return segs


def reading_share(words, shingles):
    """Fraction of words inside dense runs of Bible-matching shingles."""
    n = len(words)
    if n < SHINGLE:
        return 0.0, n
    hits = [0] * n  # hits[i] = 1 if shingle starting at word i matches
    for i in range(n - SHINGLE + 1):
        if hash(tuple(words[i:i + SHINGLE])) in shingles:
            hits[i] = 1
    # prefix sums for windowed density
    pre = [0]
    for h in hits:
        pre.append(pre[-1] + h)
    reading = 0
    for i in range(n):
        lo, hi = max(0, i - WINDOW), min(n - SHINGLE + 1, i + WINDOW)
        if hi <= lo:
            continue
        if (pre[hi] - pre[lo]) / (hi - lo) >= DENSITY:
            reading += 1
    return reading / n, n


def citation_events(sermon, segs, chapters, book_ch):
    """Counter of (book, chapter) reference events across the transcript.

    A fully-qualified reference ("Romans 8:28", "1 Peter chapter 4") is one
    event for its chapter and moves the context there. A bare "verse 14" is
    one event for the current context chapter — this is where expository
    sermons spend their time, and it's invisible to qualified-ref extraction.
    """
    events = Counter()
    current = None
    if sermon.get("passage"):
        b, c, _ = sermon["passage"][0].split(".")
        current = (b, int(c))
        events[current] += 1
    for _, text in segs:
        qualified = list(extract_refs(text, chapters, book_ch))
        for book, ch, _, _ in qualified:
            events[(book, ch)] += 1
            current = (book, ch)
        # strip qualified refs so their "chapter N verse M" parts don't
        # double-count as bare mentions
        stripped = SC_RE.sub(" ", REF_RE.sub(" ", text))
        for m in BARE_CHAPTER_RE.finditer(stripped):
            n = num_val(m.group(1))
            if current and (current[0], n) in chapters:
                current = (current[0], n)
                events[current] += 1
        for m in BARE_VERSE_RE.finditer(stripped):
            if current and 1 <= num_val(m.group(1)) <= chapters.get(current, 0):
                events[current] += 1
    return events


def main_chapter(sermon, events):
    """The chapter a sermon is 'on': its title passage, else its most-cited."""
    if sermon.get("passage"):
        b, c, _ = sermon["passage"][0].split(".")
        return (b, int(c))
    if events:
        return events.most_common(1)[0][0]
    return None


def concentration(main, events):
    """Share of citation events in the main chapter ± 1 of the same book."""
    total = sum(events.values())
    if not main or total < MIN_EVENTS:
        return None
    near = sum(cnt for (b, c), cnt in events.items()
               if b == main[0] and abs(c - main[1]) <= 1)
    return round(near / total, 3)


# "Wed Revelation Lesson 5", "Ephesians Lesson 3", "Study of Corinthians
# Week 2", "Building Up the Church Part 3" — a book name plus series wording
# marks a study through that book.
_ALL_BOOK_WORDS = set(BASE_BOOKS) | set(ORDINAL_BOOKS)
SERIES_WORD_RE = re.compile(r"\b(lesson|study|week|session|part|series)\b", re.I)


def title_book_series(title):
    """True if the title names exactly one Bible book plus series wording."""
    if not SERIES_WORD_RE.search(title):
        return False
    words = re.findall(r"[a-z]+", title.lower())
    named = {w for w in words if w in _ALL_BOOK_WORDS}
    # "song", "acts", "mark", "job" etc. as ordinary words are the risk;
    # requiring exactly one book word plus series wording keeps it precise.
    return len(named - {"job", "mark", "acts", "song", "numbers", "kings"}) == 1


def mark_series(sermons, mains):
    """Boolean per sermon: part of a walk through one book.

    True when the title names a book study, or when nearby sermons of the
    same service type (within 6 slots and 90 days) visit other chapters of
    the same book at least twice — a congregation moving through a book.
    """
    series = [False] * len(sermons)
    by_type = defaultdict(list)
    for i, s in enumerate(sermons):
        if title_book_series(s.get("title") or ""):
            series[i] = True
        if mains[i] and s.get("date"):
            by_type[s["type"]].append(i)
    for idxs in by_type.values():
        idxs.sort(key=lambda i: sermons[i]["date"])
        for pos, i in enumerate(idxs):
            b, c = mains[i]
            hits = 0
            for j in idxs[max(0, pos - 6):pos + 7]:
                if j == i:
                    continue
                if abs(_days(sermons[i]["date"]) - _days(sermons[j]["date"])) > 90:
                    continue
                mb, mc = mains[j]
                if mb == b and mc != c:
                    hits += 1
            if hits >= 2:
                series[i] = True
    return series


def _days(iso):
    y, m, d = iso.split("-")
    return int(y) * 372 + int(m) * 31 + int(d)


def label_of(is_series, conc):
    if is_series:
        return "expository"
    if conc is None:
        return "unclassified"
    if conc >= EXPOSITORY:
        return "expository"
    if conc < TOPICAL:
        return "topical"
    return "mixed"


def find_voices(segs):
    """{name: [count, first_ts]} across transcript segments."""
    found = {}
    for ts, text in segs:
        low = text.lower()
        for name, rx in VOICE_RES.items():
            k = len(rx.findall(low))
            if k:
                if name in found:
                    found[name][0] += k
                else:
                    found[name] = [k, ts]
    # "Martin Luther" pattern also matches inside "Martin Luther King" text;
    # the negative lookahead handles it per-match, nothing to fix up here.
    return found


def main():
    data = json.load(open(os.path.join(ROOT, "preached", "data", "sermons.json")))
    sermons = data["sermons"]
    print(f"{len(sermons)} sermons")

    _, chapters, book_ch = load_canon()
    print("hashing BSB shingles…")
    shingles = load_bible_shingles()
    print(f"  {len(shingles):,} shingles")

    # pass 1: per-sermon signals from transcripts
    all_events, mains, recs = [], [], []
    people_total, people_sermons = Counter(), Counter()
    for i, s in enumerate(sermons):
        path = os.path.join(TRANSCRIPTS, "data", "transcripts", f"{s['id']}.txt")
        segs = parse_transcript(path) if os.path.exists(path) else []
        words = []
        for _, text in segs:
            words.extend(tokenize(text))

        share, nwords = reading_share(words, shingles) if words else (0.0, 0)
        events = citation_events(s, segs, chapters, book_ch)
        voices = find_voices(segs)

        rec = {"read": round(share, 4), "words": nwords,
               "cites": sum(events.values()), "books": len({b for b, _ in events})}
        if voices:
            rec["quotes"] = sorted(
                ([n, c, ts] for n, (c, ts) in voices.items()),
                key=lambda x: -x[1])
        for name in voices:
            people_total[name] += voices[name][0]
            people_sermons[name] += 1
        all_events.append(events)
        mains.append(main_chapter(s, events))
        recs.append(rec)
        if (i + 1) % 200 == 0:
            print(f"  {i + 1}/{len(sermons)}")

    # pass 2: series detection needs every sermon's main chapter first
    series = mark_series(sermons, mains)

    per, conc_dist = {}, []
    years = defaultdict(lambda: {"n": 0, "sec": 0, "read": 0.0, "read_n": 0,
                                 "expository": 0, "mixed": 0, "topical": 0,
                                 "unclassified": 0})
    for i, s in enumerate(sermons):
        rec = recs[i]
        conc = concentration(mains[i], all_events[i])
        label = label_of(series[i], conc)
        rec["cls"] = label
        if series[i]:
            rec["series"] = 1
        if conc is not None:
            rec["conc"] = conc
            conc_dist.append(conc)
        per[s["id"]] = rec

        y = (s.get("date") or "")[:4] or "?"
        yr = years[y]
        yr["n"] += 1
        yr["sec"] += s.get("dur") or 0
        yr[label] += 1
        if rec["words"]:
            yr["read"] += rec["read"]
            yr["read_n"] += 1

    for yr in years.values():
        yr["read"] = round(yr["read"] / yr["read_n"], 4) if yr["read_n"] else 0
        del yr["read_n"]

    classified = [r for r in per.values() if r["cls"] != "unclassified"]
    overall = {
        "n": len(sermons),
        "hours": round(sum(s.get("dur") or 0 for s in sermons) / 3600),
        "classified": len(classified),
        "expository": sum(r["cls"] == "expository" for r in classified),
        "mixed": sum(r["cls"] == "mixed" for r in classified),
        "topical": sum(r["cls"] == "topical" for r in classified),
        "read_avg": round(sum(r["read"] for r in per.values() if r["words"])
                          / max(1, sum(1 for r in per.values() if r["words"])), 4),
    }

    out = {
        "built": date.today().isoformat(),
        "church": data.get("church"),
        "thresholds": {"expository": EXPOSITORY, "topical": TOPICAL,
                       "min_events": MIN_EVENTS},
        "overall": overall,
        "years": {y: dict(v) for y, v in sorted(years.items())},
        "people": [[n, people_total[n], people_sermons[n]]
                   for n, _ in people_total.most_common()],
        "sermons": per,
    }
    dest = os.path.join(ROOT, "preached", "data", "analytics.json")
    json.dump(out, open(dest, "w"), separators=(",", ":"))
    print(f"wrote {dest} ({os.path.getsize(dest) // 1024}K)")

    # diagnostics
    print("\nclassification:", {k: overall[k] for k in
                                ("expository", "mixed", "topical")},
          f"+ {overall['n'] - overall['classified']} unclassified")
    print("series members:", sum(series))
    print("avg reading share:", overall["read_avg"])
    if conc_dist:
        conc_dist.sort()
        q = lambda p: conc_dist[int(p * (len(conc_dist) - 1))]
        print("concentration quartiles:",
              [round(q(p), 2) for p in (0, 0.25, 0.5, 0.75, 1)])
    reads = sorted(r["read"] for r in per.values() if r["words"])
    if reads:
        q = lambda p: reads[int(p * (len(reads) - 1))]
        print("reading-share quartiles:",
              [round(q(p), 3) for p in (0, 0.25, 0.5, 0.75, 1)])
    print("top voices:", out["people"][:15])


if __name__ == "__main__":
    main()
