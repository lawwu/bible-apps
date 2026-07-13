#!/usr/bin/env python3
"""A Church Nearby — combined map of two church directories.

Sources (fetched into church-map/sources/, gitignored, if absent):
  - 9Marks church search: https://www.9marks.org/church-search/
    JSON feed /feed/get-locations/{ne_lat}/{ne_lng}/{sw_lat}/{sw_lng}/…/json/
    queried once with a whole-world bounding box.
  - The Master's Seminary "Find a Church": https://tms.edu/find-a-church/
    The page server-renders every church: `.marker` divs carry data-lat/lng,
    `.location-wrapper` divs carry the details; they join on data-key.

Population data (U.S. Census Bureau, public domain):
  - CBSA population estimates, 2024 vintage (2020–2024), for every
    metropolitan and micropolitan statistical area
  - CBSA centroids from the 2023 national gazetteer

Output church-map/data/churches.json:
  - churches: [name, lat, lng, locality, country, src, website, pastor?]
      src: 0 = 9Marks, 1 = TMS, 2 = listed in both (matched by proximity
      + name overlap)
  - metros: [name, state, is_metro, lat, lng, pop2020, pop2024,
      nearest_church_km, churches_within_GAP_KM] for every CBSA —
      the app derives growth, churches per 100k, and the need metric
      (new residents per listed church) from these
  - counts by source and country

Emails and phone numbers in the sources are deliberately not republished.
"""
import csv
import io
import json
import math
import os
import re
import urllib.request
import zipfile
from collections import Counter
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SOURCES = os.path.join(APP, "sources")

NINEMARKS_URL = ("https://www.9marks.org/feed/get-locations/"
                 "85/180/-85/-180/0/0/3/json/")
TMS_URL = "https://tms.edu/find-a-church/"
CENSUS_CBSA_URL = ("https://www2.census.gov/programs-surveys/popest/datasets/"
                   "2020-2024/metro/totals/cbsa-est2024-alldata.csv")
CENSUS_GAZ_URL = ("https://www2.census.gov/geo/docs/maps-data/data/gazetteer/"
                  "2023_Gazetteer/2023_Gaz_cbsa_national.zip")
CENSUS_PLACE_URL = ("https://www2.census.gov/geo/docs/maps-data/data/gazetteer/"
                    "2023_Gazetteer/2023_Gaz_place_national.zip")

GAP_KM = 40.0        # ~25 miles
MATCH_KM = 0.7       # cross-directory duplicate distance
MIN_NAME_OVERLAP = 0.5

def _gaz_rows(zip_path):
    with zipfile.ZipFile(zip_path) as z:
        txt = [n for n in z.namelist() if n.endswith(".txt")][0]
        with io.TextIOWrapper(z.open(txt), encoding="utf-8-sig") as f:
            rdr = csv.DictReader(f, delimiter="\t")
            rdr.fieldnames = [c.strip() for c in rdr.fieldnames]
            for row in rdr:
                yield row


# One pass only — names like "Salt Lake City city" must keep their real
# "City"; compound suffixes get their own alternatives instead of iteration.
PLACE_SUFFIX_RE = re.compile(
    r"\s+(city and county|city and borough|city \(balance\)|"
    r"(?:consolidated |metro |metropolitan |unified )?government(?: \(balance\))?|"
    r"city|town|village|borough|municipality|CDP|urban county|"
    r"comunidad|zona urbana|\(balance\))$", re.I)


def norm_place(name):
    """'San Francisco city and county' → 'san francisco';
    'Indianapolis city (balance)' → 'indianapolis';
    'Salt Lake City city' → 'salt lake city';
    'Louisville/Jefferson County metro government (balance)' → 'louisville'."""
    n = name.strip().split("/")[0].strip()
    return PLACE_SUFFIX_RE.sub("", n).lower()


def load_metros():
    """Every metropolitan & micropolitan statistical area: population
    estimates (2020 and 2024) anchored at its principal city.

    The CBSA gazetteer point is the centroid of the area's LAND — for
    sprawling western metros that lands in open desert (Riverside–San
    Bernardino's is deep in the Mojave), so distances would be nonsense.
    Instead, look up the first principal city in the places gazetteer and
    fall back to the area centroid only when no place matches.
    """
    pop_path = fetch(CENSUS_CBSA_URL,
                     os.path.join(SOURCES, "cbsa-est2024-alldata.csv"))
    gaz_path = fetch(CENSUS_GAZ_URL,
                     os.path.join(SOURCES, "gaz_cbsa_2023.zip"))
    place_path = fetch(CENSUS_PLACE_URL,
                       os.path.join(SOURCES, "gaz_place_2023.zip"))

    centroids = {row["GEOID"].strip():
                 (float(row["INTPTLAT"]), float(row["INTPTLONG"]))
                 for row in _gaz_rows(gaz_path)}

    places = {}  # (state, normalized name) -> (lat, lng)
    for row in _gaz_rows(place_path):
        key = (row["USPS"].strip(), norm_place(row["NAME"]))
        places.setdefault(key, (float(row["INTPTLAT"]), float(row["INTPTLONG"])))

    # San Francisco city & county includes the Farallon Islands, which drag
    # the gazetteer's internal point into the Pacific; anchor downtown instead.
    overrides = {"San Francisco-Oakland-Fremont": (37.7749, -122.4194)}

    def city_point(cbsa_name, states):
        if cbsa_name in overrides:
            return overrides[cbsa_name]
        """Longest hyphen-prefix of the city list that names a real place."""
        parts = cbsa_name.split("/")[0].split("-")
        for k in range(len(parts), 0, -1):
            cand = "-".join(parts[:k]).strip().lower()
            for st in states:
                if (st, cand) in places:
                    return places[(st, cand)]
        return None

    metros, placed = [], 0
    with open(pop_path, encoding="latin-1") as f:
        for row in csv.DictReader(f):
            lsad = (row.get("LSAD") or "").strip()
            if lsad not in ("Metropolitan Statistical Area",
                            "Micropolitan Statistical Area"):
                continue
            code = (row.get("CBSA") or "").strip()
            if code not in centroids:
                continue
            name, _, st = (row.get("NAME") or "").rpartition(", ")
            try:
                p20 = int(row["POPESTIMATE2020"])
                p24 = int(row["POPESTIMATE2024"])
            except (KeyError, ValueError):
                continue
            pt = city_point(name, st.split("-"))
            if pt:
                placed += 1
            lat, lng = pt or centroids[code]
            metros.append({"name": name, "st": st,
                           "metro": lsad.startswith("Metro"),
                           "lat": lat, "lng": lng, "p20": p20, "p24": p24})
    print(f"  anchored at principal city: {placed}/{len(metros)}")
    return metros


def metro_stats(churches, metros):
    """Per CBSA: nearest listed church and count within GAP_KM."""
    pts = [(c["lat"], c["lng"], c["name"]) for c in churches]
    rows = []
    for m in metros:
        best, best_name, within = 1e9, "", 0
        for (clat, clng, cname) in pts:
            if abs(clat - m["lat"]) > 6 or abs(clng - m["lng"]) > 8:
                continue
            d = haversine_km(m["lat"], m["lng"], clat, clng)
            if d < best:
                best, best_name = d, cname
            if d <= GAP_KM:
                within += 1
        rows.append([m["name"], m["st"], 1 if m["metro"] else 0,
                     round(m["lat"], 3), round(m["lng"], 3),
                     m["p20"], m["p24"],
                     round(best, 1) if best < 1e9 else None,
                     within, best_name])
    return rows


def fetch(url, dest):
    if not os.path.exists(dest):
        print(f"  downloading {url}")
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as r, open(dest, "wb") as f:
            f.write(r.read())
    return dest


def haversine_km(lat1, lng1, lat2, lng2):
    rl1, rl2 = math.radians(lat1), math.radians(lat2)
    dlat = rl2 - rl1
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(rl1) * math.cos(rl2) * math.sin(dlng / 2) ** 2)
    return 6371.0 * 2 * math.asin(math.sqrt(a))


def clean(s):
    return re.sub(r"\s+", " ", (s or "")).strip(" ,")


US_STATES = {
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
    "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
    "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana",
    "maine", "maryland", "massachusetts", "michigan", "minnesota",
    "mississippi", "missouri", "montana", "nebraska", "nevada",
    "new hampshire", "new jersey", "new mexico", "new york",
    "north carolina", "north dakota", "ohio", "oklahoma", "oregon",
    "pennsylvania", "rhode island", "south carolina", "south dakota",
    "tennessee", "texas", "utah", "vermont", "virginia", "washington",
    "west virginia", "wisconsin", "wyoming", "district of columbia",
    "puerto rico",
}
COUNTRY_ALIASES = {
    "united states of america": "United States", "usa": "United States",
    "us": "United States", "u.s.a.": "United States", "u.s.": "United States",
    "estados unidos": "United States", "uk": "United Kingdom",
    "england": "United Kingdom", "scotland": "United Kingdom",
    "wales": "United Kingdom", "northern ireland": "United Kingdom",
}


def normalize_country(raw):
    c = clean(re.sub(r"[\d]+", "", raw or "")).strip(".,-– ")
    low = c.lower()
    if not c:
        return "United States"
    if low in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[low]
    if low in US_STATES or low.endswith(" county"):
        return "United States"
    return c


def load_ninemarks():
    path = fetch(NINEMARKS_URL, os.path.join(SOURCES, "9marks_world.json"))
    data = json.load(open(path))
    out = []
    for l in data["locations"]:
        try:
            lat, lng = float(l["lat"]), float(l["lng"])
        except (TypeError, ValueError):
            continue
        lines = [clean(x) for x in (l.get("address") or "").splitlines() if clean(x)]
        locality = lines[1] if len(lines) >= 3 else (lines[0] if len(lines) == 2 else "")
        country = normalize_country(lines[-1] if lines else "")
        out.append({"name": clean(l["title"]), "lat": lat, "lng": lng,
                    "locality": locality, "country": country,
                    "site": clean(l.get("website") or ""), "pastor": ""})
    return out


def load_tms():
    path = fetch(TMS_URL, os.path.join(SOURCES, "tms.html"))
    html = open(path, errors="replace").read()

    markers = {}
    for block in html.split('<div class="marker"')[1:]:
        m = re.search(r'data-key="(key-\d+)"[^>]*data-lat="([-\d.]+)" data-lng="([-\d.]+)"', block)
        if not m:
            continue
        pastor = re.search(r"Pastor-Teacher:\s*([^<]*)", block)
        site = re.search(r'Website:\s*</span>\s*<a href="([^"]+)"', block)
        markers[m.group(1)] = {
            "lat": float(m.group(2)), "lng": float(m.group(3)),
            "pastor": clean(pastor.group(1)) if pastor else "",
            "site": clean(site.group(1)) if site else "",
        }

    out = []
    section = html.split("map-locations-inner")[1]
    for block in section.split('<div class="location-wrapper"')[1:]:
        key = re.search(r'data-key="(key-\d+)"', block)
        title = re.search(r'location-trigger">\s*(.*?)\s*</a>', block, re.S)
        ps = [clean(p) for p in re.findall(r"<p>([^<]*)</p>", block)]
        if not key or key.group(1) not in markers:
            continue
        mk = markers[key.group(1)]
        name = clean(title.group(1)) if title else ""
        addr = ps[0] if ps else ""
        # occasional data-entry swap: street address in the name field
        if re.match(r"^\d", name) and addr and not re.match(r"^\d", addr):
            name, addr = addr, name
        locality = ps[1] if len(ps) > 1 else ""
        country = normalize_country(ps[2] if len(ps) > 2 else "")
        out.append({"name": name, "lat": mk["lat"], "lng": mk["lng"],
                    "locality": locality, "country": country,
                    "site": mk["site"], "pastor": mk["pastor"]})
    return out


NAME_STOP = {"church", "the", "of", "a", "an", "and", "in", "at", "bible",
             "baptist", "community", "fellowship", "chapel"}


def name_tokens(name):
    return {w for w in re.findall(r"[a-z]+", name.lower())} - NAME_STOP


def merge(nine, tms):
    """Mark churches listed in both directories (src=2 on the 9Marks record)."""
    grid = {}
    for i, c in enumerate(nine):
        grid.setdefault((round(c["lat"], 2), round(c["lng"], 2)), []).append(i)

    merged_tms = set()
    both = 0
    for ti, t in enumerate(tms):
        cand = []
        base = (round(t["lat"], 2), round(t["lng"], 2))
        for dy in (-0.01, 0, 0.01):
            for dx in (-0.01, 0, 0.01):
                cand += grid.get((round(base[0] + dy, 2), round(base[1] + dx, 2)), [])
        for ni in cand:
            n = nine[ni]
            if haversine_km(t["lat"], t["lng"], n["lat"], n["lng"]) > MATCH_KM:
                continue
            a, b = name_tokens(t["name"]), name_tokens(n["name"])
            if not a or not b:
                continue
            if len(a & b) / min(len(a), len(b)) >= MIN_NAME_OVERLAP:
                n["src"] = 2
                if not n["pastor"]:
                    n["pastor"] = t["pastor"]
                merged_tms.add(ti)
                both += 1
                break

    churches = []
    for n in nine:
        churches.append({**n, "src": n.get("src", 0)})
    for ti, t in enumerate(tms):
        if ti not in merged_tms:
            churches.append({**t, "src": 1})
    print(f"  matched in both directories: {both}")
    return churches


def main():
    print("loading 9Marks…")
    nine = load_ninemarks()
    print(f"  {len(nine):,} churches")
    print("loading TMS…")
    tms = load_tms()
    print(f"  {len(tms):,} churches")

    churches = merge(nine, tms)
    print("loading census CBSA estimates…")
    metros = load_metros()
    print(f"  {len(metros):,} statistical areas")
    stats = metro_stats(churches, metros)

    by_country = Counter(c["country"] for c in churches)
    rows = []
    for c in churches:
        row = [c["name"], round(c["lat"], 4), round(c["lng"], 4),
               c["locality"], c["country"], c["src"], c["site"]]
        if c["pastor"]:
            row.append(c["pastor"])
        rows.append(row)

    out = {
        "meta": {
            "built": date.today().isoformat(),
            "counts": {
                "total": len(rows),
                "ninemarks": sum(1 for c in churches if c["src"] in (0, 2)),
                "tms": sum(1 for c in churches if c["src"] in (1, 2)),
                "both": sum(1 for c in churches if c["src"] == 2),
                # country strings are free-text; count only those appearing
                # at least twice to keep junk out of the headline number
                "countries": sum(1 for n in by_country.values() if n >= 2),
                "us": by_country.get("United States", 0),
            },
            "gap_km": GAP_KM,
            "census": "U.S. Census Bureau CBSA estimates, 2024 vintage "
                      "(POPESTIMATE2020/2024); 2023 gazetteer centroids",
        },
        "churches": rows,
        "metros": stats,
    }
    os.makedirs(os.path.join(APP, "data"), exist_ok=True)
    dest = os.path.join(APP, "data", "churches.json")
    json.dump(out, open(dest, "w"), separators=(",", ":"), ensure_ascii=False)
    print(f"wrote {dest} ({os.path.getsize(dest) // 1024}K)")

    print("\ncounts:", out["meta"]["counts"])
    print("top countries:", by_country.most_common(8))

    ms = [r for r in stats if r[2] == 1]  # metropolitan only
    gaps = [r for r in ms if (r[7] or 1e9) > GAP_KM]
    print(f"metro areas: {len(ms)} · no church within {GAP_KM:.0f} km: {len(gaps)}")
    for r in gaps:
        print(f"  {r[0]} — nearest {r[7]} km")
    need = sorted((r for r in ms if r[6] > r[5]),
                  key=lambda r: -(r[6] - r[5]) / max(r[8], 1))
    print("growing & underserved (new residents per listed church):")
    for r in need[:12]:
        added = r[6] - r[5]
        print(f"  {r[0]}: +{added:,} people, {r[8]} churches → "
              f"{added // max(r[8], 1):,}/church")


if __name__ == "__main__":
    main()
