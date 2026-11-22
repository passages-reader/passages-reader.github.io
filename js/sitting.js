/* ============================================================
   sitting.js — the pause after every 15 passages.

   A "sitting" is one stretch of browsing. It ends after 30 minutes
   away, so someone who reads at lunch and again at night gets two.

   During a sitting we remember:
     - how many passages you've seen since the last pause
     - which authors you met
     - which works caught your interest (saved, opened, lingered on…)
   After 15 passages, feed.js shows a pause card that points you to
   the work that caught you most, instead of just another passage.
   ============================================================ */

const Sitting = {
  EVERY: 15,                    // passages between pauses
  GAP: 30 * 60 * 1000,          // 30 minutes away = a new sitting
  // How much each action says "this work caught me" (only positive signals count)
  INTEREST: { linger: 1, translate: 1, about: 2, share: 3, save: 3, start: 3 },

  // { count, seen: [ids], authors: [names], works: { bookId: { score, from } }, last }
  get() {
    const s = Store.get("sitting", null);
    if (!s || Date.now() - s.last > Sitting.GAP) return Sitting.fresh();
    return s;
  },
  fresh() { return { count: 0, seen: [], authors: [], works: {}, last: Date.now() }; },
  save(s) { s.last = Date.now(); Store.set("sitting", s); },
  end() { Store.set("sitting", Sitting.fresh()); },

  // Called when a passage comes on screen. Returns true when it's time for a pause.
  viewed(p) {
    const s = Sitting.get();
    if (s.seen.includes(p.id)) { Sitting.save(s); return false; }   // already counted (e.g. after coming back from a book)
    s.seen.push(p.id);
    s.count++;
    if (!s.authors.includes(p.bookInfo.author)) s.authors.push(p.bookInfo.author);
    const due = s.count >= Sitting.EVERY;
    if (due) s.count = 0;
    Sitting.save(s);
    return due;
  },

  // Called from Taste.learn for every reader action
  note(p, action) {
    const points = Sitting.INTEREST[action];
    if (!points) return;
    const s = Sitting.get();
    const w = s.works[p.book] || { score: 0, from: p.id, best: 0 };
    w.score += points;
    if (points >= w.best) { w.best = points; w.from = p.id; }   // remember the passage that caught them most
    s.works[p.book] = w;
    Sitting.save(s);
  },

  // The work that caught this reader most during the sitting: { book, from } or null
  favourite() {
    const done = Store.finished();
    const entries = Object.entries(Sitting.get().works).filter(([book]) => !(book in done))
      .sort((a, b) => b[1].score - a[1].score);
    return entries.length ? { book: entries[0][0], from: entries[0][1].from } : null;
  },
};
