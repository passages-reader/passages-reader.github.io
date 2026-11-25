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

let shownOnce = false;   // false until the first chapter is on screen
let finishedSent = false;

function showChapter(index, scrollToPara = null) {
  const previous = current;
  current = Math.max(0, Math.min(index, BOOK.chapters.length - 1));
  // analytics: "chapter/moby-dick/3" = someone moved on to chapter 3
  // (counts every way of changing chapter: buttons, Contents, arrow keys)
  if (shownOnce && current !== previous) {
    track("chapter", `${bookId}/${current + 1}`);
    if (current === BOOK.chapters.length - 1) track("last-chapter", bookId);
  }
  shownOnce = true;
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
  // A typo or missing text? One tap opens an email with the work and chapter filled in.
  const where = single ? "the whole text" : `${chapter.title} (${current + 1} of ${BOOK.chapters.length})`;
  parts.push(`<p class="report-link"><a href="${esc(problemHref(INFO.title, where))}" data-report>Report a problem with this text</a></p>`);

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
  Store.setPosition(bookId, { ch: current, p: scrollToPara || 0, of: BOOK.chapters.length });
  watchPosition();
  checkFinished();
}

// analytics: "finished/<book>" once someone reaches the bottom of the last chapter
// (for a poem or short story, that means they read it to the end)
function checkFinished() {
  if (finishedSent || current !== BOOK.chapters.length - 1) return;
  const nav = readerEl.querySelector(".chapter-nav");
  if (nav && nav.getBoundingClientRect().top < window.innerHeight) {
    finishedSent = true;
    track("finished", bookId);
    Store.markFinished(bookId);       // shows under "Finished" in Your reading
  }
}

readerEl.addEventListener("click", (e) => {
  if (e.target.closest("[data-report]")) track("problem", `${bookId}/${current}`);
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
    checkFinished();
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const paras = readerEl.querySelectorAll("[data-i]");
      for (const p of paras) {
        if (p.getBoundingClientRect().bottom > 80) {
          Store.setPosition(bookId, { ch: current, p: Number(p.dataset.i), of: BOOK.chapters.length });
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

// ---------- ⓘ About this work, from inside the reader ----------
// Premise, where you are, the passage that brought you here, and Share.

const plain = (h) => (h || "").replace(/<br>/g, "\n").replace(/<[^>]+>/g, "").trim();
const wordsIn = (paras) => paras.reduce((n, x) => n + (x.h ? plain(x.h).split(/\s+/).length : 0), 0);

// "Chapter 3 of 40 · about 9 hours left" (or for a story: "about 12 minutes left")
function whereYouAre() {
  const pos = Store.position(bookId) || { ch: current, p: 0 };
  const ch = current;
  const p = pos.ch === current ? pos.p : 0;     // paragraph you're on, if it's in this chapter
  let words = wordsIn(BOOK.chapters[ch].paras.slice(p));
  for (let i = ch + 1; i < BOOK.chapters.length; i++) words += wordsIn(BOOK.chapters[i].paras);
  const left = words > 0 ? readingTime({ words, kind: INFO.kind }) + " left" : "";
  const single = BOOK.chapters.length === 1;
  return [single ? "" : `Chapter ${ch + 1} of ${BOOK.chapters.length}`, left].filter(Boolean).join(" · ");
}

function openWorkAbout() {
  track("reader-about", bookId);
  const kindLabel = INFO.kind === "poem" ? "About the poem" : INFO.kind === "story" ? "About the story" : "About the book";
  const origin = ORIGIN ? `
    <h3 class="about-label">The passage that brought you here</h3>
    <blockquote class="origin-quote">${esc(shorten(ORIGIN.text, 200))}</blockquote>
    <button class="linklike jump-link" data-to-origin>Go to this passage</button>` : "";
  openSheet(`
    <p class="eyebrow">${esc(bookMeta(INFO))}</p>
    <h2 class="about-title">${esc(INFO.title)}</h2>
    <p class="about-author">${esc(INFO.author)}</p>
    <h3 class="about-label">${kindLabel}</h3>
    <p class="about-text">${esc(INFO.premise)}</p>
    <h3 class="about-label">Where you are</h3>
    <p class="about-text">${esc(whereYouAre())}</p>
    ${origin}
    <div data-elsewhere></div>
    <div class="about-actions"><button class="btn" data-share-work>Share this ${INFO.kind === "poem" ? "poem" : INFO.kind === "story" ? "story" : "book"}</button></div>`);
  const slot = sheetContent.querySelector("[data-elsewhere]");
  if (slot && Elsewhere.applies(INFO)) slot.replaceWith(Elsewhere.block(INFO, make));
}

// Small element helper (the feed's el()), used by elsewhere.js
function make(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
  }
  n.append(...children.flat().filter(c => c != null && c !== false));
  return n;
}

// Cut long text at a whole word, with "…"
function shorten(text, limit) {
  text = text.trim();
  if (text.length <= limit) return text;
  return text.slice(0, limit).replace(/\s+\S*$/, "").replace(/[\s,;:.…]+$/, "") + "…";
}

// ---------- sharing the whole work ----------
// A short poem that fits on one picture is shared whole. Anything longer gets
// one picture (the passage you came from, or the opening) plus a link.
const WHOLE_POEM_LINES = 20;

function workText() {
  const paras = BOOK.chapters.flatMap(c => c.paras).filter(x => x.h);
  if (INFO.kind === "poem") {
    const stanzas = paras.map(x => plain(x.h));
    const lines = stanzas.join("\n").split("\n").length;
    if (BOOK.chapters.length === 1 && lines <= WHOLE_POEM_LINES) return { text: stanzas.join("\n\n"), whole: true };
    if (ORIGIN) return { text: ORIGIN.text, whole: false };
    return { text: stanzas.join("\n\n").split("\n").slice(0, 8).join("\n").trim() + "…", whole: false };
  }
  if (ORIGIN) return { text: shorten(ORIGIN.text, 420), whole: false };
  return { text: shorten(plain(paras.find(x => plain(x.h).length > 80)?.h || paras[0].h), 420), whole: false };
}

function workUrl() {
  return location.origin + location.pathname.replace(/[^/]*$/, "") + "reader.html?book=" + encodeURIComponent(bookId);
}

let workBlob = null;
function openShareWork() {
  track("share-work-open", bookId);
  const { text, whole } = workText();
  const p = { id: bookId, text, whole, bookInfo: INFO };
  workBlob = null;
  openSheet(`
    <h2 class="about-title">Share ${esc(INFO.title)}</h2>
    <div class="share-preview"><p class="muted small">Making the picture…</p></div>
    <div class="about-actions">
      <button class="btn" data-share-image>Share as image</button>
      <button class="btn ghost" data-share-link>Share link</button>
    </div>
    <p class="about-text muted small">${whole ? "The whole poem fits on the picture." : "The picture shows " + (ORIGIN ? "the passage that brought you here" : "the opening") + "; the link opens the whole " + (INFO.kind === "novel" ? "book" : INFO.kind) + "."}</p>`);
  ShareImage.make(p).then(b => {
    workBlob = b;
    const img = document.createElement("img");
    img.src = URL.createObjectURL(b); img.alt = `${INFO.title}, as a picture`;
    sheetContent.querySelector(".share-preview")?.replaceChildren(img);
  }).catch(() => sheetContent.querySelector(".share-preview")?.replaceChildren(Object.assign(document.createElement("p"), { className: "muted small", textContent: "Couldn’t make the picture on this device. The link still works." })));
}

function shareCaption() {
  const time = readingTime(INFO);
  return `${INFO.title}, ${INFO.author}.${time ? " " + time[0].toUpperCase() + time.slice(1) + " to read," : ""} free on Passages.`;
}

async function shareWorkImage() {
  if (!workBlob) return;
  track("share-work-image", bookId);
  const file = new File([workBlob], `passages-${bookId}.png`, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text: shareCaption() + " " + workUrl() }); } catch (e) {}
  } else {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(workBlob), download: file.name });
    document.body.append(a); a.click(); a.remove();
  }
}

async function shareWorkLink() {
  track("share-work", bookId);
  const url = workUrl();
  if (navigator.share) {
    try { await navigator.share({ title: `${INFO.title} — ${INFO.author}`, text: shareCaption(), url }); } catch (e) {}
  } else {
    try { await navigator.clipboard.writeText(url); alertLine("Link copied"); }
    catch (e) { prompt("Copy this link:", url); }
  }
}

// A small message at the bottom of the screen
function alertLine(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.append(t); }
  t.textContent = msg; t.classList.add("show");
  clearTimeout(alertLine.timer);
  alertLine.timer = setTimeout(() => t.classList.remove("show"), 2200);
}

document.getElementById("open-about").addEventListener("click", openWorkAbout);
sheetContent.addEventListener("click", (e) => {
  if (e.target.closest("[data-share-work]")) openShareWork();
  if (e.target.closest("[data-share-image]")) shareWorkImage();
  if (e.target.closest("[data-share-link]")) { closeSheet(); shareWorkLink(); }
  if (e.target.closest("[data-to-origin]")) { closeSheet(); track("jump", bookId); showChapter(ORIGIN.ch, ORIGIN.p); }
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
