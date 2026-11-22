"""
book_stats.py — counts the words in every book and writes them to the
`words` column of data/books.csv (used to show reading time).

Run from the repo root after adding or rebuilding a book:
  python3 tools/book_stats.py
"""
import csv, json, re
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
rows = list(csv.DictReader(open(DATA / "books.csv", encoding="utf-8")))
cols = list(rows[0].keys())
if "words" not in cols: cols.insert(cols.index("premise"), "words")
if "pace" not in cols: cols.append("pace")

for r in rows:
    book = json.load(open(DATA / "books" / f"{r['id']}.json", encoding="utf-8"))
    text = " ".join(re.sub(r"<[^>]+>", " ", p["h"]) for c in book["chapters"] for p in c["paras"] if "h" in p)
    r["words"] = len(text.split())
    r.setdefault("pace", "")
    print(f"{r['id']:28} {r['words']:>7} words")

with open(DATA / "books.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader(); w.writerows(rows)
