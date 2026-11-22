"""
review_sheet.py — steps 3 and 5 of the curation pipeline.

  build  Checks the selector's candidates (candidates/*.csv) and builds one review
         sheet (review.csv) for the human reviewer.
  apply  Copies every row the reviewer marked "yes" into data/passages.csv.

Usage (from the repo root):
  python3 tools/review_sheet.py build candidates/*.csv
  python3 tools/review_sheet.py apply review.csv

Checks done in "build" (a failing candidate is dropped and reported):
  - the text appears word for word at its location
  - the location is inside the spoiler-safe zone
  - length: prose ≤ 110 words, verse ≤ 10 lines
  - controlled vocabulary for appeal / mood / themes / difficulty
  - not already in passages.csv
"""
import csv, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
ZONES = {"novel": 0.40, "story": 0.75, "poem": 1.0}
VOCAB = {
    "appeal": {"imagery", "voice", "humor", "insight", "emotion", "tension"},
    "mood": {"joyful", "tender", "melancholy", "dark", "wry", "contemplative"},
    "themes": {"love", "solitude", "ambition", "family", "childhood", "nature", "sea", "city", "death",
               "time-memory", "identity", "society", "faith", "art", "freedom", "morality"},
    "difficulty": {"1", "2", "3"},
}
CANDIDATE_COLS = ["id", "book", "location", "text", "why", "note", "appeal", "mood", "themes", "difficulty",
                  "translation", "confidence", "critic_hook", "critic_standalone", "critic_spoiler", "critic_comment"]
REVIEW_COLS = ["verdict", "your_comment", "id", "book", "position", "words", "text", "note", "why",
               "appeal", "mood", "themes", "difficulty", "confidence", "critic_hook", "critic_standalone",
               "critic_spoiler", "critic_comment", "location", "translation"]
PASSAGE_COLS = ["id", "book", "location", "text", "note", "appeal", "mood", "themes", "difficulty", "translation", "status"]

norm = lambda s: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s.replace("<br>", " "))).strip()

def book_cache():
    cache = {}
    def get(bid):
        if bid not in cache:
            cache[bid] = json.load(open(DATA / "books" / f"{bid}.json", encoding="utf-8"))
        return cache[bid]
    return get

def build(paths):
    books = {r["id"]: r for r in csv.DictReader(open(DATA / "books.csv", encoding="utf-8"))}
    existing = list(csv.DictReader(open(DATA / "passages.csv", encoding="utf-8")))
    taken_ids = {r["id"] for r in existing}
    taken_locs = {(r["book"], r["location"]) for r in existing}
    get = book_cache()
    out, problems = [], []
    for path in paths:
        for c in csv.DictReader(open(path, encoding="utf-8")):
            why = []
            b = books.get(c["book"])
            if not b:
                problems.append((c.get("id"), "unknown book")); continue
            book = get(c["book"])
            try:
                ch, pa = map(int, c["location"].split("."))
                para = book["chapters"][ch]["paras"][pa]
            except Exception:
                problems.append((c["id"], "bad location " + c["location"])); continue
            if norm(c["text"].strip("…")) not in norm(para.get("h", "")):
                why.append("text not found verbatim")
            flat = [(i, j) for i, x in enumerate(book["chapters"]) for j, y in enumerate(x["paras"]) if "h" in y]
            pos = flat.index((ch, pa)) / len(flat) if (ch, pa) in flat else 1
            if pos > ZONES[b["kind"]]:
                why.append(f"outside spoiler-safe zone ({pos:.0%})")
            lines = c["text"].count("\n") + 1
            words = len(c["text"].split())
            if (lines > 1 and lines > 10) or (lines == 1 and words > 110):
                why.append("too long")
            for field in ("appeal", "mood", "themes", "difficulty"):
                bad = [v for v in c[field].split(";") if v.strip() and v.strip() not in VOCAB[field]]
                if bad: why.append(f"unknown {field}: {bad}")
            if c["id"] in taken_ids or (c["book"], c["location"]) in taken_locs:
                why.append("already featured")
            if why:
                problems.append((c["id"], "; ".join(why))); continue
            out.append({**c, "position": f"{pos:.0%}", "words": words, "verdict": "", "your_comment": ""})
    # strongest first, by the critic's hook score
    out.sort(key=lambda r: (-int(r.get("critic_hook") or 0), r["book"]))
    with open(ROOT / "review.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=REVIEW_COLS, extrasaction="ignore"); w.writeheader(); w.writerows(out)
    print(f"review.csv: {len(out)} candidates ready for review")
    for pid, msg in problems:
        print(f"  dropped {pid}: {msg}")

def apply(path):
    rows = [r for r in csv.DictReader(open(path, encoding="utf-8")) if r["verdict"].strip().lower() in ("yes", "y")]
    with open(DATA / "passages.csv", "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=PASSAGE_COLS, extrasaction="ignore")
        for r in rows:
            w.writerow({**r, "status": "keep"})
    print(f"added {len(rows)} passages to data/passages.csv")

if __name__ == "__main__":
    cmd = sys.argv[1]
    build(sys.argv[2:]) if cmd == "build" else apply(sys.argv[2])
