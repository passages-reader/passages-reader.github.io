/* ============================================================
   storage.js — everything the app remembers about a reader.

   There's no server yet, so all of this lives in the visitor's own
   browser ("localStorage"). It survives closing the tab, but it's
   per device: saves on your phone won't appear on your laptop.
   When we add a real backend, only this file needs to change.
   ============================================================ */

const Store = {
  // --- low-level helpers (wrapped in try/catch because some private
  //     browsing modes block storage; the app then just doesn't remember) ---
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  },

  // --- saved passages: a list of passage ids, newest first ---
  saved() { return Store.get("saved", []); },
  isSaved(id) { return Store.saved().includes(id); },
  toggleSaved(id) {
    let list = Store.saved();
    list = list.includes(id) ? list.filter(x => x !== id) : [id, ...list];
    Store.set("saved", list);
    return list.includes(id);
  },

  // --- settings ---
  languages() { return Store.get("languages", CONFIG.defaultLanguages); },
  setLanguages(list) { Store.set("languages", list); },
  theme() { return Store.get("theme", CONFIG.defaultTheme); },
  setTheme(t) { Store.set("theme", t); applyTheme(); },
  fontSize() { return Store.get("fontSize", 1); },        // 1 = normal; reader only
  setFontSize(x) { Store.set("fontSize", x); },
  showTranslation(id) { return Store.get("tr:" + id, false); },
  setShowTranslation(id, on) { Store.set("tr:" + id, on); },

  // --- reading position per book: { ch: chapter index, p: paragraph index } ---
  position(bookId) { return Store.get("pos:" + bookId, null); },
  setPosition(bookId, pos) { Store.set("pos:" + bookId, pos); },

  // --- the passage that led someone to a book (so the reader can highlight it) ---
  origin(bookId) { return Store.get("origin:" + bookId, null); },
  setOrigin(bookId, passageId) { Store.set("origin:" + bookId, passageId); },
};

// Applies the chosen colour theme to the page (CSS does the rest).
function applyTheme() {
  document.documentElement.dataset.theme = Store.theme();
}
applyTheme();
