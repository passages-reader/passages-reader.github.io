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
  REREAD: 0.15,      // chance a passage from a finished work is allowed back in
  EXPLORE: 0.3,

  // The first few cards of every visit are random, before taste kicks in
  WARMUP: 3,

  // The mix of forms the feed aims for. Taste can shift it (someone who keeps
  // saving poems gets more poems), but a big batch of one form can't swamp the feed.
  MIX: { novel: 0.5, story: 0.3, poem: 0.2 },

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
    if (typeof Sitting !== "undefined") Sitting.note(p, action);      // also feeds the pause card (js/sitting.js)
    const w = Taste.WEIGHTS[action];
    if (!w) return;
    const prof = Taste.profile();
    for (const f of Taste.features(p)) {
      prof[f] = Math.max(-10, Math.min(10, (prof[f] || 0) + w));   // keep scores between −10 and 10
    }
    Store.set("taste", prof);
  },

  // Learns one quality directly, e.g. from "What caught you? The voice" → appeal:voice
  learnFeature(feature, w) {
    const prof = Taste.profile();
    prof[feature] = Math.max(-10, Math.min(10, (prof[feature] || 0) + w));
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
  // Which form (novel / story / poem) should the next card be?
  // Picks the form furthest below its share of the cards shown so far.
  pickKind(remaining, shownKinds) {
    const available = [...new Set(remaining.map(p => p.bookInfo.kind))];
    if (available.length <= 1) return available[0];
    const prof = Taste.profile();
    const weight = {};
    for (const k of available) {
      const lean = Taste.enabled() ? (prof["kind:" + k] || 0) / 5 : 0;          // −2…+2
      weight[k] = (Taste.MIX[k] || 0.2) * Math.max(0.3, Math.min(3, 1 + lean));
    }
    const total = Object.values(weight).reduce((a, b) => a + b, 0);
    const n = shownKinds.length + 1;
    let best = available[0], bestGap = -Infinity;
    for (const k of available) {
      const gap = (weight[k] / total) * n - shownKinds.filter(x => x === k).length + Math.random() * 0.3;
      if (gap > bestGap) { best = k; bestGap = gap; }
    }
    return best;
  },

  pickNext(remaining, shownCount, lastBook, shownKinds = []) {
    if (!remaining.length) return null;
    const seenBefore = Taste.seen();
    // keep the balance of forms first, then choose within that form
    const kind = Taste.pickKind(remaining, shownKinds);
    if (kind) remaining = remaining.filter(p => p.bookInfo.kind === kind);
    let pool = remaining.filter(p => p.book !== lastBook);
    if (!pool.length) pool = remaining;
    // Works you've finished come back now and then (about 1 pick in 7), not never
    const done = Store.finished();
    const notRead = pool.filter(p => !(p.book in done));
    if (notRead.length && Math.random() > Taste.REREAD) pool = notRead;
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
