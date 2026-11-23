/* ============================================================
   daily.js — small things that make Passages worth coming back to,
   without nagging:

   - Passage of the day: the first card of the day's first visit.
     Everyone with the same settings gets the same one.
   - Return visits: counted (anonymously) when someone comes back
     after 12+ hours, so we can see whether people return.
   - Home-screen tip: shown once, on a return visit, explaining how
     to add Passages to the phone's home screen.
   - "Would you come back?": one tap, asked once, at the first pause.
   ============================================================ */

const Daily = {
  // "2026-11-23" in the reader's own time zone
  today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  },

  // The same passage all day: the date picks one from the list, in a fixed order
  passageOfTheDay(pool) {
    if (!pool.length) return null;
    const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));
    let h = 0;
    for (const c of Daily.today()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return sorted[h % sorted.length];
  },

  // Show it only on the first visit of the day (not every time the feed reloads)
  shouldShowToday() {
    if (Store.get("dailyShown", "") === Daily.today()) return false;
    Store.set("dailyShown", Daily.today());
    return true;
  },

  // ---------- return visits ----------
  // Called once per page load. Records `return/<days away>` when someone
  // comes back after 12 hours or more, and notes if they opened Passages
  // from the home screen.
  noteVisit() {
    const last = Store.get("lastVisit", 0);
    const now = Date.now();
    Store.set("lastVisit", now);
    if (Daily.fromHomeScreen()) track("open", "home-screen");
    if (!last) return false;                                   // first visit ever
    const hours = (now - last) / 36e5;
    if (hours < 12) return false;
    const days = Math.round(hours / 24);
    track("return", days <= 1 ? "1-day" : days <= 7 ? "within-week" : "later");
    return true;
  },

  fromHomeScreen() {
    return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  },

  // ---------- home-screen tip ----------
  // How to add it, worded for the reader's phone. Null on computers.
  homeScreenHowTo() {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return "In Safari, tap the Share button, then “Add to Home Screen.”";
    if (/Android/.test(ua)) return "In Chrome, tap the ⋮ menu, then “Add to Home screen.”";
    return null;
  },
};
