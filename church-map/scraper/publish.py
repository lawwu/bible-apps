#!/usr/bin/env python3
"""Publish scraped church profiles for the map app.

Reads church-map/data/profiles.jsonl (full records, quote-backed) and emits
church-map/data/profiles.json — a compact map keyed by website domain with
just what the popup and filters need. Evidence quotes are kept (trimmed)
because the UI shows them as tooltips: every claim remains sourced.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
SRC = os.path.join(APP, "data", "profiles.jsonl")
DEST = os.path.join(APP, "data", "profiles.json")

KIN_MIN = 0.15   # below this, "closest confession" is noise — omit


def main():
    out = {}
    for line in open(SRC):
        if not line.strip():
            continue
        r = json.loads(line)
        dom = r["id"]
        status = r.get("site", {}).get("status", "error")
        rec = {"st": status, "chk": r.get("checked", "")}
        if status != "ok":
            out[dom] = rec
            continue
        p = r.get("profile", {})
        if r.get("pages", {}).get("beliefs"):
            rec["b"] = r["pages"]["beliefs"]
        if p.get("service_times"):
            rec["t"] = p["service_times"][:4]
        mins = [k for k, v in (p.get("ministries") or {}).items() if v]
        if mins:
            rec["min"] = mins
        if p.get("signals"):
            rec["sig"] = {k: {"q": v["q"][:140], "src": v["src"]}
                          for k, v in p["signals"].items()}
        if p.get("confessions"):
            rec["conf"] = sorted(p["confessions"])
        if p.get("affiliations"):
            rec["aff"] = sorted(p["affiliations"])
        if p.get("languages") and p["languages"] != ["English"]:
            rec["lang"] = p["languages"]
        if p.get("media"):
            rec["med"] = p["media"]
        if p.get("translation") not in (None, "not_stated"):
            rec["tr"] = p["translation"]
        kin = (p.get("kinship") or {}).get("scores") or {}
        if kin:
            name, score = max(kin.items(), key=lambda kv: kv[1])
            if score >= KIN_MIN:
                rec["kin"] = [name, round(score, 2)]
        out[dom] = rec

    json.dump(out, open(DEST, "w"), separators=(",", ":"), ensure_ascii=False)
    n_ok = sum(1 for v in out.values() if v["st"] == "ok")
    print(f"wrote {DEST}: {len(out)} profiles ({n_ok} ok), "
          f"{os.path.getsize(DEST) // 1024}K")


if __name__ == "__main__":
    main()
