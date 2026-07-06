#!/usr/bin/env python3
"""Precompute embedding-based related topics for the verse explorer.

Embeds every topic name from data/topics.json with a sentence-transformer,
then writes data/related.json with each topic's nearest neighbors by cosine
similarity:

  { "names": [topic...],            # aligned with topics.json key order
    "nn": [[[j, simPct], ...], ...] }  # per topic: neighbor index + sim 0-100

Run with uv (isolated env; the conda sentence-transformers is broken):

  uv run --with sentence-transformers --with "numpy<2" \
      python3 scripts/build_related.py
"""
import json
import os

import numpy as np
from sentence_transformers import SentenceTransformer

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")
TOP_K = 12
MIN_SIM = 0.45


def main():
    with open(os.path.join(DATA, "topics.json")) as f:
        names = list(json.load(f).keys())
    print(f"embedding {len(names)} topic names…")

    model = SentenceTransformer("all-MiniLM-L6-v2")
    emb = model.encode(names, normalize_embeddings=True,
                       batch_size=256, show_progress_bar=True)
    emb = np.asarray(emb, dtype=np.float32)

    print("computing neighbors…")
    sims = emb @ emb.T
    np.fill_diagonal(sims, -1.0)

    nn = []
    for i in range(len(names)):
        idx = np.argpartition(-sims[i], TOP_K)[:TOP_K]
        idx = idx[np.argsort(-sims[i][idx])]
        row = [[int(j), int(round(float(sims[i][j]) * 100))]
               for j in idx if sims[i][j] >= MIN_SIM]
        nn.append(row)

    out = os.path.join(DATA, "related.json")
    with open(out, "w") as f:
        json.dump({"names": names, "nn": nn}, f,
                  separators=(",", ":"), ensure_ascii=False)
    kept = sum(len(r) for r in nn)
    print(f"wrote {out}: {kept} neighbor links "
          f"({os.path.getsize(out) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
