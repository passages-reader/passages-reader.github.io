/* ============================================================
   analytics.js — anonymous counting with GoatCounter.

   No cookies, no personal data. It only counts things like
   "someone opened this passage's details" or "someone started
   reading this book". The numbers show up on your GoatCounter
   dashboard (https://<code>.goatcounter.com).

   To turn it off, set analyticsCode to "" in js/config.js.
   ============================================================ */

(function loadGoatCounter() {
  if (!CONFIG.analyticsCode || location.hostname === "localhost") return;
  // Tidy page names on the dashboard: the feed is always "/", each book is "/reader/<book id>",
  // and the About page is "/about"
  // (instead of separate entries for "/", "/index.html", and long reader URLs).
  window.goatcounter = {
    path: function () {
      if (location.pathname.endsWith("reader.html")) {
        return "/reader/" + (new URLSearchParams(location.search).get("book") || "");
      }
      if (location.pathname.endsWith("about.html")) return "/about";
      if (location.pathname.endsWith("me.html")) return "/me";
      return "/";
    },
  };
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://gc.zgo.at/count.js";
  s.dataset.goatcounter = `https://${CONFIG.analyticsCode}.goatcounter.com/count`;
  document.head.append(s);
})();

// Records one event, e.g. track("start", "moby-dick") shows up as "start/moby-dick".
// If GoatCounter hasn't loaded yet (or is blocked), the event is quietly skipped.
function track(action, detail) {
  try {
    if (window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({ path: `${action}/${detail}`, title: action, event: true });
    }
  } catch (e) {}
}
