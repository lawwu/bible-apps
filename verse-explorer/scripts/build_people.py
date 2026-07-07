#!/usr/bin/env python3
"""Build people.json for the explorer from the Theographic Bible Metadata.

Inputs (downloaded from github.com/robertrouse/theographic-bible-metadata,
CC BY-SA 4.0): people.json and verses.json (Airtable exports).

Output: verse-explorer/data/people.json
  { "people": [[key, display, [verseIdx...]], ...] }  sorted by verse count
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

def main(people_path, theo_verses_path):
    ours = json.load(open(os.path.join(ROOT, "data", "verses.json")))
    our_idx = {v: i for i, v in enumerate(ours["ids"])}

    theo_verses = json.load(open(theo_verses_path))
    rec_to_idx = {}
    for rec in theo_verses:
        osis = rec["fields"].get("osisRef")
        if osis in our_idx:
            rec_to_idx[rec["id"]] = our_idx[osis]

    people = []
    skipped = 0
    for rec in json.load(open(people_path)):
        f = rec["fields"]
        name = f.get("name")
        if not name:
            skipped += 1
            continue
        verses = sorted({rec_to_idx[r] for r in f.get("verses", []) if r in rec_to_idx})
        if not verses:
            skipped += 1
            continue
        display = f.get("displayTitle") or name
        key = f.get("slug") or f.get("personLookup") or display.lower()
        people.append([key, display, verses])

    people.sort(key=lambda p: -len(p[2]))

    out = os.path.join(ROOT, "data", "people.json")
    with open(out, "w") as fh:
        json.dump({"meta": "Theographic Bible Metadata, CC BY-SA 4.0, "
                           "github.com/robertrouse/theographic-bible-metadata",
                   "people": people}, fh, separators=(",", ":"), ensure_ascii=False)

    links = sum(len(p[2]) for p in people)
    print(f"people: {len(people)} (skipped {skipped})  verse links: {links}")
    print(f"{out.split('bible-apps/')[-1]}: {os.path.getsize(out)/1e6:.1f} MB")
    print("top:", [(p[1], len(p[2])) for p in people[:8]])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
