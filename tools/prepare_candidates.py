"""
prepare_candidates.py — step 1 of the curation pipeline.

Turns one book into a numbered list of paragraphs the selector (an LLM) may
choose from. Because the selector picks by location and copies from this list,
it can't invent text or get a location wrong.

Only the "spoiler-safe zone" is included:
  novels  first 40% of the book (by paragraph)
  stories first 75%
  poems   everything

Usage (from the repo root):
  python3 tools/prepare_candidates.py <book-id> [--zone 0.4] > candidates/<book-id>.txt
"""
import csv, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
ZONES = {"novel": 0.40, "story": 0.75, "poem": 1.0}
MIN_WORDS, MAX_WORDS = 8, 400      # shorter = usually not enough; longer paragraphs can still be excerpted

def strip(h):
    return re.sub(r"<[^>]+>", "", h.replace("<br>", "\n"))

def main():
    book_id = sys.argv[1]
    books = {r["id"]: r for r in csv.DictReader(open(DATA / "books.csv", encoding="utf-8"))}
    info = books[book_id]
    zone = float(sys.argv[sys.argv.index("--zone") + 1]) if "--zone" in sys.argv else ZONES[info["kind"]]
    book = json.load(open(DATA / "books" / f"{book_id}.json", encoding="utf-8"))

    # already-featured locations, so they aren't proposed twice
    taken = {r["location"] for r in csv.DictReader(open(DATA / "passages.csv", encoding="utf-8")) if r["book"] == book_id}

    flat = [(ci, pi, c["title"], p) for ci, c in enumerate(book["chapters"]) for pi, p in enumerate(c["paras"]) if "h" in p]
    limit = int(len(flat) * zone)
    print(f"# {info['title']} — {info['author']} ({info['year']}, {info['kind']}, {info['language']})")
    print(f"# Spoiler-safe zone: first {zone:.0%} ({limit} of {len(flat)} paragraphs). Already featured: {sorted(taken) or 'none'}")
    print("# Format: [location | position in book | words | chapter] then the paragraph text.\n")
    for n, (ci, pi, title, p) in enumerate(flat[:limit]):
        text = strip(p["h"])
        words = len(text.split())
        loc = f"{ci}.{pi}"
        if loc in taken or not (MIN_WORDS <= words <= MAX_WORDS):
            continue
        print(f"[{loc} | {n / len(flat):.0%} | {words}w | {title}]")
        print(text + ("\n(verse)" if p.get("v") else ""))
        print()

if __name__ == "__main__":
    main()
