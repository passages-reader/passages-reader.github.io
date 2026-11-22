"""
build_books.py — turns source ebooks into the simple JSON files the reader uses.

This script is NOT part of the website. It runs once, offline, whenever we add
books. Output: site/data/books/<id>.json, one file per work.

Book JSON shape:
{
  "id": "pride-and-prejudice",
  "chapters": [
    { "title": "Chapter I",
      "paras": [ {"h": "<inline html>"}, {"h": "...", "v": 1}, {"s": 1} ] }
  ]
}
  h = paragraph text (only <em>, <strong>, <br> allowed)
  v = 1 when the paragraph is verse (keep line breaks, no indent)
  s = 1 for a scene break (* * *)

A passage's location "3.12" means chapters[3].paras[12] (both counted from 0).
"""
import json, re, sys, html
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString, Tag

SRC = Path("/home/claude/src")
OUT = Path("/home/claude/site/data/books")
OUT.mkdir(parents=True, exist_ok=True)

SKIP = {"titlepage", "imprint", "colophon", "uncopyright", "endnotes",
        "halftitlepage", "loi", "toc", "acknowledgments"}

def clean_text(s):
    return s.replace("⁠", "").replace("­", "")

def inline(node):
    """Return sanitized inline HTML for a node's children."""
    out = []
    for c in node.children:
        if isinstance(c, NavigableString):
            out.append(html.escape(clean_text(str(c)), quote=False))
        elif isinstance(c, Tag):
            et = c.get("epub:type", "")
            if c.name == "a" and "noteref" in et:
                continue
            if c.name == "br":
                out.append("<br>")
            elif c.name in ("em", "i"):
                out.append("<em>" + inline(c) + "</em>")
            elif c.name in ("strong", "b"):
                out.append("<strong>" + inline(c) + "</strong>")
            else:
                out.append(inline(c))
    return "".join(out)

def tidy(h):
    # collapse source-indentation whitespace, keep <br>
    h = re.sub(r"\s*<br>\s*", "<br>", h)
    h = re.sub(r"\s+", " ", h).strip()
    return h

def heading_text(sec):
    hg = sec.find("hgroup", recursive=False) or sec.find("hgroup")
    if hg:
        parts = [clean_text(x.get_text(" ", strip=True)) for x in hg.find_all(["h1","h2","h3","h4","h5","h6","p"])]
        return " · ".join(p for p in parts if p)
    h = sec.find(["h1","h2","h3","h4"])
    return clean_text(h.get_text(" ", strip=True)) if h else ""

def is_verse(p):
    for a in p.parents:
        if isinstance(a, Tag) and any(k in a.get("epub:type", "") for k in ("z3998:poem", "z3998:verse", "z3998:song", "z3998:hymn")):
            return True
    return False

def paras_from(root):
    """Walk a section in document order, yielding paragraph dicts."""
    paras = []
    first_h = root.find(["h1","h2","h3","h4"])
    for el in root.find_all(["p", "hr", "h3", "h4"]):
        if el.name in ("h3", "h4"):
            # a numbered part inside a story (e.g. "II") becomes a scene break
            if el is not first_h and not el.find_parent(["hgroup", "header"]) and paras:
                paras.append({"s": 1})
            continue
        if el.name == "hr":
            paras.append({"s": 1}); continue
        if el.find_parent(["hgroup", "header"]) and not is_verse(el):
            continue
        if el.find_parent("hgroup"):
            continue
        h = tidy(inline(el))
        if not h:
            continue
        d = {"h": h}
        if is_verse(el): d["v"] = 1
        paras.append(d)
    return paras

def spine(repo):
    opf = (SRC / repo / "src/epub/content.opf").read_text()
    return re.findall(r'<itemref idref="([^"]+)\.xhtml"', opf)

def roman_title(t):
    # "I · Loomings" -> "Chapter I · Loomings" ; plain "I" -> "Chapter I"
    if re.fullmatch(r"[IVXLC]+( · .*)?", t):
        return "Chapter " + t
    return t

def standard_ebook(repo, split_on_hr=False, only=None):
    chapters, part = [], ""
    for name in spine(repo):
        if name in SKIP or (only and name not in only):
            continue
        soup = BeautifulSoup((SRC / repo / f"src/epub/text/{name}.xhtml").read_text(), "lxml-xml")
        body = soup.find("body")
        sec = body.find(["section", "article"])
        title = roman_title(heading_text(sec)) if sec else ""
        paras = paras_from(sec or body)
        if not [p for p in paras if "h" in p]:
            part = title  # e.g. "Book I · Miss Brooke": a divider page, prefix next chapters
            continue
        if part and sec.get("data-parent"):
            title = f"{part} — {title}"
        if split_on_hr:
            chunk, n = [], 1
            for p in paras + [{"s": 1}]:
                if "s" in p:
                    if chunk:
                        chapters.append({"title": f"Section {n}", "paras": chunk}); n += 1
                    chunk = []
                else:
                    chunk.append(p)
        else:
            chapters.append({"title": title or name.replace("-", " ").title(), "paras": paras})
    return chapters

def keats_poem(article_id):
    soup = BeautifulSoup((SRC / "john-keats_poetry/src/epub/text/poetry.xhtml").read_text(), "lxml-xml")
    art = soup.find("article", id=article_id)
    paras = [{"h": tidy(inline(p)), "v": 1} for p in art.find_all("p") if tidy(inline(p))]
    return [{"title": art.find("h2").get_text(strip=True), "paras": paras}]

# ---------- Project Gutenberg plain text (Portuguese) ----------
def pg_text(path):
    t = path.read_bytes().decode("latin-1").replace("\r\n", "\n")
    t = t.split("*** START OF")[1].split("\n", 1)[1]
    t = re.split(r"\*\*\* ?END OF", t)[0]
    return t

def pg_para(block):
    s = re.sub(r"\s+", " ", block).strip()
    s = html.escape(s, quote=False)
    s = s.replace("--", "—")
    s = re.sub(r"_([^_]+)_", r"<em>\1</em>", s)
    return s

def pg_chapters(text, head_re):
    """Split on chapter headings. head_re must capture (number, title)."""
    chapters = []
    parts = re.split(head_re, text)
    # parts = [before, num, title, body, num, title, body, ...]
    for i in range(1, len(parts), 3):
        num, title, body = parts[i], parts[i+1], parts[i+2]
        blocks = [b for b in re.split(r"\n\s*\n", body) if b.strip()]
        paras = [{"h": pg_para(b)} for b in blocks]
        paras = [p for p in paras if p["h"] and not re.fullmatch(r"FIM\.?", p["h"])]
        # stop at the printed table of contents / Gutenberg footer at the end
        for k, p in enumerate(paras):
            if re.match(r"(INDICE|ÍNDICE|Capitulo\b|End of the Project Gutenberg)", p["h"]):
                paras = paras[:k]; break
        t = title.strip().rstrip(".")
        chapters.append({"title": f"{num.strip().rstrip('.')} · {t}", "paras": paras})
    return chapters

def dom_casmurro():
    t = pg_text(SRC / "Dom-Casmurro_55752/55752-8.txt")
    t = t.split("PARIZ", 1)[1]
    return pg_chapters(t, r"\n\n([IVXLC]+\.?)\n\n([^\n]+)\n")

def bras_cubas():
    t = pg_text(SRC / "Memorias-Posthumas-de-Braz-Cubas_54829/54829-8.txt")
    front, rest = t.split("AO LEITOR", 1)
    leitor, rest = rest.split("AO VERME", 1)
    dedic, rest = rest.split("CAPITULO I\n", 1)
    leitor_paras = [{"h": pg_para(b)} for b in re.split(r"\n\s*\n", leitor) if b.strip()]
    ded = pg_para("AO VERME " + dedic)
    ded_lines = [w.strip() for w in ("AO VERME\n" + dedic).split("\n") if w.strip()]
    chapters = [
        {"title": "Ao leitor", "paras": leitor_paras},
        {"title": "Dedicatória", "paras": [{"h": "<br>".join(html.escape(l) for l in ded_lines), "v": 1}]},
    ]
    chapters += pg_chapters("\n\nCAPITULO I\n" + rest, r"\n\nCAPITULO ([IVXLC]+)\n\s*\n([^\n]+)\n")
    return chapters

BUILDERS = {
    "pride-and-prejudice": lambda: standard_ebook("jane-austen_pride-and-prejudice"),
    "moby-dick": lambda: standard_ebook("herman-melville_moby-dick"),
    "frankenstein": lambda: standard_ebook("mary-shelley_frankenstein"),
    "the-great-gatsby": lambda: standard_ebook("f-scott-fitzgerald_the-great-gatsby"),
    "mrs-dalloway": lambda: standard_ebook("virginia-woolf_mrs-dalloway", split_on_hr=True),
    "middlemarch": lambda: standard_ebook("george-eliot_middlemarch"),
    "the-lady-with-the-dog": lambda: standard_ebook("anton-chekhov_short-fiction_constance-garnett", only={"the-lady-with-the-dog"}),
    "the-student": lambda: standard_ebook("anton-chekhov_short-fiction_constance-garnett", only={"the-student"}),
    "gooseberries": lambda: standard_ebook("anton-chekhov_short-fiction_constance-garnett", only={"gooseberries"}),
    "ode-to-a-nightingale": lambda: keats_poem("ode-to-a-nightingale"),
    "to-autumn": lambda: keats_poem("to-autumn"),
    "ode-on-a-grecian-urn": lambda: keats_poem("ode-on-a-grecian-urn"),
    "dom-casmurro": dom_casmurro,
    "memorias-postumas": bras_cubas,
}

if __name__ == "__main__":
    for bid, fn in BUILDERS.items():
        chapters = fn()
        (OUT / f"{bid}.json").write_text(json.dumps({"id": bid, "chapters": chapters}, ensure_ascii=False, separators=(",", ":")))
        n = sum(len(c["paras"]) for c in chapters)
        print(f"{bid:28} {len(chapters):4} ch {n:6} paras  first: {chapters[0]['title'][:40]!r}  last: {chapters[-1]['title'][:40]!r}")
