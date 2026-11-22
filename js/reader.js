/* ============================================================
   reader.js — shows a book one chapter at a time.

   - Opens at the beginning, or where you left off.
   - Remembers your place as you scroll (per book, in this browser).
   - Highlights the passage that brought you to the book when you reach it.
   ============================================================ */

const params = new URLSearchParams(location.search);
const bookId = params.get("book");
const fromId = params.get("from") || Store.origin(bookId);   // passage that led here
const jumpToPassage = params.get("jump") === "1";

const readerEl = document.getElementById("reader");
const sheetEl = document.getElementById("sheet");
const sheetContent = document.getElementById("sheet-content");

let BOOK = null;        // full text: { chapters: [ {title, paras: [...]}, ... ] }
let INFO = null;        // the book's row from books.csv
let ORIGIN = null;      // { ch, p } of the passage that brought the reader here
let current = 0;        // chapter index being shown

// Makes text safe to put inside HTML (titles, names)
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- drawing a chapter ----------

function showChapter(index, scrollToPara = null) {
  current = Math.max(0, Math.min(index, BOOK.chapters.length - 1));
  const chapter = BOOK.chapters[current];
  const single = BOOK.chapters.length === 1;     // a poem or short story

  const parts = [];
  parts.push(`<h1 class="chapter-title">${esc(single ? INFO.title : chapter.title)}</h1>`);
  if (single || current === 0) parts.push(`<p class="chapter-byline">${esc(INFO.author)}</p>`);

  chapter.paras.forEach((para, i) => {
    if (para.s) { parts.push(`<p class="scene-break" aria-hidden="true">⁂</p>`); return; }
    const isOrigin = ORIGIN && ORIGIN.ch === current && ORIGIN.p === i;
    const cls = [para.v ? "verse" : "", isOrigin ? "origin" : ""].join(" ").trim();
    if (isOrigin) parts.push(`<p class="origin-label">The passage that brought you here</p>`);
    // para.h is pre-cleaned at build time (only <em>, <strong>, <br>), so it's safe to insert
    // verse: each line in its own span so long lines wrap with a hanging indent
    const body = para.v ? para.h.split("<br>").map(l => `<span class="line">${l}</span>`).join("") : para.h;
    parts.push(`<p data-i="${i}" class="${cls}">${body}</p>`);
  });

  // previous / next chapter
  const nav = [];
  if (current > 0) nav.push(`<button class="btn ghost" data-go="${current - 1}">← Previous</button>`);
  if (current < BOOK.chapters.length - 1) nav.push(`<button class="btn" data-go="${current + 1}">Next chapter →</button>`);
  else nav.push(`<p class="the-end">The end.</p><a class="btn" href="index.html">Back to the feed</a>`);
  if (!single) nav.push(`<p class="progress">${current + 1} of ${BOOK.chapters.length}</p>`);
  parts.push(`<nav class="chapter-nav">${nav.join("")}</nav>`);

  readerEl.innerHTML = parts.join("");
  // A few short lines (dedication, epigraph)? Centre them, like a printed book.
  const lines = chapter.paras.flatMap(x => (x.h || "").split("<br>")).map(l => l.replace(/<[^>]+>/g, ""));
  const short = lines.length <= 12 && lines.every(l => l.length < 90);
  readerEl.classList.toggle("centered", short && !single);
  const originEl = readerEl.querySelector("p.origin");
  if (originEl && !highlightText(originEl, ORIGIN.text)) originEl.classList.add("whole");
  readerEl.lang = INFO.language;
  document.getElementById("reader-chapter").textContent = single ? "" : chapter.title;

  // scroll to a paragraph, or to the top
  const target = scrollToPara > 0 && readerEl.querySelector(`[data-i="${scrollToPara}"]`);
  if (target) {
    const label = target.previousElementSibling?.classList.contains("origin-label") ? target.previousElementSibling : target;
    label.scrollIntoView({ block: "start" });
    window.scrollBy(0, -70);      // leave room under the top bar
  } else {
    window.scrollTo(0, 0);
  }
  Store.setPosition(bookId, { ch: current, p: scrollToPara || 0 });
  watchPosition();
}

readerEl.addEventListener("click", (e) => {
  const go = e.target.closest("[data-go]");
  if (go) showChapter(Number(go.dataset.go));
});

// Wraps the exact passage text inside a paragraph in <mark>, even when it spans
// italics or line breaks. Returns false if the text can't be found.
function highlightText(paraEl, passageText) {
  const needle = passageText.replace(/^…|…$/g, "").replace(/\s*\n\s*/g, "").trim();
  const walker = document.createTreeWalker(paraEl, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let full = "";
  while (walker.nextNode()) { nodes.push({ node: walker.currentNode, start: full.length }); full += walker.currentNode.data; }
  const at = full.indexOf(needle);
  if (at < 0 || !needle) return false;
  const end = at + needle.length;
  for (const { node, start } of nodes) {
    const a = Math.max(at, start), b = Math.min(end, start + node.data.length);
    if (a >= b) continue;
    const range = document.createRange();
    range.setStart(node, a - start);
    range.setEnd(node, b - start);
    range.surroundContents(document.createElement("mark"));
  }
  return true;
}

// ---------- remembering your place ----------
// Every time you stop scrolling, save the first paragraph visible on screen.
let scrollTimer;
function watchPosition() {
  window.onscroll = () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const paras = readerEl.querySelectorAll("[data-i]");
      for (const p of paras) {
        if (p.getBoundingClientRect().bottom > 80) {
          Store.setPosition(bookId, { ch: current, p: Number(p.dataset.i) });
          break;
        }
      }
    }, 300);
  };
}

// ---------- text size ----------
function applyFontSize() {
  document.documentElement.style.setProperty("--reader-scale", Store.fontSize());
}

// ---------- panels: Contents and Text settings ----------
function openSheet(html) {
  sheetContent.innerHTML = html;
  sheetEl.hidden = false;
  requestAnimationFrame(() => sheetEl.classList.add("open"));
}
function closeSheet() {
  sheetEl.classList.remove("open");
  setTimeout(() => { sheetEl.hidden = true; }, 250);
}
sheetEl.addEventListener("click", (e) => {
  if (e.target.closest("[data-close]")) return closeSheet();
  const ch = e.target.closest("[data-ch]");
  if (ch) { closeSheet(); showChapter(Number(ch.dataset.ch)); }
  const size = e.target.closest("[data-size]");
  if (size) {
    const next = Math.min(1.6, Math.max(0.8, Store.fontSize() + Number(size.dataset.size)));
    Store.setFontSize(Math.round(next * 10) / 10);
    applyFontSize();
  }
  const theme = e.target.closest("[data-swatch]");
  if (theme) {
    Store.setTheme(theme.dataset.swatch);
    sheetContent.querySelectorAll("[data-swatch]").forEach(s => s.classList.toggle("on", s === theme));
  }
});

document.getElementById("open-toc").addEventListener("click", () => {
  const items = BOOK.chapters.map((c, i) =>
    `<li><button class="toc-item ${i === current ? "on" : ""}" data-ch="${i}">${esc(c.title)}</button></li>`).join("");
  openSheet(`<h2 class="about-title">Contents</h2><ul class="toc">${items}</ul>`);
  sheetContent.querySelector(".toc-item.on")?.scrollIntoView({ block: "center" });
});

document.getElementById("open-type").addEventListener("click", () => {
  const swatches = ["light", "sepia", "dark"].map(t =>
    `<button class="theme-swatch ${Store.theme() === t ? "on" : ""}" data-swatch="${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("");
  openSheet(`
    <h2 class="about-title">Text</h2>
    <h3 class="about-label">Size</h3>
    <div class="size-row">
      <button class="btn ghost" data-size="-0.1" aria-label="Smaller">A−</button>
      <button class="btn ghost" data-size="0.1" aria-label="Larger">A+</button>
    </div>
    <h3 class="about-label">Theme</h3>
    <div class="swatches">${swatches}</div>`);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !sheetEl.hidden) closeSheet();
  if (sheetEl.hidden && e.key === "ArrowRight") showChapter(current + 1);
  if (sheetEl.hidden && e.key === "ArrowLeft") showChapter(current - 1);
});

// ---------- start ----------
async function start() {
  if (!bookId) { location.href = "index.html"; return; }
  applyFontSize();
  const [library, book] = await Promise.all([loadLibrary(), loadBook(bookId)]);
  BOOK = book;
  INFO = library.books[bookId];
  const passage = library.passages.find(p => p.id === fromId && p.book === bookId);
  if (passage) ORIGIN = { ...parseLocation(passage.location), text: passage.text };

  document.title = `${INFO.title} — ${CONFIG.appName}`;
  // "Back" returns to the feed with the passage you came from on top
  if (passage) document.querySelector(".reader-bar a.icon-btn").href = "index.html#p=" + encodeURIComponent(passage.id);
  document.getElementById("reader-book").textContent = INFO.title;

  const saved = Store.position(bookId);
  if (jumpToPassage && ORIGIN) showChapter(ORIGIN.ch, ORIGIN.p);
  else if (saved) showChapter(saved.ch, saved.p);
  else showChapter(0);
}

start().catch(err => {
  readerEl.innerHTML = `<p class="loading">Couldn't open this book. ${err.message}</p>`;
});
