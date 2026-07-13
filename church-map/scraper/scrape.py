#!/usr/bin/env python3
"""Church profile scraper — stage 1 (probe · discover · rules).

Design: church-map/SCRAPER-DESIGN.md. This stage uses no LLM: it probes each
church website, discovers its beliefs / visit / sermons / leadership pages
from homepage navigation, and extracts what plain rules can extract with
high precision — named confessions, affiliations, service times, sermon
media links, languages, and a few strict doctrinal *signals*, each with a
verbatim evidence quote. `not_stated` is the default everywhere.

Politeness: honors robots.txt, identifies itself, ≥1s between requests,
≤5 pages per church, caches every fetch (content-hash gated re-extraction
comes with the cron in a later stage).

Usage:
  python3 scrape.py --city irvine            # locality substring
  python3 scrape.py --near 33.68,-117.83 --km 8
  python3 scrape.py --limit 20               # first N churches
Output: appends/updates church-map/data/profiles.jsonl (one JSON per church,
keyed by domain) and prints a summary table.
"""
import argparse
import hashlib
import html
import json
import math
import os
import re
import socket
import sys
import time
import urllib.parse
import urllib.request
import urllib.robotparser
from datetime import date
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
CACHE = os.path.join(HERE, "cache")
PROFILES = os.path.join(APP, "data", "profiles.jsonl")

UA = ("bible-apps-church-scraper/0.1 "
      "(+https://lawwu.github.io/bible-apps/church-map/; respectful: "
      "<=5 pages/site, 1 req/s)")
TIMEOUT = 12
DELAY = 1.0
MAX_BYTES = 600_000

socket.setdefaulttimeout(TIMEOUT)
_last_request = [0.0]
_robots = {}


# ---------------------------------------------------------------- fetching

def _robots_for(host):
    """(RobotFileParser | True, crawl_delay). Fetched with OUR user agent —
    RobotFileParser.read() uses Python's default UA, which site firewalls
    often 403, and the parser then wrongly reports deny-all."""
    if host in _robots:
        return _robots[host]
    rp, delay = True, DELAY
    try:
        req = urllib.request.Request(f"https://{host}/robots.txt",
                                     headers={"User-Agent": UA})
        with urllib.request.urlopen(req) as r:
            if r.status == 200:
                body = r.read(100_000).decode("utf-8", "replace")
                rp = urllib.robotparser.RobotFileParser()
                rp.parse(body.splitlines())
                cd = rp.crawl_delay(UA)
                if cd:
                    delay = max(delay, min(float(cd), 10.0))
    except Exception:
        pass  # unreachable/failed robots.txt -> allow
    _robots[host] = (rp, delay)
    return _robots[host]


def polite_get(url):
    """Rate-limited, robots-respecting GET. Returns (final_url, html) or
    raises."""
    host = urllib.parse.urlsplit(url).netloc
    rp, delay = _robots_for(host)
    if rp is not True and not rp.can_fetch(UA, url):
        raise PermissionError("disallowed by robots.txt")

    wait = delay - (time.time() - _last_request[0])
    if wait > 0:
        time.sleep(wait)
    _last_request[0] = time.time()

    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req) as r:
        return r.geturl(), r.read(MAX_BYTES).decode("utf-8", "replace")


CACHE_MAX_AGE_DAYS = None   # --refresh sets this so stale cache re-fetches


def _cache_fresh(entry):
    if CACHE_MAX_AGE_DAYS is None:
        return True
    try:
        fetched = date.fromisoformat(entry.get("fetched", ""))
    except ValueError:
        return False
    return (date.today() - fetched).days <= CACHE_MAX_AGE_DAYS


def cached_get(url):
    os.makedirs(CACHE, exist_ok=True)
    key = hashlib.sha1(url.encode()).hexdigest()
    path = os.path.join(CACHE, key + ".json")
    if os.path.exists(path):
        c = json.load(open(path))
        if _cache_fresh(c):
            return c["final"], c["html"]
    final, text = polite_get(url)
    json.dump({"url": url, "final": final, "fetched": date.today().isoformat(),
               "html": text}, open(path, "w"))
    return final, text


# ---------------------------------------------------------------- parsing

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []          # (href, anchor_text)
        self._href = None
        self._text = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._href = dict(attrs).get("href")
            self._text = []

    def handle_endtag(self, tag):
        if tag == "a" and self._href:
            self.links.append((self._href, " ".join(self._text).strip()))
            self._href = None

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data.strip())


def extract_links(page_html, base_url):
    p = LinkParser()
    try:
        p.feed(page_html)
    except Exception:
        pass
    out = []
    base_host = urllib.parse.urlsplit(base_url).netloc.replace("www.", "")
    for href, text in p.links:
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absu = urllib.parse.urljoin(base_url, href)
        host = urllib.parse.urlsplit(absu).netloc.replace("www.", "")
        out.append((absu, text, host == base_host))
    return out


def to_text(page_html):
    """Crude readability: drop script/style/nav noise, tags -> text."""
    t = re.sub(r"(?is)<(script|style|noscript|svg|form)[^>]*>.*?</\1>", " ", page_html)
    t = re.sub(r"(?is)<br[^>]*>|</(p|div|li|h[1-6]|tr)>", "\n", t)
    t = re.sub(r"(?s)<[^>]+>", " ", t)
    t = html.unescape(t)
    t = re.sub(r"[ \t]+", " ", t)
    return re.sub(r"\n\s*\n+", "\n", t).strip()


# ---------------------------------------------------------------- discovery

PAGE_TAXONOMY = {
    "beliefs": r"belie|statement.?of.?faith|what.?we.?(believe|teach)|doctrin|confession|our.?faith|distinctives",
    "visit": r"\bvisit\b|plan.?your.?visit|new.?here|i.?m.?new|service.?times?|times.?&|location|gather",
    "sermons": r"sermon|message|media|watch|listen|teaching",
    "leadership": r"staff|leadership|elders|pastors|our.?team|meet.?the",
    "about": r"about|who.?we.?are|our.?story|our.?church|welcome",
}


def discover(links):
    """Best same-site link per category, scored by href+anchor text."""
    found = {}
    for cat, pat in PAGE_TAXONOMY.items():
        rx = re.compile(pat, re.I)
        best, best_score = None, 0
        for absu, text, same in links:
            if not same:
                continue
            hay = urllib.parse.urlsplit(absu).path + " " + text
            hits = rx.findall(hay.lower())
            score = len(hits) + (2 if rx.search(text.lower() or "") else 0)
            if hits and score > best_score:
                best, best_score = absu, score
        if best:
            found[cat] = best
    # "about" only matters if no dedicated beliefs page was found
    if "beliefs" in found:
        found.pop("about", None)
    return found


SITEMAP_LOC_RE = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>", re.I)


def sitemap_urls(base_url, budget=2):
    """<loc> entries from /sitemap.xml (following a sitemap index one level).
    Fallback for sites whose nav hides the pages we want (JS menus, icon
    navs). Costs at most `budget`+1 requests."""
    root = urllib.parse.urljoin(base_url, "/sitemap.xml")
    urls = []
    try:
        _, xml = cached_get(root)
    except Exception:
        return urls
    locs = SITEMAP_LOC_RE.findall(xml)
    if "<sitemapindex" in xml:
        # prefer child sitemaps likely to hold pages, not posts/media
        children = sorted(locs, key=lambda u: ("page" not in u, len(u)))
        for child in children[:budget]:
            try:
                _, cx = cached_get(child)
                urls += SITEMAP_LOC_RE.findall(cx)
            except Exception:
                pass
    else:
        urls = locs
    return urls[:500]


# ---------------------------------------------------------------- rules

CONFESSIONS = {
    "1689 London Baptist Confession": r"1689|london baptist confession",
    "Westminster Confession": r"westminster confession",
    "Westminster Standards": r"westminster standards|shorter catechism|larger catechism",
    "Baptist Faith & Message": r"baptist faith (?:and|&) message",
    "Heidelberg Catechism": r"heidelberg",
    "Belgic Confession": r"belgic",
    "Canons of Dort": r"canons of dort",
    "Three Forms of Unity": r"three forms of unity",
    "39 Articles": r"thirty.?nine articles|39 articles",
    "Augsburg Confession": r"augsburg",
    "Book of Concord": r"book of concord",
    "New Hampshire Confession": r"new hampshire confession",
    "Philadelphia Confession": r"philadelphia confession",
    "Abstract of Principles": r"abstract of principles",
    "Apostles' Creed": r"apostles'? creed",
    "Nicene Creed": r"nicene creed",
    "Chicago Statement on Inerrancy": r"chicago statement",
}

AFFILIATIONS = {
    "9Marks": r"9\s?marks|9marks\.org",
    "The Gospel Coalition": r"gospel coalition|thegospelcoalition\.org|tgc\b",
    "Acts 29": r"acts ?29",
    "SBC": r"southern baptist convention|\bsbc\b|sbc\.net",
    "PCA": r"presbyterian church in america|pcanet\.org|\bpca\b",
    "OPC": r"orthodox presbyterian|\bopc\b",
    "EFCA": r"evangelical free church|efca\b",
    "The Master's Seminary": r"master'?s seminary|tms\.edu",
    "Founders Ministries": r"founders ministries|founders\.org",
    "G3 Ministries": r"g3 ?ministries|g3min\.org",
    "Calvary Chapel": r"calvary chapel",
    "Assemblies of God": r"assemblies of god|\bag\.org",
    "ARBCA": r"\barbca\b|reformed baptist churches of america",
    "Sovereign Grace Churches": r"sovereign grace churches",
    "Converge": r"converge worldwide|baptist general conference",
    "NAMB": r"north american mission board|\bnamb\b",
}

# strict, high-precision doctrinal signals (verdicts wait for the LLM stage)
SIGNALS = {
    "credo_baptism": r"believer'?s baptism|baptism of believers|baptiz\w+ (?:only )?(?:those|believers)|upon (?:their )?profession of faith",
    "paedo_baptism": r"infant baptism|baptiz\w+ (?:the )?(?:infants|children) of believ",
    "immersion": r"by immersion",
    "plural_elders": r"plurality of elders|elder.?led|led by (?:a )?(?:team|plurality) of elders|board of elders",
    "reformed_soteriology": r"doctrines of grace|unconditional election|sovereign grace|five (?:solas|points)|reformed theolog|monergis",
    "complementarian": r"complementarian|office of (?:elder|pastor) is (?:reserved|limited) (?:for|to) (?:qualified )?men|men and women.{0,40}distinct roles",
    "cessationist": r"cessationis|(?:sign|revelatory) gifts .{0,30}ceased",
    "continuationist": r"continuationis|gifts .{0,30}(?:continue|for today)|baptism (?:in|of) the holy spirit .{0,30}subsequent",
    "inerrancy": r"inerran|infallible.{0,40}(?:word|scripture)|without error",
    "premillennial": r"premillennial",
    "amillennial": r"amillennial",
    "dispensational": r"dispensational",
}

MEDIA = {
    "youtube": r'href="(https?://(?:www\.)?youtube\.com/(?:@|channel/|user/|c/)[^"]+)"',
    "podcast": r'href="(https?://(?:podcasts\.apple\.com|open\.spotify\.com/show|[^"]*\.podbean\.com|[^"]*buzzsprout[^"]*|[^"]*anchor\.fm[^"]*)[^"]*)"',
    "vimeo": r'href="(https?://(?:www\.)?vimeo\.com/[^"]+)"',
}

LANGUAGES = {
    "Spanish": r"español|servicio en español|spanish (?:service|ministry|congregation)",
    "Korean": r"한국어|korean (?:service|ministry|congregation)|한인",
    "Chinese": r"中文|mandarin|cantonese|chinese (?:service|ministry|congregation)",
    "Japanese": r"日本語|japanese (?:service|ministry)",
    "Vietnamese": r"tiếng việt|vietnamese (?:service|ministry)",
    "Tagalog": r"tagalog",
    "Portuguese": r"português|portuguese (?:service|ministry)",
    "Farsi": r"farsi|persian (?:service|ministry)",
    "ASL": r"\basl\b|american sign language",
}

TIME_RE = re.compile(
    r"\b(sundays?|sun\.|saturdays?|sat\.|wednesdays?|wed\.|fridays?|fri\.)"
    r"[^\n<>{}]{0,60}?"
    r"(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))", re.I)

TRANSLATION_RE = re.compile(
    r"scripture (?:quotations?|taken|references?)[^.]{0,120}?"
    r"\b(ESV|NIV|NASB|NKJV|KJV|CSB|NLT|LSB|NET)\b", re.I | re.S)

MINISTRY = {
    "kids": r"children'?s ministry|kids ministry|childcare|nursery|awana|sunday school for (?:kids|children)",
    "youth": r"youth (?:group|ministry)|student ministr|middle school|high school ministr",
    "small_groups": r"small groups?|community groups?|life groups?|home groups?|care groups?|growth groups?",
}


def quote_around(text, match, radius=90):
    a = max(0, match.start() - radius)
    b = min(len(text), match.end() + radius)
    q = re.sub(r"\s+", " ", text[a:b]).strip()
    return ("…" if a else "") + q + ("…" if b < len(text) else "")


# a doctrinal phrase inside a refutation ("we reject infant baptism…") must
# not count as an affirmation — skip matches with negation language nearby
NEGATION_RE = re.compile(
    r"\b(?:not|no|never|neither|reject\w*|den(?:y|ies|ied)|invalidat\w*|"
    r"contrary|rather than|instead of|don'?t|disagree\w*|against|"
    r"as opposed to|unbiblical)\b", re.I)


def negated(text, m, radius=110):
    a, b = max(0, m.start() - radius), min(len(text), m.end() + radius)
    return bool(NEGATION_RE.search(text[a:b]))


def find_all(taxonomy, texts, guard_negation=False):
    """{label: {q: quote, src: page}} for every taxonomy hit across pages."""
    out = {}
    for label, pat in taxonomy.items():
        rx = re.compile(pat, re.I)
        for page, text in texts.items():
            hit = next((m for m in rx.finditer(text)
                        if not (guard_negation and negated(text, m))), None)
            if hit:
                out[label] = {"q": quote_around(text, hit), "src": page}
                break
    return out


def extract_rules(pages_html, pages_text):
    all_html = "\n".join(pages_html.values())
    p = {}
    p["confessions"] = find_all(CONFESSIONS, pages_text)
    p["affiliations"] = find_all(AFFILIATIONS, pages_text)
    p["signals"] = find_all(SIGNALS, pages_text, guard_negation=True)
    p["ministries"] = {k: bool(v) for k, v in find_all(MINISTRY, pages_text).items()}

    langs = sorted(find_all(LANGUAGES, pages_text))
    p["languages"] = (["English"] + langs) if langs else ["English"]

    times = []
    for page in ("visit", "home", "about"):
        text = pages_text.get(page, "")
        for m in TIME_RE.finditer(text):
            day = m.group(1).rstrip(".").capitalize()
            t = re.sub(r"\s+", "", m.group(2)).lower().rstrip(".")
            entry = f"{day} {t}"
            if entry not in times:
                times.append(entry)
        if times:
            break
    p["service_times"] = times[:6]

    media = {}
    for kind, pat in MEDIA.items():
        m = re.search(pat, all_html, re.I)
        if m:
            media[kind] = m.group(1)
    p["media"] = media

    m = TRANSLATION_RE.search("\n".join(pages_text.values()))
    p["translation"] = m.group(1).upper() if m else "not_stated"
    return p


# ---------------------------------------------------------------- pipeline

def domain_of(url):
    return urllib.parse.urlsplit(url).netloc.replace("www.", "").lower()


def scrape_church(name, site_url, extra):
    rec = {"id": "", "name": name, "checked": date.today().isoformat(), **extra}
    url = site_url if site_url.startswith("http") else "https://" + site_url
    try:
        final, home_html = cached_get(url)
    except Exception as e:
        rec.update({"id": domain_of(url), "site": {
            "url": url, "status": "dead", "error": type(e).__name__}})
        return rec

    rec["id"] = domain_of(final)
    home_text = to_text(home_html)
    links = extract_links(home_html, final)
    same_site = [l for l in links if l[2]]

    status = "ok"
    if re.search(r"forsale\.min\.js|abovedomains|sedoparking|parkingcrew|"
                 r"domain (?:is |may be )?for sale|hugedomains", home_html, re.I):
        status = "parked"        # the directory listing is stale
    elif len(home_text.split()) < 50 and len(same_site) < 5:
        status = "js_only"       # client-rendered app; needs a JS fallback
    elif domain_of(final) != domain_of(url):
        status = "moved"
    rec["site"] = {"url": final, "status": status}
    if status in ("parked", "js_only"):
        return rec
    pages = discover(links)
    if "beliefs" not in pages or "visit" not in pages:
        extra_links = [(u, "", True) for u in sitemap_urls(final)]
        if extra_links:
            for cat, u in discover(extra_links).items():
                pages.setdefault(cat, u)
    rec["pages"] = pages

    pages_html = {"home": home_html}
    pages_text = {"home": home_text}
    for cat, purl in list(pages.items())[:4]:
        try:
            _, ph = cached_get(purl)
            pages_html[cat] = ph
            pages_text[cat] = to_text(ph)
        except Exception:
            pages[cat] = pages[cat] + " (unfetchable)"
    rec["profile"] = extract_rules(pages_html, pages_text)
    rec["provenance"] = {"rules": "v1", "llm": None}
    return rec


def load_profiles():
    out = {}
    if os.path.exists(PROFILES):
        for line in open(PROFILES):
            if line.strip():
                r = json.loads(line)
                out[r["id"]] = r
    return out


def save_profiles(profiles):
    with open(PROFILES, "w") as f:
        for r in sorted(profiles.values(), key=lambda x: x["id"]):
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


STATE_NAMES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut",
    "DE": "Delaware", "FL": "Florida", "GA": "Georgia", "HI": "Hawaii",
    "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
    "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine",
    "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan",
    "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
    "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico",
    "NY": "New York", "NC": "North Carolina", "ND": "North Dakota",
    "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania",
    "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota",
    "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
    "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", help="locality substring filter")
    ap.add_argument("--state", help="US state abbreviation, e.g. CA")
    ap.add_argument("--near", help="lat,lng")
    ap.add_argument("--km", type=float, default=8.0)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--refresh", action="store_true",
                    help="walk the whole fleet oldest-checked first")
    ap.add_argument("--budget", type=int, default=300,
                    help="max churches per --refresh run")
    ap.add_argument("--dry", action="store_true",
                    help="print the selection and exit without fetching")
    args = ap.parse_args()

    data = json.load(open(os.path.join(APP, "data", "churches.json")))
    rows = [c for c in data["churches"] if c[6].startswith("http")]
    if args.city:
        rows = [c for c in rows if args.city.lower() in c[3].lower()]
    if args.state:
        ab = args.state.upper()
        rx = re.compile(rf"\b({ab}|{STATE_NAMES.get(ab, ab)})\b", re.I)
        rows = [c for c in rows
                if c[4] == "United States" and rx.search(c[3])]
    if args.near:
        lat, lng = (float(x) for x in args.near.split(","))

        def near(c):
            rl1, rl2 = math.radians(lat), math.radians(c[1])
            a = (math.sin((rl2 - rl1) / 2) ** 2 + math.cos(rl1) * math.cos(rl2)
                 * math.sin(math.radians(c[2] - lng) / 2) ** 2)
            return 6371 * 2 * math.asin(math.sqrt(a)) <= args.km
        near_rows = [c for c in data["churches"]
                     if c[6].startswith("http") and near(c)]
        seen = {id(c) for c in rows}
        rows = rows + [c for c in near_rows if id(c) not in seen] if args.city else near_rows
    if args.limit:
        rows = rows[:args.limit]

    # dedupe by domain up front
    by_domain = {}
    for c in rows:
        by_domain.setdefault(domain_of(c[6]), c)

    profiles = load_profiles()
    if args.refresh:
        # freshness walk: never-checked first, then stalest, capped by budget
        global CACHE_MAX_AGE_DAYS
        CACHE_MAX_AGE_DAYS = 7   # actually re-fetch what we're refreshing
        ordered = sorted(by_domain.items(),
                         key=lambda kv: (profiles.get(kv[0], {}).get("checked", ""),
                                         kv[0]))
        by_domain = dict(ordered[:args.budget])

    print(f"{len(by_domain)} unique church sites to scrape "
          f"(from {len(rows)} rows)\n")
    if args.dry:
        for dom, c in by_domain.items():
            print(f"  {dom:42s} {c[0][:40]:40s} "
                  f"last checked: {profiles.get(dom, {}).get('checked', 'never')}")
        return
    done = 0
    for dom, c in by_domain.items():
        name, lat, lng, loc, ctry, src, site = c[:7]
        done += 1
        print(f"[{done}/{len(by_domain)}] {name} ({dom})", flush=True)
        try:
            rec = scrape_church(name, site, {
                "locality": loc, "country": ctry, "directory_src": src,
                "lat": lat, "lng": lng})
        except Exception as e:   # never let one site kill a long run
            rec = {"id": dom, "name": name, "locality": loc, "country": ctry,
                   "directory_src": src, "lat": lat, "lng": lng,
                   "checked": date.today().isoformat(),
                   "site": {"url": site, "status": "error",
                            "error": type(e).__name__}}
        # a re-scrape must not drop kinship computed by kinship.py
        prev = profiles.get(rec["id"] or dom)
        if (prev and "kinship" in (prev.get("profile") or {})
                and "profile" in rec):
            rec["profile"].setdefault("kinship", prev["profile"]["kinship"])
        profiles[rec["id"] or dom] = rec
        if done % 25 == 0:
            save_profiles(profiles)
    save_profiles(profiles)
    print(f"\nwrote {PROFILES} ({len(profiles)} profiles)")

    if len(by_domain) > 25:      # aggregate stats for big runs
        from collections import Counter
        st = Counter(profiles[d]["site"]["status"] for d in by_domain
                     if d in profiles)
        ok = [profiles[d] for d in by_domain
              if d in profiles and profiles[d]["site"]["status"] == "ok"]
        print("statuses:", dict(st))
        print("with beliefs page:", sum(1 for r in ok if "beliefs" in (r.get("pages") or {})))
        print("with service times:", sum(1 for r in ok if r.get("profile", {}).get("service_times")))
        return

    # summary table
    for dom, c in by_domain.items():
        rec = profiles.get(dom) or next(
            (r for r in profiles.values() if r["name"] == c[0]), None)
        if not rec:
            continue
        st = rec["site"]["status"]
        if st != "ok":
            print(f"\n{rec['name']}: {st}")
            continue
        p = rec["profile"]
        print(f"\n{rec['name']} — {rec['site']['url']}")
        print(f"  pages: {', '.join(rec['pages']) or '—'}")
        if p["confessions"]:
            print(f"  confessions: {', '.join(p['confessions'])}")
        if p["affiliations"]:
            print(f"  affiliations: {', '.join(p['affiliations'])}")
        if p["signals"]:
            print(f"  signals: {', '.join(p['signals'])}")
        if p["service_times"]:
            print(f"  times: {'; '.join(p['service_times'])}")
        extras = [k for k, v in p["ministries"].items() if v]
        if extras:
            print(f"  ministries: {', '.join(extras)}")
        if p["languages"] != ["English"]:
            print(f"  languages: {', '.join(p['languages'])}")
        if p["media"]:
            print(f"  media: {', '.join(p['media'])}")
        if p["translation"] != "not_stated":
            print(f"  translation: {p['translation']}")


if __name__ == "__main__":
    main()
