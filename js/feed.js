/* ============================================================
   feed.js — builds the feed and handles everything on it:
   showing passages, the "About this work" panel, saving,
   sharing, the Saved list and Settings.
   ============================================================ */

let LIBRARY = null;          // { books, passages } once loaded
const feedEl = document.getElementById("feed");
const sheetEl = document.getElementById("sheet");
const sheetContent = document.getElementById("sheet-content");

document.getElementById("wordmark").firstChild.textContent = CONFIG.appName;   // keeps the clay dot after it
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

// A short message at the bottom of the screen. Pass an action to add a
// button, e.g. toast("Removed", { label: "Undo", run: () => ... })
function toast(msg, action) {
  const t = document.getElementById("toast");
  t.replaceChildren(msg);
  t.classList.toggle("has-action", !!action);
  if (action) {
    t.append(el("button", { class: "toast-action", onclick: () => {
      t.classList.remove("show"); action.run();
    } }, action.label));
  }
  t.classList.add("show");
  clearTimeout(toast.timer);
  const time = action ? 4500 : msg.length > 30 ? 4000 : 1800;   // longer messages stay longer
  toast.timer = setTimeout(() => t.classList.remove("show"), time);
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
  stopped = false;
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
    track("welcome", "shown");
  }

  // Passage of the day: first card of the day's first visit (after the welcome card on a first visit)
  if (!first && !Editor.enabled()) {
    const done = Store.finished();
    const daily = Daily.passageOfTheDay(remaining.filter(p => !(p.book in done)));
    if (daily && Daily.shouldShowToday()) {
      addCard(daily);
      feedEl.lastElementChild.querySelector(".card-inner")
        .prepend(el("p", { class: "daily-label" }, "Passage of the day"));
      remaining = remaining.filter(p => p.id !== daily.id);
      track("daily", daily.id);
    }
  }

  addMore();
  feedEl.scrollTop = 0;

  // For new visitors: a hint on the first two passages, until they've swiped through a few
  if (!Store.get("seenHint", false) && !Editor.enabled()) {
    [...feedEl.querySelectorAll(".card[data-id]")].slice(0, 2).forEach(c => {
      const inner = c.querySelector(".card-inner");
      const hint = el("p", { class: "hint" }, "Tap the passage to learn about the work", el("br"),
        el("span", { class: "hint-swipe" }, "Swipe up for the next ↑"));
      inner.append(hint);
      // A long poem leaves no room: drop the hint rather than cut off the passage
      if (inner.scrollHeight > inner.clientHeight + 2) hint.remove();
    });
  }
}

function addCard(p) {
  const c = card(p);
  feedEl.append(c);
  viewObserver.observe(c);
}

// Adds the next few cards (or the end card when everything has been shown)
function addMore() {
  if (stopped) return;
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
      if (!viewed.has(id)) {
        viewed.add(id); track("view", id); Taste.markSeen(id);
        if (viewed.size >= 3) Store.set("seenHint", true);   // they've got the hang of it
        // Every 15 passages, a pause card goes right after this one (never in editor mode)
        if (Sitting.viewed(p) && !Editor.enabled()) e.target.after(pauseCard());
      }
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
    if (on) pointToSaved();
    if (on && shouldAskWhy(p)) askWhy(p);
    else { closeWhy(); toast(on ? savedMessage() : "Removed from saved"); }
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
        el("span", { class: "work-author" }, b.author, Store.isFinished(b.id) ? el("span", { class: "read-mark" }, " · Read") : null),
      ),
      el("div", { class: "card-actions" }, saveBtn, shareBtn, infoBtn),
    ),
    // editor mode only: Keep / Maybe / Cut / Note (see js/editor.js)
    Editor.enabled() ? Editor.bar(p, () => goToNextCard(p.id)) : null,
  );
}

// ---------- "What caught you?" (after a save) ----------
// One optional tap. The answer nudges the feed toward that quality and is
// counted anonymously (why/<passage>/<answer>), so we learn what draws people in.
const WHY = [
  ["imagery", "The imagery", "appeal:imagery"],
  ["voice",   "The voice",   "appeal:voice"],
  ["idea",    "The idea",    "appeal:insight"],
  ["feeling", "The feeling", "appeal:emotion"],
];

// Ask once per passage, and never in editor mode
function shouldAskWhy(p) { return !Editor.enabled() && !(p.id in Store.get("why", {})); }

// inPanel: show it inside the About panel, under its buttons, instead of floating over them
function askWhy(p, inPanel = false) {
  closeWhy();
  const answer = (key, feature) => {
    const all = Store.get("why", {}); all[p.id] = key; Store.set("why", all);
    track("why", `${p.id}/${key}`);
    if (feature) Taste.learnFeature(feature, 2);
    closeWhy();
    toast(savedMessage("Thanks."));
  };
  const box = el("div", { class: "why", role: "dialog", "aria-label": "What caught you?" },
    el("div", { class: "why-head" },
      el("p", { class: "why-title" }, "Saved. What caught you?"),
      el("button", { class: "why-close", "aria-label": "Skip", onclick: () => { closeWhy(); toast(savedMessage()); } }, "×"),
    ),
    el("div", { class: "why-chips" },
      WHY.map(([key, label, feature]) => el("button", { class: "chip", onclick: () => answer(key, feature) }, label)),
      el("button", { class: "chip quiet", onclick: () => answer("not-sure", null) }, "Not sure"),
    ),
    el("p", { class: "why-note" }, "Optional. It tunes your feed and is counted anonymously."),
  );
  if (inPanel) {
    box.classList.add("inline", "show");
    sheetContent.querySelector(".about-actions").after(box);
    return;
  }
  document.body.append(box);
  requestAnimationFrame(() => box.classList.add("show"));
  feedEl.addEventListener("scroll", closeWhy, { once: true });   // moving on = skipping
}

// The first time someone saves, tell them where saves go; after that, keep it short
function savedMessage(start = "Saved.") {
  if (Store.get("toldWhereSaved", false)) return start;
  Store.set("toldWhereSaved", true);
  return `${start} Your saves are under the book icon at the top.`;
}

// A brief pulse on the top-bar "Your reading" button, so the eye goes there
function pointToSaved() {
  const b = document.getElementById("open-saved");
  b.classList.remove("pulse"); void b.offsetWidth; b.classList.add("pulse");
}

function closeWhy() {
  document.querySelectorAll(".why").forEach(b => { b.classList.remove("show"); setTimeout(() => b.remove(), 200); });
}

// After a verdict in editor mode, glide to the next passage
function goToNextCard(id) {
  const cardEl = feedEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
  const next = cardEl && cardEl.nextElementSibling;
  if (next) setTimeout(() => next.scrollIntoView({ behavior: "smooth" }), 350);
}

// The pause after every 15 passages (see js/sitting.js).
// Points to the work that caught the reader most, or one they've started.
function pauseCard() {
  track("pause", "shown");
  const s = Sitting.get();
  const fav = Sitting.favourite();
  const inProgress = Store.booksInProgress().filter(r => LIBRARY.books[r.book]);
  const favStarted = fav && inProgress.find(r => r.book === fav.book);
  const other = inProgress.find(r => !fav || r.book !== fav.book);

  // "Today you met Woolf, Keats, Machado de Assis and 9 others."
  const names = s.authors.slice(0, 3);
  const rest = s.authors.length - names.length;
  const met = rest > 0 ? `${names.join(", ")} and ${rest} ${rest === 1 ? "other" : "others"}`
                       : names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];

  const continueLink = (r, cls) => {
    const b = LIBRARY.books[r.book];
    const where = r.of > 1 ? `, chapter ${r.ch + 1}` : "";
    return el("a", { class: cls, href: "reader.html?book=" + encodeURIComponent(r.book),
      onclick: () => track("pause", "continue") }, `Continue ${b.title}${where}`);
  };

  // The main suggestion
  let main = null;
  if (favStarted) main = continueLink(favStarted, "btn");
  else if (fav) {
    const p = LIBRARY.passages.find(x => x.id === fav.from);
    const b = LIBRARY.books[fav.book];
    main = el("a", { class: "btn", href: readerUrl(p, false), onclick: () => {
      Store.setOrigin(b.id, p.id); track("pause", "start"); track("start", b.id); track("start-from", p.id);
    } }, `Start reading ${b.title}`);
  }
  const second = other && continueLink(other, "pause-link");

  const inner = el("div", { class: "card-inner" },
    el("p", { class: "end-title" }, "That’s fifteen."),
    met && el("p", { class: "about-text muted" }, `This time you met ${met}.`),
    fav ? el("p", { class: "about-text" }, "Want to keep going with the one that caught you?")
        : el("p", { class: "about-text" }, "Nothing has caught you yet, and that’s fine. Some sittings are like that."),
    main, second,
    el("p", { class: "pause-choices" },
      el("button", { class: "linklike", onclick: (e) => {
        track("pause", "keep-exploring");
        const next = e.target.closest(".card").nextElementSibling;
        if (next) next.scrollIntoView({ behavior: "smooth" });
      } }, "Keep exploring"),
      el("button", { class: "linklike", onclick: () => doneForNow(cardEl) }, "Done for now"),
    ),
  );
  // Once ever: a one-tap question about coming back (counted anonymously)
  if (!Store.get("askedComeBack", false)) {
    Store.set("askedComeBack", true);
    const ask = el("div", { class: "comeback" },
      el("p", { class: "comeback-q" }, "Quick one: would you come back to Passages?"),
      el("div", { class: "why-chips" }, ["Yes", "Maybe", "No"].map(a =>
        el("button", { class: "chip", onclick: () => {
          track("comeback", a.toLowerCase());
          ask.replaceChildren(el("p", { class: "comeback-q" }, "Thank you. ",
            el("a", { href: feedbackHref(), target: "_blank", rel: "noopener",
              onclick: () => track("feedback", "pause") }, "Tell me more?")));
        } }, a))));
    inner.append(ask);
  }

  const cardEl = el("article", { class: "card pause-card" }, inner);
  return cardEl;
}

// "Done for now": a calm last screen. The next visit starts a fresh sitting.
function doneForNow(cardEl) {
  track("pause", "done");
  Sitting.end();
  while (cardEl.nextElementSibling) cardEl.nextElementSibling.remove();   // nothing more below
  stopped = true;
  cardEl.querySelector(".card-inner").replaceChildren(
    el("p", { class: "end-title" }, "See you next time."),
    el("p", { class: "about-text muted" }, "Your saved passages and your place in each work will be here when you come back."),
    el("p", { class: "pause-choices" },
      el("button", { class: "linklike", onclick: () => { stopped = false; track("pause", "changed-mind"); addMore();
        cardEl.nextElementSibling?.scrollIntoView({ behavior: "smooth" }); } }, "Actually, a few more"),
    ),
  );
}
let stopped = false;   // true after "Done for now", so no more cards get added

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

// The text that goes with a shared link: the passage (cut at a whole word if
// it's long) and who wrote it. Many apps, WhatsApp included, ignore the title.
function shareText(p) {
  const LIMIT = 220;
  let text = p.text.trim();
  if (text.length > LIMIT) {
    text = text.slice(0, LIMIT).replace(/\s+\S*$/, "").replace(/[\s,;:.…]+$/, "") + "…";
  }
  return `${text}\n\n${p.bookInfo.author}, ${p.bookInfo.title}\n`;
}

// The share button opens a small panel: a picture of the passage (for
// stories and chats) or a link. The picture is made by js/shareimage.js.
function share(p) {
  const preview = el("div", { class: "share-preview" }, el("p", { class: "muted small" }, "Making the picture…"));
  let blob = null;
  openSheet(
    el("h2", { class: "about-title" }, "Share this passage"),
    preview,
    el("div", { class: "about-actions" },
      el("button", { class: "btn", onclick: () => blob && shareImage(p, blob) }, "Share as image"),
      el("button", { class: "btn ghost", onclick: () => { closeSheet(); shareLink(p); } }, "Share link"),
    ),
    el("p", { class: "about-text muted small" }, "The picture is story-sized, for Instagram, WhatsApp and the like, and uses your current theme."),
  );
  ShareImage.make(p).then(b => {
    blob = b;
    preview.replaceChildren(el("img", { src: URL.createObjectURL(b), alt: `The passage from ${p.bookInfo.title}, as a picture` }));
  }).catch(() => preview.replaceChildren(el("p", { class: "muted small" }, "Couldn’t make the picture on this device. The link still works.")));
}

async function shareImage(p, blob) {
  track("share-image", p.id);
  Taste.learn(p, "share");
  const file = new File([blob], `passages-${p.id}.png`, { type: "image/png" });
  const caption = `${p.bookInfo.title}, ${p.bookInfo.author}. Read it free: ${passageUrl(p)}`;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text: caption }); } catch (e) {}
  } else {
    // Computers: download it instead
    const a = el("a", { href: URL.createObjectURL(blob), download: file.name });
    document.body.append(a); a.click(); a.remove();
    toast("Picture downloaded");
  }
}

async function shareLink(p) {
  track("share", p.id);
  Taste.learn(p, "share");
  const url = passageUrl(p);
  const title = `${p.bookInfo.title} — ${p.bookInfo.author}`;
  if (navigator.share) {
    try { await navigator.share({ title, text: shareText(p), url }); } catch (e) {}
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
  closeWhy();
  setTimeout(() => { sheetEl.hidden = true; }, 250);
}
sheetEl.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeSheet(); });

// "About this work": spoiler-free premise + why this passage + Start reading
function openAbout(p) {
  track("about", p.id);
  Taste.learn(p, "about");
  const b = p.bookInfo;
  const pos = Store.position(b.id);
  const done = Store.finished()[b.id];
  const startLabel = done ? "Read it again" : pos ? "Continue reading" : (b.kind === "poem" ? "Read the poem" : "Start reading");

  const saveBtn = el("button", { class: "btn ghost", onclick: () => {
    const on = Store.toggleSaved(p.id);
    if (on) { track("save", p.id); Taste.learn(p, "save"); }
    saveBtn.textContent = on ? "Saved" : "Save passage";
    const cardBtn = feedEl.querySelector(`[data-id="${CSS.escape(p.id)}"] .card-actions .icon-btn`);
    if (cardBtn) cardBtn.classList.toggle("on", on);
    if (on) pointToSaved();
    if (on && shouldAskWhy(p)) askWhy(p, true); else closeWhy();
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
    done ? el("p", { class: "about-text finished-note" }, `You finished it on ${dayMonth(done)}.`) : null,

    el("div", { class: "about-actions" },
      el("a", { class: "btn", href: readerUrl(p, false), onclick: () => {
        if (done) { Store.forgetBook(b.id); track("reread", b.id); }    // rereading starts from page one
        Store.setOrigin(b.id, p.id); track("start", b.id); track("start-from", p.id); Taste.learn(p, "start");
      } }, startLabel),
      saveBtn,
    ),
    el("a", { class: "jump-link", href: readerUrl(p, true), onclick: () => { Store.setOrigin(b.id, p.id); track("jump", b.id); } },
      "Already know it? Jump to this passage"),
    el("p", { class: "panel-small-links" },
      el("button", { class: "linklike", onclick: () => notForMe(p) }, "Not for me"),
      el("a", { href: problemHref(b.title, `passage ${p.id}`), onclick: () => track("problem", p.id) }, "Report a problem"),
    ),
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
    return el("li", { class: "saved-row" },
      el("a", { class: "saved-item", href: "reader.html?book=" + encodeURIComponent(r.book) },
        el("span", { class: "reading-title" }, b.title),
        el("span", { class: "saved-work" }, `${b.author} · ${where}`),
      ),
      removeButton(`Remove ${b.title} from Continue reading`, () => {
        const removed = Store.forgetBook(r.book);
        track("remove-reading", r.book);
        return () => Store.restoreBook(r.book, removed);
      }));
  }));

  // Works read to the end, most recent first
  const finished = Object.entries(Store.finished()).filter(([id]) => LIBRARY.books[id]).sort((a, b) => b[1] - a[1]);
  const finishedList = finished.length && el("ul", { class: "saved-list reading-list" }, finished.map(([id, t]) => {
    const b = LIBRARY.books[id];
    return el("li", { class: "saved-row" },
      el("a", { class: "saved-item", href: "reader.html?book=" + encodeURIComponent(id),
        onclick: () => { Store.forgetBook(id); track("reread", id); } },     // opens at page one
        el("span", { class: "reading-title" }, b.title),
        el("span", { class: "saved-work" }, `${b.author} · finished ${dayMonth(t)}`),
      ),
      removeButton(`Remove ${b.title} from Finished`, () => Store.unmarkFinished(id)));
  }));

  openSheet(
    el("h2", { class: "about-title" }, "Your reading"),
    readingList ? el("h3", { class: "about-label" }, "Continue reading") : null,
    readingList || null,
    finishedList ? el("h3", { class: "about-label" }, `Finished · ${finished.length}`) : null,
    finishedList || null,
    el("h3", { class: "about-label" }, "Saved passages"),
    items.length
      ? el("ul", { class: "saved-list" }, items.map(p =>
          el("li", { class: "saved-row" },
            el("button", { class: "saved-item", onclick: () => { closeSheet(); goToPassage(p.id); } },
              el("span", { class: "saved-text" }, p.text.replace(/\n/g, " / ")),
              el("span", { class: "saved-work" }, `${p.bookInfo.title} · ${p.bookInfo.author}`),
            ),
            removeButton("Remove this saved passage", () => {
              const before = Store.saved();
              Store.set("saved", before.filter(x => x !== p.id));
              syncSaveButton(p.id);
              return () => { Store.set("saved", before); syncSaveButton(p.id); };
            }))))
      : el("p", { class: "about-text muted" }, "Nothing saved yet. Tap the bookmark on any passage to keep it here."),
  );
}

// The small × on each row of "Your reading". `remove` does the removing and
// returns a function that undoes it (used by the Undo button in the toast).
function removeButton(label, remove) {
  return el("button", { class: "remove-btn", "aria-label": label, title: "Remove", onclick: (e) => {
    const row = e.currentTarget.closest("li");
    const list = row.parentElement;
    const undo = remove();
    row.remove();
    if (!list.children.length) reopenSaved();   // last one gone: redraw with the empty message
    toast("Removed", { label: "Undo", run: () => { undo(); reopenSaved(); } });
  } }, "×");
}

// "November 22"
function dayMonth(t) { return new Date(t).toLocaleDateString("en-US", { day: "numeric", month: "long" }); }   // English, like the rest of the interface

// Re-draw "Your reading" without jumping back to the top of the panel
function reopenSaved() {
  const panel = sheetEl.querySelector(".sheet-panel");
  const y = panel.scrollTop;
  openSaved();
  panel.scrollTop = y;
}

// Keep the bookmark icon on a feed card in step with the saved list
function syncSaveButton(id) {
  const btn = feedEl.querySelector(`[data-id="${CSS.escape(id)}"] .card-actions .icon-btn`);
  if (btn) btn.classList.toggle("on", Store.isSaved(id));
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
    (!Daily.fromHomeScreen() && Daily.homeScreenHowTo()) ? [
      el("h3", { class: "about-label" }, "On your phone"),
      el("p", { class: "about-text small" }, "Add Passages to your home screen and it opens like an app. " + Daily.homeScreenHowTo()),
    ] : null,
    el("p", { class: "about-text muted small" },
      "Everything here (saves, settings, your place in each book) is stored in this browser only."),
    el("p", { class: "settings-links" },
      el("a", { href: feedbackHref(), target: "_blank", rel: "noopener", onclick: () => track("feedback", "settings") }, "Send feedback"),
      el("a", { href: "library.html" }, "The library"),
      el("a", { href: "about.html" }, "About this project"),
      el("button", { class: "linklike", onclick: () => {
        Store.set("seenWelcome", false); closeSheet(); location.hash = ""; renderFeed();
      } }, "Read the welcome note again"),
    ),
  );
}

// After the feed is up: note return visits, and on a return visit show the
// home-screen tip once (only on phones, and not if they already use it from there)
function afterLoad() {
  const returned = Daily.noteVisit();
  const howTo = Daily.homeScreenHowTo();
  if (!returned || !howTo || Daily.fromHomeScreen() || Editor.enabled() || Store.get("homeTipShown", false)) return;
  setTimeout(() => {
    Store.set("homeTipShown", true);
    track("home-tip", "shown");
    const box = el("div", { class: "why home-tip", role: "dialog", "aria-label": "Add to home screen" },
      el("div", { class: "why-head" },
        el("p", { class: "why-title" }, "Welcome back"),
        el("button", { class: "why-close", "aria-label": "Close", onclick: () => box.remove() }, "×"),
      ),
      el("p", { class: "home-tip-text" }, "Add Passages to your home screen and it opens like an app, with your saves and your place in each book kept safe."),
      el("p", { class: "home-tip-text muted" }, howTo),
      el("button", { class: "chip", onclick: () => box.remove() }, "Got it"),
    );
    document.body.append(box);
    requestAnimationFrame(() => box.classList.add("show"));
  }, 4000);
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
  .then(lib => { LIBRARY = lib; renderFeed(); afterLoad(); })
  .catch(err => {
    feedEl.innerHTML = "";
    feedEl.append(el("p", { class: "loading" },
      "Couldn't load the passages. If you opened index.html straight from your computer, " +
      "use the GitHub Pages link instead (browsers block loading data files from local files). " + err.message));
  });
