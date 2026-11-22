"""
apply_reviews.py — applies a reviews file exported from editor mode
(Settings → Export my reviews) to data/passages.csv.

  cut    -> status "cut"   (hidden from the feed, kept in the file)
  maybe  -> status "maybe" (still shown; flagged for another look)
  keep   -> status "keep"
Comments are printed so they can be folded into the curation prompt.

Usage (from the repo root):  python3 tools/apply_reviews.py passages-reviews-2026-11-22.csv
"""
import csv, sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
reviews = {r["id"]: r for r in csv.DictReader(open(sys.argv[1], encoding="utf-8"))}
rows = list(csv.DictReader(open(DATA / "passages.csv", encoding="utf-8")))
counts = {"keep": 0, "maybe": 0, "cut": 0}
for r in rows:
    v = reviews.get(r["id"], {}).get("verdict", "")
    if v in counts:
        r["status"] = v; counts[v] += 1
with open(DATA / "passages.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
print(counts)
for r in reviews.values():
    if r.get("comment"):
        print(f"- {r['id']} ({r.get('verdict') or 'no verdict'}): {r['comment']}")
