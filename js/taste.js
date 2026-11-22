/* ============================================================
   taste.js — a simple, on-device "what does this reader like?"

   Every passage is classified in passages.csv:
     appeal     why it hooks people: imagery, voice, humor, insight, emotion, tension
     mood       joyful, tender, melancholy, dark, wry, contemplative
     themes     love, solitude, nature, city, ... (see README)
     difficulty 1 = easy to read cold, 2 = some period language, 3 = demanding
   plus its book, author and kind (novel / story / poem).

   As someone uses the feed, each of those features gains or loses points:
     lingered on a passage +0.5   swiped past quickly −0.5
     opened "About"        +1.5   shared               +2
     saved                 +3     started reading      +3
     tapped "Not for me"   −3   (and that passage isn't shown again)
   The feed then prefers passages whose features have the most points,
   while still mixing in random ones (so it keeps discovering).

   It all stays in this browser. Settings has an on/off switch and a reset.
   ============================================================ */

const Taste = {
  // How much each action is worth (edit freely)
  WEIGHTS: { skip: -0.5, linger: 0.5, about: 1.5, share: 2, save: 3, start: 3, translate: 0.5, nope: -3 },

  // Share of feed picks that ignore taste and are random (keeps it from getting narrow)
  EXPLORE: 0.3,

  // The first few cards of every visit are random, before taste kicks in
  WARMUP: 3,

  enabled() { return Store.get("tasteOn", true); },
  setEnabled(on) { Store.set("tasteOn", on); },
  profile() { return Store.get("taste", {}); },
  reset() { Store.set("taste", {}); Store.set("seen", []); Store.set("notForMe", []); },

  // Passages the reader marked "Not for me" (never shown again until a reset)
  notForMe() { return new Set(Store.get("notForMe", [])); },
  markNotForMe(p) {
    const s = Store.get("notForMe", []);
    if (!s.includes(p.id)) { s.push(p.id); Store.set("notForMe", s); }
    Taste.learn(p, "nope");
  },

  // The features a passage contributes to, e.g. ["appeal:humor", "mood:wry", "theme:love", "book:pride-and-prejudice", ...]
  features(p) {
    const list = (s) => (s || "").split(";").map(x => x.trim()).filter(Boolean);
    return [
      ...list(p.appeal).map(x => "appeal:" + x),
      ...list(p.mood).map(x => "mood:" + x),
      ...list(p.themes).map(x => "theme:" + x),
      p.difficulty && "difficulty:" + p.difficulty,
      "kind:" + p.bookInfo.kind,
      "book:" + p.book,
      "author:" + p.bookInfo.author,
    ].filter(Boolean);
  },

  // Records an action on a passage, e.g. Taste.learn(p, "save")
  learn(p, action) {
    const w = Taste.WEIGHTS[action];
    if (!w) return;
    const prof = Taste.profile();
    for (const f of Taste.features(p)) {
      prof[f] = Math.max(-10, Math.min(10, (prof[f] || 0) + w));   // keep scores between −10 and 10
    }
    Store.set("taste", prof);
  },

  // How well a passage matches the reader's taste (higher = better)
  score(p) {
    const prof = Taste.profile();
    return Taste.features(p).reduce((sum, f) => sum + (prof[f] || 0), 0);
  },

  // Passages already shown in earlier visits are pushed back, so new ones come first
  seen() { return new Set(Store.get("seen", [])); },
  markSeen(id) {
    const s = Store.get("seen", []);
    if (!s.includes(id)) { s.push(id); Store.set("seen", s); }
  },

  // Chooses the next passage from those not yet shown this visit.
  // `shownCount` = how many cards are already in the feed; `lastBook` avoids two in a row from one work.
  pickNext(remaining, shownCount, lastBook) {
    if (!remaining.length) return null;
    const seenBefore = Taste.seen();
    let pool = remaining.filter(p => p.book !== lastBook);
    if (!pool.length) pool = remaining;
    const fresh = pool.filter(p => !seenBefore.has(p.id));
    if (fresh.length) pool = fresh;                         // unseen passages first

    const random = () => pool[Math.floor(Math.random() * pool.length)];
    if (!Taste.enabled() || shownCount < Taste.WARMUP || Math.random() < Taste.EXPLORE) return random();

    // best score wins; a little randomness breaks ties and keeps things lively
    let best = null, bestScore = -Infinity;
    for (const p of pool) {
      const s = Taste.score(p) + Math.random() * 1.5;
      if (s > bestScore) { best = p; bestScore = s; }
    }
    return best;
  },
};
