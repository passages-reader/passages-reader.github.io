"""Checks every passage in data/passages.csv appears word for word at its location.
Run:  python3 tools/check_passages.py   (from the repo folder)"""
import csv, json, re, sys
from pathlib import Path
D = Path(sys.argv[1] if len(sys.argv) > 1 else ".") / "data"
norm = lambda s: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s.replace("<br>", " "))).strip()
books = {r["id"]: r for r in csv.DictReader(open(D / "books.csv", encoding="utf-8"))}
bad = 0
for p in csv.DictReader(open(D / "passages.csv", encoding="utf-8")):
    if p["book"] not in books:
        print("UNKNOWN BOOK", p["id"]); bad += 1; continue
    ch, pa = map(int, p["location"].split("."))
    para = json.load(open(D / "books" / f"{p['book']}.json"))["chapters"][ch]["paras"][pa]
    want = norm(p["text"].strip("…"))
    if want not in norm(para.get("h", "")):
        print("MISMATCH", p["id"], p["location"]); bad += 1
    wc = len(want.split())
    print(f"ok  {p['id']:16} {wc:3} words" if want in norm(para.get('h','')) else "")
print("ALL GOOD" if not bad else f"{bad} problem(s)")
