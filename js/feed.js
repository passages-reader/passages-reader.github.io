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

// Shuffle the passages, but never put two from the same work next to each other.
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  for (let i = 1; i < a.length; i++) {
    if (a[i].book === a[i - 1].book) {
      const k = a.findIndex((x, idx) => idx > i && x.book !== a[i - 1].book);
      if (k > -1) [a[i], a[k]] = [a[k], a[i]];
    }
  }
  return a;
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

function renderFeed() {
  const langs = Store.languages();
  let list = LIBRARY.passages.filter(p => langs.includes(p.bookInfo.language));
  if (!list.length) list = LIBRARY.passages;      // nothing selected? show everything
  list = shuffle(list);

  // If the link points at one passage (#p=...), show it first.
  const wanted = decodeURIComponent((location.hash.match(/p=([^&]+)/) || [])[1] || "");
  const first = LIBRARY.passages.find(p => p.id === wanted);
  if (first) list = [first, ...list.filter(p => p.id !== first.id)];

  feedEl.replaceChildren(...list.map(card));
  feedEl.append(endCard());
  feedEl.scrollTop = 0;

  // First visit only: a small hint on the first card
  if (!Store.get("seenHint", false)) {
    feedEl.firstElementChild.querySelector(".card-inner")
      .append(el("p", { class: "hint" }, "Tap a passage to learn about the work · Swipe up for the next"));
    feedEl.addEventListener("scroll", () => Store.set("seenHint", true), { once: true });
  }
}

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
  );
}

// Last screen of the feed
function endCard() {
  return el("article", { class: "card end-card" },
    el("div", { class: "card-inner" },
      el("p", { class: "end-title" }, "That's every passage for now."),
      el("button", { class: "btn", onclick: renderFeed }, "Shuffle and start again"),
    ),
  );
}

// ---------- sharing ----------

async function share(p) {
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
  sheetContent.replaceChildren(...children);
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
  const b = p.bookInfo;
  const pos = Store.position(b.id);
  const startLabel = pos ? "Continue reading" : (b.kind === "poem" ? "Read the poem" : "Start reading");

  const saveBtn = el("button", { class: "btn ghost", onclick: () => {
    const on = Store.toggleSaved(p.id);
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

    el("div", { class: "about-actions" },
      el("a", { class: "btn", href: readerUrl(p, false), onclick: () => Store.setOrigin(b.id, p.id) }, startLabel),
      saveBtn,
    ),
    el("a", { class: "jump-link", href: readerUrl(p, true), onclick: () => Store.setOrigin(b.id, p.id) },
      "Already know it? Jump to this passage"),
  );
}

// Saved passages
function openSaved() {
  const ids = Store.saved();
  const items = ids.map(id => LIBRARY.passages.find(p => p.id === id)).filter(Boolean);
  openSheet(
    el("h2", { class: "about-title" }, "Saved"),
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
    el("h3", { class: "about-label" }, "Theme"),
    el("div", { class: "swatches" }, themes),
    el("p", { class: "about-text muted small" },
      "Everything here (saves, settings, your place in each book) is stored in this browser only."),
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
