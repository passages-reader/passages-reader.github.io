/* ============================================================
   editor.js — "editor mode": review passages on your phone.

   Turn it on by opening the site with #editor at the end:
       https://passages-reader.github.io/#editor
   (and off with #editor-off, or from Settings).

   In editor mode every passage gets a small bar:
       Keep · Maybe · Cut · Note
   and in the About panel, "Why this passage" and "About the book"
   get an Edit link, so you can rewrite them in place. (An edit to
   "About the book" belongs to the work, so it applies to every
   passage from it.)
   Your verdicts and edits are stored in this browser. Settings →
   "Export my reviews" saves them as a small CSV file; the script
   tools/apply_reviews.py applies them to the data files.

   Regular visitors never see any of this.
   ============================================================ */

const Editor = {
  enabled() { return Store.get("editor", false); },

  // All verdicts: { passageId: { v: "keep"|"maybe"|"cut", c: "comment", t: timestamp } }
  reviews() { return Store.get("reviews", {}); },
  get(id) { return Editor.reviews()[id] || {}; },
  set(id, changes) {
    const all = Editor.reviews();
    all[id] = { ...(all[id] || {}), ...changes, t: Date.now() };
    Store.set("reviews", all);
  },
  reviewedCount() { return Object.values(Editor.reviews()).filter(r => r.v).length; },

  // ---------- edits to the texts in the About panel ----------
  // A passage's edited note is kept with its review (field "note");
  // edited premises are kept per work: { bookId: { premise, t } }
  bookEdits() { return Store.get("bookEdits", {}); },
  noteFor(p) { return Editor.enabled() && Editor.get(p.id).note || p.note; },
  premiseFor(b) { return Editor.enabled() && (Editor.bookEdits()[b.id] || {}).premise || b.premise; },
  saveNote(p, text) {
    const all = Editor.reviews(); const r = { ...(all[p.id] || {}) };
    if (text && text !== p.note) r.note = text; else delete r.note;
    all[p.id] = { ...r, t: Date.now() }; Store.set("reviews", all);
  },
  savePremise(b, text) {
    const all = Editor.bookEdits();
    if (text && text !== b.premise) all[b.id] = { premise: text, t: Date.now() }; else delete all[b.id];
    Store.set("bookEdits", all);
  },
  editCount() {
    return Object.values(Editor.reviews()).filter(r => r.note).length + Object.keys(Editor.bookEdits()).length;
  },

  // A paragraph of the About panel that can be edited in place (editor mode only).
  // current: the text shown now; original: the text in the data files; save(text) stores it
  editable(current, original, save) {
    const box = el("div", { class: "editable" });
    const show = (text) => {
      const edited = text !== original;
      box.replaceChildren(
        el("p", { class: "about-text" }, text),
        el("p", { class: "edit-links" },
          edited ? el("span", { class: "edited-mark" }, "Edited · ") : null,
          el("button", { class: "linklike", onclick: () => startEditing(text) }, "Edit"),
          edited ? el("button", { class: "linklike", onclick: () => { save(original); show(original); } }, "Undo edit") : null,
        ),
      );
    };
    const startEditing = (text) => {
      const area = el("textarea", { class: "edit-area", rows: 6 });
      area.value = text;
      box.replaceChildren(area, el("p", { class: "edit-links" },
        el("button", { class: "btn small", onclick: () => { const t = area.value.trim() || original; save(t); show(t); toast("Edit saved"); } }, "Save"),
        el("button", { class: "linklike", onclick: () => show(text) }, "Cancel"),
      ));
      area.focus();
    };
    show(current);
    return box;
  },

  // In editor mode, passages you haven't reviewed yet come first
  unreviewedFirst(list) {
    const done = Editor.reviews();
    const todo = list.filter(p => !(done[p.id] && done[p.id].v));
    return todo.length ? todo : list;
  },

  // The Keep / Maybe / Cut / Note bar under a card
  bar(p, onVerdict) {
    const current = Editor.get(p.id);
    const wrap = el("div", { class: "review-bar", onclick: (e) => e.stopPropagation() });
    const buttons = [["keep", "Keep"], ["maybe", "Maybe"], ["cut", "Cut"]].map(([v, label]) =>
      el("button", {
        class: "review-btn " + v + (current.v === v ? " on" : ""),
        onclick: () => {
          Editor.set(p.id, { v });
          wrap.querySelectorAll(".review-btn[data-v]").forEach(b => b.classList.toggle("on", b.dataset.v === v));
          onVerdict && onVerdict();
        },
        "data-v": v,
      }, label));
    const note = el("button", {
      class: "review-btn note" + (current.c ? " on" : ""),
      onclick: () => {
        const c = prompt("A note about this passage (optional):", Editor.get(p.id).c || "");
        if (c !== null) { Editor.set(p.id, { c: c.trim() }); note.classList.toggle("on", !!c.trim()); }
      },
    }, "Note");
    wrap.append(...buttons, note);
    return wrap;
  },

  // CSV of all reviews and edits, with the passage text so it reads on its own.
  // Edited premises are rows with id "book:<work id>" and the text in new_premise.
  csv() {
    const esc = (s) => `"${String(s || "").replace(/"/g, '""')}"`;
    const lines = ["id,verdict,comment,new_note,new_premise,work,author,text"];
    const all = Editor.reviews();
    for (const [id, r] of Object.entries(all)) {
      const p = LIBRARY.passages.find(x => x.id === id);
      if (!p || (!r.v && !r.c && !r.note)) continue;
      lines.push([id, r.v || "", r.c || "", r.note || "", "", p.bookInfo.title, p.bookInfo.author, p.text.replace(/\n/g, " / ").slice(0, 120)].map(esc).join(","));
    }
    for (const [bookId, e] of Object.entries(Editor.bookEdits())) {
      const b = LIBRARY.books[bookId];
      if (!b) continue;
      lines.push(["book:" + bookId, "", "", "", e.premise, b.title, b.author, ""].map(esc).join(","));
    }
    return lines.join("\n");
  },

  // Share the file (phones), or download it (computers), or copy it as a last resort
  async exportReviews() {
    const text = Editor.csv();
    const name = `passages-reviews-${new Date().toISOString().slice(0, 10)}.csv`;
    const file = new File([text], name, { type: "text/csv" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Passages reviews" });
        return;
      }
    } catch (e) { if (e.name === "AbortError") return; }
    try {
      const a = el("a", { href: URL.createObjectURL(file), download: name });
      document.body.append(a); a.click(); a.remove();
      return;
    } catch (e) {}
    try { await navigator.clipboard.writeText(text); toast("Reviews copied"); } catch (e) { prompt("Copy your reviews:", text); }
  },

  // The block shown in Settings when editor mode is on
  settingsSection() {
    if (!Editor.enabled()) return null;
    return el("div", { class: "editor-settings" },
      el("h3", { class: "about-label" }, "Editor mode"),
      el("p", { class: "about-text small" },
        `${Editor.reviewedCount()} of ${LIBRARY.passages.length} passages reviewed` +
        (Editor.editCount() ? `, ${Editor.editCount()} text${Editor.editCount() === 1 ? "" : "s"} edited` : "") +
        ". Unreviewed passages come first."),
      el("div", { class: "about-actions" },
        el("button", { class: "btn", onclick: () => Editor.exportReviews() }, "Export my reviews"),
        el("button", { class: "btn ghost", onclick: () => {
          Store.set("editor", false); location.hash = ""; location.reload();
        } }, "Turn off editor mode"),
      ),
    );
  },
};

// Lets the stylesheet adjust the layout in editor mode (long passages can scroll inside their card)
if (Store.get("editor", false)) document.body.classList.add("editor");

// #editor turns editor mode on, #editor-off turns it off
if (location.hash === "#editor") { Store.set("editor", true); document.body.classList.add("editor"); history.replaceState(null, "", location.pathname); }
if (location.hash === "#editor-off") { Store.set("editor", false); history.replaceState(null, "", location.pathname); }
