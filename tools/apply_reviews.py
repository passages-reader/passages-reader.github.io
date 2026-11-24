"""
apply_reviews.py — applies a reviews file exported from editor mode
(Settings → Export my reviews) to the data files.

  verdicts, to data/passages.csv:
    cut    -> status "cut"   (hidden from the feed, kept in the file)
    maybe  -> status "maybe" (still shown; flagged for another look)
    keep   -> status "keep"
  new_note     -> replaces the passage's "Why this passage" (passages.csv, note)
  new_premise  -> on rows with id "book:<work id>", replaces the work's
                  "About the book" (books.csv, premise)
Comments are printed so they can be folded into the curation prompt.
Files exported before edits existed (no new_note column) still work.

Usage (from the repo root):  python3 tools/apply_reviews.py passages-reviews-2026-11-22.csv
"""
import csv, sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"

def load(name):
    rows = list(csv.DictReader(open(DATA / name, encoding="utf-8")))
    return rows, list(rows[0].keys())

def save(name, rows, fields):
    with open(DATA / name, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, lineterminator="\n"); w.writeheader(); w.writerows(rows)

reviews = list(csv.DictReader(open(sys.argv[1], encoding="utf-8")))
by_id = {r["id"]: r for r in reviews if not r["id"].startswith("book:")}
premises = {r["id"][5:]: r.get("new_premise", "").strip() for r in reviews if r["id"].startswith("book:")}

passages, pfields = load("passages.csv")
counts = {"keep": 0, "maybe": 0, "cut": 0}
notes = 0
for r in passages:
    rv = by_id.get(r["id"], {})
    v = rv.get("verdict", "")
    if v in counts:
        r["status"] = v; counts[v] += 1
    new = (rv.get("new_note") or "").strip()
    if new and new != r["note"]:
        r["note"] = new; notes += 1
save("passages.csv", passages, pfields)

books, bfields = load("books.csv")
changed = 0
for b in books:
    new = premises.get(b["id"])
    if new and new != b["premise"]:
        b["premise"] = new; changed += 1
save("books.csv", books, bfields)

print(counts, f"| notes edited: {notes} | premises edited: {changed}")
for r in reviews:
    if r.get("comment"):
        print(f"- {r['id']} ({r.get('verdict') or 'no verdict'}): {r['comment']}")
