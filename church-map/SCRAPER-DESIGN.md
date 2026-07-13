# Church profile scraper — design

Extend `church-map/` from "dots on a map" to **structured, sourced profiles of
what each church says about itself** — beliefs, practices, practical
metadata — kept fresh cheaply and honestly.

Feasibility (probed 2026-07 on 25 random US churches from our data): 80%
of sites reachable with a plain GET, only ~5% JS-only, and 85% of reachable
homepages link to a beliefs/about page findable by anchor-text matching.
Simple fetching covers the large majority.

## Principles

1. **Describe, don't grade.** The output is "what this church states,
   structured," never a scorecard. Every field carries a source URL, an
   evidence quote, and a retrieved date. `not_stated` is a first-class value
   and is never rendered as a negative.
2. **Touch sites gently.** Respect robots.txt; identifying User-Agent with a
   contact URL; ≤1 request/second globally; per-host caching; 2–5 pages per
   church, not a crawl.
3. **Pay for intelligence only on change.** LLM extraction runs only when a
   page's normalized-text hash changes. Church beliefs pages change rarely
   (expect low single-digit % per quarter), so steady-state cost is pennies.
4. **Everything in git.** Profiles are JSONL; every refresh is a commit with
   a human-reviewable diff. The repo's existing GitHub Pages deploy publishes
   the app data; GitHub Actions is the scheduler.

## Data model

One JSON record per church, keyed by website domain (falls back to directory
id). Compact publish format derived from this for the app.

```jsonc
{
  "id": "capitolhillbaptist.org",
  "name": "Capitol Hill Baptist Church",
  "directory": { "ninemarks": "12345", "tms": null },   // where it's listed
  "site": { "url": "https://...", "status": "ok|dead|moved|js_only",
            "last_ok": "2026-07-10", "robots_ok": true },
  "pages": {                       // discovered canonical pages
    "beliefs":  { "url": "...", "hash": "sha1", "fetched": "2026-07-10" },
    "visit":    { "url": "...", "hash": "...",  "fetched": "..." },
    "sermons":  { "url": "..." },
    "leadership": { "url": "..." }
  },
  "profile": {
    // every doctrinal field: enum + evidence quote + source page + confidence
    "denomination":   { "v": "Southern Baptist", "q": "…in friendly cooperation with the SBC…", "src": "beliefs", "c": 0.95 },
    "confessions":    ["1689 LBCF", "BFM 2000"],        // named standards
    "affiliations":   ["9Marks", "TGC", "SBC"],          // badges/links/text
    "baptism":        { "v": "credo", "q": "…baptism of believers by immersion…" },
    "polity":         { "v": "elder_led_congregational", "q": "…" },
    "soteriology":    { "v": "reformed", "q": "…unconditional election…" },
    "gifts":          { "v": "not_stated" },
    "women_in_office":{ "v": "complementarian", "q": "…" },
    "eschatology":    { "v": "not_stated" },
    // practical metadata for church seekers
    "service_times":  [{ "day": "Sun", "time": "10:30", "note": "" }],
    "languages":      ["English", "Spanish"],
    "ministries":     { "kids": true, "youth": true, "small_groups": true },
    "sermons":        { "podcast": "…", "youtube": "…" },
    "livestream":     "…",
    "translation":    "ESV",
    "founded":        1878,
    // the benchmark (see below)
    "kinship":        { "LBCF1689": 0.83, "WCF": 0.71, "BFM2000": 0.78,
                        "Heidelberg": 0.44, "AG16": 0.12 }
  },
  "provenance": { "rules": "v3", "llm": "claude-haiku-4-5", "extracted": "2026-07-10" }
}
```

Controlled vocabularies (enums) for: baptism (credo/paedo/both/not_stated),
polity (elder_led_congregational / elder_ruled / congregational /
episcopal / presbyterian / not_stated), soteriology (reformed /
arminian_leaning / lutheran / not_stated), gifts (cessationist /
continuationist / open_but_cautious / not_stated), women_in_office
(complementarian / egalitarian / not_stated), eschatology (amil / premil /
postmil / dispensational / not_stated).

## Pipeline (idempotent stages, cache-keyed)

```
seed → probe → discover → fetch → extract(rules) → extract(llm) → benchmark → validate → publish
```

1. **Seed** — the existing `build_churches.py` directory pull, monthly.
   Diff produces new/removed churches; new ones enter the probe queue.
2. **Probe** — GET homepage; classify ok / dead / moved (follow one
   redirect, record new domain) / js_only (rendered text < ~50 words).
   Rolling: 1/90 of the fleet per day ⇒ every church checked quarterly.
3. **Discover** — from homepage nav + `sitemap.xml`, score candidate links
   against a URL/anchor taxonomy:
   - beliefs: `belie|statement.of.faith|what.we.(believe|teach)|doctrine|confession|our.faith|about`
   - visit: `visit|plan.your.visit|new.here|times|location|im.new`
   - sermons: `sermon|messages|media|watch|listen`
   - leadership: `staff|leadership|elders|pastors|our.team`
4. **Fetch & normalize** — store raw HTML in a cache dir (gitignored),
   extract main text (readability-style), compute normalized-text hash.
   Send `If-None-Match`/`If-Modified-Since` when the server supports it.
   **If the hash is unchanged since last extraction, stop here.**
5. **Extract — rules pass (free, transparent):**
   - affiliations from links/badges (9marks.org, thegospelcoalition.org,
     acts29.com, sbc.net, pcanet.org, …)
   - named confessions by pattern ("1689", "Westminster", "Baptist Faith
     and Message", "Heidelberg", "Three Forms", "39 Articles", …)
   - service times regex; podcast/YouTube/livestream links; languages
     ("en Español", "한국어", …); Bible translation from copyright lines.
6. **Extract — LLM pass (only on changed beliefs/leadership text):**
   - One call per changed page (Haiku-class model, temperature 0), fixed
     JSON schema, enums only, `not_stated` default, and a **verbatim
     evidence quote required per claim**; a post-check rejects any field
     whose quote isn't found in the source text (hallucination guard).
   - Full first pass over ~7,500 churches ≈ 1–2k tokens each ⇒ tens of
     dollars once; steady state (only changed pages) ⇒ pennies/month.
7. **Benchmark — confessional kinship.** Embed each statement of faith and
   compare (cosine) against a fixed library of historic and modern
   standards: Apostles', Nicene, Westminster Confession, 1689 LBCF,
   Heidelberg, 39 Articles, Augsburg, BFM 2000, AG Fundamental Truths, etc.
   The result is a *kinship vector* — "this statement reads closest to the
   1689 (0.83)" — a measurement against public reference texts rather than
   a judgment. Same texts also feed the statement-of-faith **clustering**
   (IDEAS.md item): families, outliers, and boilerplate detection (many
   sites copy the same template statement — near-duplicate hashes find
   them). Embeddings can run locally (sentence-transformers) — free.
8. **Validate & publish** — JSON-schema check; gold-set regression (below);
   emit compact `data/profiles.json` for the app. The map then gets seeker
   filters (baptism, polity, language, kids/youth, livestream, confession)
   and a fuller popup card with "source →" links and a checked-on date.

## Keeping it fresh (the operational core)

- **Change detection before intelligence.** Hash gating means the expensive
  steps run only on the small fraction of sites that changed.
- **Tiered cadence:** directories monthly · liveness quarterly (spread
  daily) · discovered-page refetch semiannually or when homepage nav hash
  changes · manual per-church refresh hook for corrections.
- **Nightly GitHub Actions job, budget-capped** (e.g., 300 sites/night,
  ~20–30 min at 1 rps): a cursor file tracks fleet position; each run
  commits its diff. No servers, no database — the repo is the database.
- **Staleness is visible in the UI**: every profile shows "checked <date>";
  dead sites grey out rather than vanish; a `moved` status carries the new
  domain into the next seed diff.
- **Gold set:** ~50 hand-labeled churches spanning traditions. CI asserts
  extractor precision ≥0.95 on stated fields before any prompt/rules change
  merges (optimize for *saying less* over being wrong — `not_stated` beats a
  bad guess).

## Risks and ethics

- **Misrepresentation** is the big one. Mitigations: evidence quotes,
  source links, dates, `not_stated` discipline, an "Is this wrong?" link
  per profile (GitHub issue template), and profile text framed as "the
  church's own words, structured."
- **No contact-info republishing** (emails/phones), consistent with the
  existing map policy.
- **JS-only sites** (~5% from the probe): optional capped Playwright
  fallback pool, else marked `js_only` and listed without a profile.
- **Hosting platforms** (Squarespace/Wix/Clover) rate-limit aggressively:
  global politeness, per-host backoff, and honoring 429s.
- **Scope discipline**: 2–5 known pages per church, never a general crawl.

## Build order

1. ✅ `scraper/scrape.py`: probe + discover + fetch/cache + rules extractor
   with negation guard; tested on Irvine 2026-07 (found a parked domain, a
   robots.txt false-deny bug, and a refutation false-positive — all fixed).
2. ✅ `scraper/kinship.py`: confession library (Creeds.json + BFM 2000) +
   tf-idf 1–2-gram cosine. Word n-grams beat semantic embeddings here
   because statements borrow confession wording verbatim — validated on
   Berean CC, whose unnamed BFM-based statement scored 0.51 vs ≤0.14 for
   every other confession. Scores < ~0.1 across the board = custom wording.
3. ✅ App integration: profile cards in map popups (times, ministry chips,
   signal chips with evidence-quote tooltips, kinship line, stale-listing
   warnings) plus seeker filters ("find a church: kids · plural elders ·
   doctrines of grace · Spanish · …") that AND-combine over profiled
   churches.
4. ✅ Sitemap.xml fallback for thin navs; still pending: capped Playwright
   pool for `js_only` sites (33 of 542 in California ≈ 6%).
5. LLM extraction of doctrinal enums with evidence quotes + gold set.
6. ✅ (written, not yet enabled) `.github/workflows/church-profiles.yml`:
   manual-dispatch refresh with budget; `scrape.py --refresh --budget N`
   walks the fleet oldest-checked-first with a 7-day cache max-age so
   refreshed churches are actually re-fetched. Uncomment the nightly
   schedule once the state rollout below completes.

## State rollout

California ran 2026-07 as the pilot: 542 domains in ~2 h at 1 req/s →
388 ok · 74 dead · 33 js_only · 3 parked · 1 moved; 329 beliefs pages,
288 with service times; 358 kinship vectors, 39 strong (≥0.15) matches —
25 of them Baptist Faith & Message, as a Baptist-heavy directory should.

Remaining ~5,100 US domains, batched to ~2–3 h of polite crawling each
(`for s in …; do python3 scrape.py --state $s; done`, then `kinship.py`
and `publish.py` — both idempotent; re-scrapes preserve kinship):

  1. TX (429)                          5. MO KY MD CO MN (~580)
  2. FL NC (646)                       6. AL AZ KS WI MA OK LA OR (~700)
  3. OH VA PA (667)                    7. IA MS AR NJ ID UT NE CT NM (~500)
  4. GA MI WA TN (741)                 8. NY IL IN SC (~590)
  9. the long tail: ME DE NH WV MT SD NV AK HI VT WY RI DC ND (~350)
 10. international (~900 sites, needs per-country language patterns)

After batch 10, wire the GitHub Actions cron (stage 6) so the fleet stays
fresh without manual runs.
