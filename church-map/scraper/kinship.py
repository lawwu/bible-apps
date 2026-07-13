#!/usr/bin/env python3
"""Confessional kinship — stage 2 of the church profile scraper.

Compares each church's statement of faith against a library of historic
confessions and creeds, scoring cosine similarity over tf-idf weighted
word 1–2 grams. Word n-grams (not semantic embeddings) are deliberate:
statements of faith borrow confession language *verbatim* — a church using
Baptist Faith & Message sentences should light up BFM even if it never
names it — and shared wording is exactly what n-grams measure. Scores are
comparative ("reads closest to X"), never a verdict.

Confession sources (fetched once into scraper/confessions/, gitignored):
  - NonlinearFruit/Creeds.json (public-domain historic texts)
  - Baptist Faith & Message 2000 from sbc.net

Usage:  python3 kinship.py          # updates every profile that has a
                                    # beliefs/about page in the cache
"""
import json
import math
import os
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from scrape import PROFILES, cached_get, load_profiles, save_profiles, to_text  # noqa: E402

CONF_DIR = os.path.join(HERE, "confessions")
CREEDS_RAW = ("https://raw.githubusercontent.com/NonlinearFruit/Creeds.json/"
              "master/creeds/{}.json")

# id -> (display name, tradition) — chosen to span traditions a church
# statement might echo
LIBRARY = {
    "apostles_creed": ("Apostles' Creed", "ecumenical"),
    "nicene_creed": ("Nicene Creed", "ecumenical"),
    "westminster_confession_of_faith": ("Westminster Confession", "presbyterian"),
    "savoy_declaration": ("Savoy Declaration", "congregationalist"),
    "london_baptist_1689": ("1689 London Baptist", "reformed baptist"),
    "belgic_confession_of_faith": ("Belgic Confession", "continental reformed"),
    "heidelberg_catechism": ("Heidelberg Catechism", "continental reformed"),
    "canons_of_dort": ("Canons of Dort", "continental reformed"),
    "abstract_of_principles": ("Abstract of Principles", "baptist"),
    "chicago_statement_on_biblical_inerrancy": ("Chicago Statement", "evangelical"),
}
BFM_URL = "https://bfm.sbc.net/bfm2000/"

STOP = set("""a an and are as at be but by for from has have he her his i in
is it its of on or our that the their they this to was we were which who will
with you your shall unto hath doth""".split())


def flatten_strings(x):
    if isinstance(x, str):
        return [x]
    if isinstance(x, list):
        return [s for y in x for s in flatten_strings(y)]
    if isinstance(x, dict):
        return [s for y in x.values() for s in flatten_strings(y)]
    return []


def load_library():
    os.makedirs(CONF_DIR, exist_ok=True)
    texts = {}
    for cid, (name, _) in LIBRARY.items():
        path = os.path.join(CONF_DIR, cid + ".txt")
        if not os.path.exists(path):
            _, raw = cached_get(CREEDS_RAW.format(cid))
            data = json.loads(raw)
            open(path, "w").write("\n".join(flatten_strings(data.get("Data", data))))
            print(f"  fetched {name}")
        texts[name] = open(path).read()

    bfm_path = os.path.join(CONF_DIR, "bfm2000.txt")
    if not os.path.exists(bfm_path):
        try:
            _, html_text = cached_get(BFM_URL)
            open(bfm_path, "w").write(to_text(html_text))
            print("  fetched Baptist Faith & Message 2000")
        except Exception as e:
            print(f"  BFM 2000 unavailable ({type(e).__name__}) — skipping")
    if os.path.exists(bfm_path):
        texts["Baptist Faith & Message 2000"] = open(bfm_path).read()
    return texts


# ---------------------------------------------------------------- tf-idf

WORD_RE = re.compile(r"[a-z']+")


def features(text):
    words = WORD_RE.findall(text.lower())
    feats = Counter(w for w in words if w not in STOP and len(w) > 2)
    for a, b in zip(words, words[1:]):
        if a in STOP and b in STOP:
            continue
        feats[a + " " + b] += 1
    return feats


def tfidf_vectors(docs):
    """docs: {name: text} -> {name: {feat: weight}} with idf over the set."""
    tfs = {n: features(t) for n, t in docs.items()}
    df = Counter()
    for tf in tfs.values():
        df.update(tf.keys())
    n = len(docs)
    vecs = {}
    for name, tf in tfs.items():
        vecs[name] = {f: (1 + math.log(c)) * math.log(1 + n / df[f])
                      for f, c in tf.items()}
    return vecs


def cosine(a, b):
    if len(b) < len(a):
        a, b = b, a
    dot = sum(w * b.get(f, 0.0) for f, w in a.items())
    na = math.sqrt(sum(w * w for w in a.values()))
    nb = math.sqrt(sum(w * w for w in b.values()))
    return dot / (na * nb) if na and nb else 0.0


# ---------------------------------------------------------------- main

def church_text(rec):
    """The church's own doctrinal text: beliefs page, else about page."""
    for cat in ("beliefs", "about"):
        url = (rec.get("pages") or {}).get(cat)
        if not url or url.endswith("(unfetchable)"):
            continue
        try:
            _, h = cached_get(url)   # cache hit — no new request
        except Exception:
            continue
        text = to_text(h)
        if len(text.split()) > 150:
            return text, cat
    return None, None


def main():
    print("loading confession library…")
    library = load_library()
    profiles = load_profiles()

    candidates = {}
    for cid, rec in profiles.items():
        if rec.get("site", {}).get("status") != "ok":
            continue
        text, src = church_text(rec)
        if text:
            candidates[cid] = (text, src)

    if not candidates:
        print("no profiles with a beliefs/about page — run scrape.py first")
        return

    docs = dict(library)
    docs.update({f"church::{cid}": t for cid, (t, _) in candidates.items()})
    vecs = tfidf_vectors(docs)

    for cid, (_, src) in candidates.items():
        cv = vecs[f"church::{cid}"]
        scores = {name: round(cosine(cv, vecs[name]), 4) for name in library}
        ranked = sorted(scores.items(), key=lambda kv: -kv[1])
        profiles[cid]["profile"]["kinship"] = {
            "scores": scores, "source_page": src, "method": "tfidf-1v2gram"}
        top = " · ".join(f"{n} {s:.2f}" for n, s in ranked[:3])
        print(f"{profiles[cid]['name'][:36]:36s} [{src}]  {top}")

    save_profiles(profiles)
    print(f"\nupdated {PROFILES}")


if __name__ == "__main__":
    main()
