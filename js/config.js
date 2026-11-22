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

  // Where the data lives (relative to the site root). You shouldn't need to touch these.
  booksCsv: "data/books.csv",
  passagesCsv: "data/passages.csv",
  booksFolder: "data/books/",
};

// Human-readable names for language codes (used in Settings and labels).
const LANGUAGE_NAMES = { en: "English", pt: "Português" };
