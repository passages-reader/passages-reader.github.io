/* ============================================================
   feed.js — builds the feed and handles everything on it:
   showing passages, the "About this work" panel, saving,
   sharing, the Saved list and Settings.
   ============================================================ */

let LIBRARY = null;          // { books, passages } once loaded
const feedEl = document.getElementById("feed");
const sheetEl = document.getElementById("sheet");
const sheetContent = document.getElementById("sheet-content");

document.getElementById("wordmark").textContent = CONFIG.appName;
document.title = CONFIG.appName;

// ---------- small helpers ----------

const capitalize = (t) => t ? t[0].toUpperCase() + t.slice(1) : t;

// Creates an element: el("p", {class: "x"}, "text", childEl, ...)
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) node.append(c);
  return node;
}

const ICONS = {
  save: '<svg viewBox="0 0 24 24"><path d="M6 3.5h12v17l-6-4.2-6 4.2z"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12.5v7h14v-7"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.6v.1"/></svg>',
};
function iconButton(name, label, onclick) {
  const b = el("button", { class: "icon-btn", "aria-label": label, title: label, onclick });
  b.innerHTML = ICONS[name];
  return b;
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 1800);
}

// The link that opens a passage directly, e.g. .../#p=pp-truth
function passageUrl(p) {
  return location.origin + location.pathname + "#p=" + encodeURIComponent(p.id);
}

function readerUrl(p, jump) {
  return "reader.html?book=" + encodeURIComponent(p.book) +
         "&from=" + encodeURIComponent(p.id) + (jump ? "&jump=1" : "");
}

// ---------- building the feed ----------
// The feed is built a few cards at a time. Each next card is chosen by
// Taste.pickNext (js/taste.js): random at first, then leaning toward
// what this reader has shown interest in, with some randomness mixed in.

let remaining = [];          // passages not yet added to the feed this visit
const BATCH = 4;             // cards added at a time

function renderFeed() {
  // Settings filters: languages and forms (novels / stories / poems), minus anything marked "Not for me"
  const langs = Store.languages(), kinds = Store.kinds(), nope = Taste.notForMe();
  remaining = LIBRARY.passages.filter(p =>
    langs.includes(p.bookInfo.language) && kinds.includes(p.bookInfo.kind) && !nope.has(p.id));
  if (!remaining.length) remaining = LIBRARY.passages.filter(p => !nope.has(p.id));   // filters exclude everything? show all
  feedEl.replaceChildren();

  // If the link points at one passage (#p=...), show it first.
  const wanted = decodeURIComponent((location.hash.match(/p=([^&]+)/) || [])[1] || "");
  const first = LIBRARY.passages.find(p => p.id === wanted);
  if (first) { addCard(first); remaining = remaining.filter(p => p.id !== first.id); }

  // First visit: the welcome card goes first (or second, after a shared passage)
  if (!Store.get("seenWelcome", false) && !Editor.enabled()) {
    feedEl.append(document.getElementById("welcome-template").content.cloneNode(true));
    feedEl.querySelectorAll("[data-feedback]").forEach(a => { a.href = feedbackHref(); a.target = "_blank"; });
    Store.set("seenWelcome", true);
    Store.set("seenHint", true);       // the welcome card already explains swiping and tapping
    track("welcome", "shown");
  }

  addMore();
  feedEl.scrollTop = 0;

  // A small hint on the first card, for anyone who skipped the welcome card
  if (!Store.get("seenHint", false) && !Editor.enabled()) {
    feedEl.firstElementChild.querySelector(".card-inner")
      .append(el("p", { class: "hint" }, "Tap a passage to learn about the work · Swipe up for the next"));
    feedEl.addEventListener("scroll", () => Store.set("seenHint", true), { once: true });
  }
}

function addCard(p) {
  const c = card(p);
  feedEl.append(c);
  viewObserver.observe(c);
}

// Adds the next few cards (or the end card when everything has been shown)
function addMore() {
  for (let i = 0; i < BATCH; i++) {
    const last = feedEl.querySelector(".card[data-id]:last-of-type");
    const lastBook = last && LIBRARY.passages.find(p => p.id === last.dataset.id)?.book;
    const pool = Editor.enabled() ? Editor.unreviewedFirst(remaining) : remaining;
    const shownKinds = [...feedEl.querySelectorAll(".card[data-id]")]
      .map(c => LIBRARY.passages.find(p => p.id === c.dataset.id)?.bookInfo.kind);
    const next = Taste.pickNext(pool, feedEl.children.length, lastBook, shownKinds);
    if (!next) {
      if (!feedEl.querySelector(".end-card")) feedEl.append(endCard());
      return;
    }
    remaining = remaining.filter(p => p !== next);
    addCard(next);
  }
}

// Watches which card is on screen:
//  - counts a "view" once per visit (analytics)
//  - measures how long it stayed: quick swipe = skip, long look = linger (taste)
//  - adds more cards when the reader gets close to the end
const viewed = new Set();
const shownAt = new Map();
const viewObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    const id = e.target.dataset.id;
    if (!id) continue;
    const p = LIBRARY.passages.find(x => x.id === id);
    if (e.isIntersecting) {
      shownAt.set(id, Date.now());
      if (!viewed.has(id)) { viewed.add(id); track("view", id); Taste.markSeen(id); }
      // Keep the address pointing at the passage on screen, so going back from a book
      // (or reloading) returns to this passage instead of a fresh shuffle
      history.replaceState(null, "", "#p=" + encodeURIComponent(id));
      const cards = [...feedEl.children];
      if (cards.indexOf(e.target) >= cards.length - 3) addMore();
    } else if (shownAt.has(id)) {
      const seconds = (Date.now() - shownAt.get(id)) / 1000;
      shownAt.delete(id);
      if (seconds < 1.5) Taste.learn(p, "skip");
      else if (seconds > 6) Taste.learn(p, "linger");
    }
  }
}, { threshold: 0.6 });

// One full-screen passage
function card(p) {
  const b = p.bookInfo;
  const words = p.text.split(/\s+/).length;
  const size = words < 35 ? "size-l" : words < 75 ? "size-m" : "size-s";
  const isVerse = p.text.includes("\n");
  const hasTranslation = !!p.translation;
  let showingTr = hasTranslation && Store.showTranslation(p.id);

  const text = el("blockquote", {
    // all-caps verse (like a dedication page) is centred, as it was printed
    class: `passage ${isVerse ? "size-m verse" : size} ${isVerse && p.text === p.text.toUpperCase() ? "centered" : ""}`,
    lang: showingTr ? "en" : b.language,
  });
  // Poems: each line is its own block, so long lines wrap with a hanging indent
  const fill = (t) => isVerse
    ? text.replaceChildren(...t.split("\n").map(line => el("span", { class: "line" }, line)))
    : (text.textContent = t);
  fill(showingTr ? p.translation : p.text);

  const trButton = hasTranslation && el("button", {
    class: "tr-toggle",
    onclick: (e) => {
      e.stopPropagation();
      showingTr = !showingTr;
      if (showingTr) { track("translate", p.id); Taste.learn(p, "translate"); }
      Store.setShowTranslation(p.id, showingTr);
      fill(showingTr ? p.translation : p.text);
      text.lang = showingTr ? "en" : b.language;
      trButton.textContent = showingTr ? "Show original" : "Show translation";
      trNote.hidden = !showingTr;
    },
  }, showingTr ? "Show original" : "Show translation");
  const trNote = hasTranslation && el("p", { class: "tr-note", hidden: !showingTr }, "AI translation");

  const saveBtn = iconButton("save", "Save", (e) => {
    e.stopPropagation();
    const on = Store.toggleSaved(p.id);
    if (on) { track("save", p.id); Taste.learn(p, "save"); }
    saveBtn.classList.toggle("on", on);
    toast(on ? "Saved" : "Removed from saved");
  });
  saveBtn.classList.toggle("on", Store.isSaved(p.id));

  const shareBtn = iconButton("share", "Share", (e) => { e.stopPropagation(); share(p); });
  const infoBtn = iconButton("info", "About this work", (e) => { e.stopPropagation(); openAbout(p); });

  return el("article", { class: "card", "data-id": p.id, onclick: () => openAbout(p) },
    el("div", { class: "card-inner" },
      text,
      hasTranslation ? el("div", { class: "tr-row" }, trButton, trNote) : null,
    ),
    el("footer", { class: "card-foot" },
      el("div", { class: "work" },
        el("span", { class: "work-title" }, b.title),
        el("span", { class: "work-author" }, b.author),
      ),
      el("div", { class: "card-actions" }, saveBtn, shareBtn, infoBtn),
    ),
    // editor mode only: Keep / Maybe / Cut / Note (see js/editor.js)
    Editor.enabled() ? Editor.bar(p, () => goToNextCard(p.id)) : null,
  );
}

// After a verdict in editor mode, glide to the next passage
function goToNextCard(id) {
  const cardEl = feedEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
  const next = cardEl && cardEl.nextElementSibling;
  if (next) setTimeout(() => next.scrollIntoView({ behavior: "smooth" }), 350);
}

// Last screen of the feed
function endCard() {
  return el("article", { class: "card end-card" },
    el("div", { class: "card-inner" },
      el("p", { class: "end-title" }, "That's every passage for now."),
      el("p", { class: "about-text muted" }, "More are added regularly. Did any of them make you want to read on? I'd love to know."),
      el("a", { class: "btn ghost", href: feedbackHref(), target: "_blank", rel: "noopener", onclick: () => track("feedback", "end-card") }, "Send feedback"),
      el("button", { class: "btn", onclick: () => { history.replaceState(null, "", location.pathname); renderFeed(); } }, "Start again"),
    ),
  );
}

// ---------- sharing ----------

async function share(p) {
  track("share", p.id);
  Taste.learn(p, "share");
  const url = passageUrl(p);
  const title = `${p.bookInfo.title} — ${p.bookInfo.author}`;
  if (navigator.share) {
    try { await navigator.share({ title, text: p.text.slice(0, 140), url }); } catch (e) {}
  } else {
    try { await navigator.clipboard.writeText(url); toast("Link copied"); }
    catch (e) { prompt("Copy this link:", url); }
  }
}

// ---------- the sliding panel ----------

function openSheet(...children) {
  // Skip empty pieces (e.g. the editor section when editor mode is off),
  // otherwise the browser would print them as the word "null".
  sheetContent.replaceChildren(...children.flat().filter(c => c != null && c !== false));
  sheetEl.hidden = false;
  requestAnimationFrame(() => sheetEl.classList.add("open"));
  sheetEl.querySelector(".sheet-panel").scrollTop = 0;
}
function closeSheet() {
  sheetEl.classList.remove("open");
  setTimeout(() => { sheetEl.hidden = true; }, 250);
}
sheetEl.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeSheet(); });

// "About this work": spoiler-free premise + why this passage + Start reading
function openAbout(p) {
  track("about", p.id);
  Taste.learn(p, "about");
  const b = p.bookInfo;
  const pos = Store.position(b.id);
  const startLabel = pos ? "Continue reading" : (b.kind === "poem" ? "Read the poem" : "Start reading");

  const saveBtn = el("button", { class: "btn ghost", onclick: () => {
    const on = Store.toggleSaved(p.id);
    if (on) { track("save", p.id); Taste.learn(p, "save"); }
    saveBtn.textContent = on ? "Saved" : "Save passage";
    const cardBtn = feedEl.querySelector(`[data-id="${CSS.escape(p.id)}"] .card-actions .icon-btn`);
    if (cardBtn) cardBtn.classList.toggle("on", on);
  } }, Store.isSaved(p.id) ? "Saved" : "Save passage");

  openSheet(
    el("p", { class: "eyebrow" }, bookMeta(b)),
    el("h2", { class: "about-title" }, b.title),
    el("p", { class: "about-author" }, b.author),

    el("h3", { class: "about-label" }, "Why this passage"),
    el("p", { class: "about-text" }, p.note),

    el("h3", { class: "about-label" }, b.kind === "poem" ? "About the poem" : b.kind === "story" ? "About the story" : "About the book"),
    el("p", { class: "about-text" }, b.premise),

    // How long it takes, plus an honest note on pace when there is one (books.csv "pace" column)
    el("h3", { class: "about-label" }, "Reading it"),
    el("p", { class: "about-text" },
      capitalize(readingTime(b)) + " to read" + (b.pace ? ". " + b.pace : ".")),

    el("div", { class: "about-actions" },
      el("a", { class: "btn", href: readerUrl(p, false), onclick: () => { Store.setOrigin(b.id, p.id); track("start", b.id); track("start-from", p.id); Taste.learn(p, "start"); } }, startLabel),
      saveBtn,
    ),
    el("a", { class: "jump-link", href: readerUrl(p, true), onclick: () => { Store.setOrigin(b.id, p.id); track("jump", b.id); } },
      "Already know it? Jump to this passage"),
    el("button", { class: "linklike nope-link", onclick: () => notForMe(p) }, "Not for me"),
  );
}

// "Not for me": the feed learns from it, the passage won't come back, and we move on to the next one
function notForMe(p) {
  Taste.markNotForMe(p);
  track("nope", p.id);
  closeSheet();
  toast("Got it. You'll see less like this.");
  const cardEl = feedEl.querySelector(`[data-id="${CSS.escape(p.id)}"]`);
  const next = cardEl && cardEl.nextElementSibling;
  if (next) setTimeout(() => {
    next.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => cardEl.remove(), 600);
  }, 250);
}

// Saved passages
function openSaved() {
  const ids = Store.saved();
  const items = ids.map(id => LIBRARY.passages.find(p => p.id === id)).filter(Boolean);

  // Works you've started, most recent first, so you can pick up where you left off
  const reading = Store.booksInProgress().filter(r => LIBRARY.books[r.book]);
  const readingList = reading.length && el("ul", { class: "saved-list reading-list" }, reading.map(r => {
    const b = LIBRARY.books[r.book];
    const where = r.of > 1 ? `Chapter ${r.ch + 1} of ${r.of}` : (b.kind === "poem" ? "Poem" : "Story");
    return el("li", {},
      el("a", { class: "saved-item", href: "reader.html?book=" + encodeURIComponent(r.book) },
        el("span", { class: "reading-title" }, b.title),
        el("span", { class: "saved-work" }, `${b.author} · ${where}`),
      ));
  }));

  openSheet(
    el("h2", { class: "about-title" }, "Your reading"),
    readingList ? el("h3", { class: "about-label" }, "Continue reading") : null,
    readingList || null,
    el("h3", { class: "about-label" }, "Saved passages"),
    items.length
      ? el("ul", { class: "saved-list" }, items.map(p =>
          el("li", {},
            el("button", { class: "saved-item", onclick: () => { closeSheet(); goToPassage(p.id); } },
              el("span", { class: "saved-text" }, p.text.replace(/\n/g, " / ")),
              el("span", { class: "saved-work" }, `${p.bookInfo.title} · ${p.bookInfo.author}`),
            ))))
      : el("p", { class: "about-text muted" }, "Nothing saved yet. Tap the bookmark on any passage to keep it here."),
  );
}

// Scroll the feed to a passage (rebuilding the feed if it's filtered out)
function goToPassage(id) {
  let target = feedEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (!target) { location.hash = "p=" + id; renderFeed(); target = feedEl.firstElementChild; }
  target.scrollIntoView({ behavior: "smooth" });
}

// Settings: languages and colour theme
function openSettings() {
  const langs = new Set(Store.languages());
  const langBoxes = Object.entries(LANGUAGE_NAMES).map(([code, name]) =>
    el("label", { class: "check" },
      el("input", { type: "checkbox", checked: langs.has(code), onchange: (e) => {
        e.target.checked ? langs.add(code) : langs.delete(code);
        Store.setLanguages([...langs]);
        renderFeed();
      } }),
      name));

  const kinds = new Set(Store.kinds());
  const kindBoxes = [["novel", "Novels"], ["story", "Short stories"], ["poem", "Poems"]].map(([code, name]) =>
    el("label", { class: "check" },
      el("input", { type: "checkbox", checked: kinds.has(code), onchange: (e) => {
        e.target.checked ? kinds.add(code) : kinds.delete(code);
        Store.setKinds([...kinds]);
        renderFeed();
      } }),
      name));

  const themes = ["light", "sepia", "dark"].map(t =>
    el("button", {
      class: "theme-swatch" + (Store.theme() === t ? " on" : ""),
      "data-swatch": t,
      onclick: (e) => {
        Store.setTheme(t);
        sheetContent.querySelectorAll(".theme-swatch").forEach(s => s.classList.toggle("on", s === e.currentTarget));
      },
    }, t[0].toUpperCase() + t.slice(1)));

  openSheet(
    el("h2", { class: "about-title" }, "Settings"),
    el("h3", { class: "about-label" }, "Show passages in"),
    el("div", { class: "checks" }, langBoxes),
    el("h3", { class: "about-label" }, "Show me"),
    el("div", { class: "checks" }, kindBoxes),
    el("h3", { class: "about-label" }, "Theme"),
    el("div", { class: "swatches" }, themes),
    el("h3", { class: "about-label" }, "Your feed"),
    el("label", { class: "check" },
      el("input", { type: "checkbox", checked: Taste.enabled(), onchange: (e) => Taste.setEnabled(e.target.checked) }),
      "Learn what I like and show more of it"),
    el("button", { class: "btn ghost reset-btn", onclick: () => {
      Taste.reset(); toast("Your feed has been reset"); renderFeed(); closeSheet();
    } }, "Reset what it has learned"),
    el("p", { class: "about-text muted small reset-note" }, "Resetting also brings back passages you marked “Not for me”."),
    Editor.settingsSection(),
    el("p", { class: "about-text muted small" },
      "Everything here (saves, settings, your place in each book) is stored in this browser only."),
    el("p", { class: "settings-links" },
      el("a", { href: feedbackHref(), target: "_blank", rel: "noopener", onclick: () => track("feedback", "settings") }, "Send feedback"),
      el("a", { href: "about.html" }, "About this project"),
      el("button", { class: "linklike", onclick: () => {
        Store.set("seenWelcome", false); closeSheet(); location.hash = ""; renderFeed();
      } }, "Read the welcome note again"),
    ),
  );
}

document.getElementById("open-saved").addEventListener("click", openSaved);
document.getElementById("open-settings").addEventListener("click", openSettings);

// ---------- keyboard (desktop): ↑/↓ or j/k to move, Enter for info, Esc to close ----------
document.addEventListener("keydown", (e) => {
  if (!sheetEl.hidden) { if (e.key === "Escape") closeSheet(); return; }
  const cards = [...feedEl.children];
  const current = Math.round(feedEl.scrollTop / feedEl.clientHeight);
  if (["ArrowDown", "j", "PageDown", " "].includes(e.key)) {
    e.preventDefault(); cards[Math.min(current + 1, cards.length - 1)]?.scrollIntoView({ behavior: "smooth" });
  } else if (["ArrowUp", "k", "PageUp"].includes(e.key)) {
    e.preventDefault(); cards[Math.max(current - 1, 0)]?.scrollIntoView({ behavior: "smooth" });
  } else if (e.key === "Enter") {
    cards[current]?.click();
  }
});

// ---------- start ----------
loadLibrary()
  .then(lib => { LIBRARY = lib; renderFeed(); })
  .catch(err => {
    feedEl.innerHTML = "";
    feedEl.append(el("p", { class: "loading" },
      "Couldn't load the passages. If you opened index.html straight from your computer, " +
      "use the GitHub Pages link instead (browsers block loading data files from local files). " + err.message));
  });