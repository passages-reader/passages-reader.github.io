/* ============================================================
   config.js — the few settings you're most likely to change.
   Every page loads this file first.
   ============================================================ */

const CONFIG = {
  // The name shown at the top of the app. Change it here and it changes everywhere.
  appName: "Passages",

  // Languages a new visitor sees in the feed (they can change this in Settings).
  // "en" = English, "pt" = Portuguese.
  defaultLanguages: ["en", "pt"],

  // Colour theme for new visitors: "light", "sepia" or "dark".
  defaultTheme: "light",

  // GoatCounter code for anonymous visit counting (see js/analytics.js).
  // Your dashboard: https://passages-reader.goatcounter.com  — set to "" to turn counting off.
  analyticsCode: "passages-reader",

  // Feedback: paste the link to a Google Form (or any page) here.
  // If it's left empty, "Send feedback" opens an email instead.
  feedbackUrl: "https://forms.gle/T55xMSCwDJ5Snok49",

  // Where the data lives (relative to the site root). You shouldn't need to touch these.
  booksCsv: "data/books.csv",
  passagesCsv: "data/passages.csv",
  booksFolder: "data/books/",
};

// Human-readable names for language codes (used in Settings and labels).
const LANGUAGE_NAMES = { en: "English", pt: "Português" };

// "Report a problem": an email with the work and place already filled in,
// so a typo or a broken page can be found and fixed quickly.
function problemHref(work, where) {
  const body = `What's wrong? (a typo, missing text, something that doesn't work…)\n\n\n---\nWork: ${work}\nWhere: ${where}\nPage: ${location.href}`;
  return "mailto:" + ["jjrenatocn", "gmail.com"].join("@") +
    "?subject=" + encodeURIComponent(`Passages: problem in ${work}`) + "&body=" + encodeURIComponent(body);
}

// Where "Send feedback" points: the form above if there is one, otherwise an email.
// (The address is assembled here rather than written out, to keep spam bots away.)
function feedbackHref() {
  if (CONFIG.feedbackUrl) return CONFIG.feedbackUrl;
  return "mailto:" + ["jjrenatocn", "gmail.com"].join("@") + "?subject=" + encodeURIComponent("Passages feedback");
}
