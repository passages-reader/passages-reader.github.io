# Tech Spec — Passages (MVP)

_Live at https://passages-reader.github.io_

An overview of how the code works: architecture, files, data, and the main flows. For *how passages are chosen*, see [curation-pipeline.md](curation-pipeline.md). For day-to-day updates, see [maintaining.md](maintaining.md).

---

## 1. Architecture at a glance

- **Static site.** Plain HTML, CSS and JavaScript. No framework, no build step, no server. The files in the repository are exactly what the browser runs, which is why edits in github.dev go live directly.
- **Hosting.** GitHub Pages, serving the `main` branch of `passages-reader/passages-reader.github.io`.
- **"Database".** Data files in the repo:
  - CSVs for the catalog and passages (editable in a spreadsheet)
  - one JSON file per book holding the full text
- **User state.** Saves, settings, reading positions and taste profile are kept in the browser's `localStorage`. They are per device and per browser, with no accounts.
- **Personalization.** On-device taste learning (`js/taste.js`) reorders the feed using each passage's classification.
- **Analytics.** GoatCounter, a hosted, cookieless counter, loaded by one script.
- **Offline content tools.** Python scripts in `tools/` build the book JSON files, verify passages, and run the curation pipeline. They are not part of the website.

```
Browser
  index.html  ──► js/feed.js   ──┐
  reader.html ──► js/reader.js ──┤──► js/data.js ──► data/*.csv, data/books/*.json
  about.html  ──► js/about.js  ──┤
                                 ├──► js/storage.js ──► localStorage
                                 ├──► js/taste.js   (feed only: on-device taste learning)
                                 └──► js/analytics.js ──► GoatCounter (external)
```

Scripts are loaded as classic `<script>` tags, in a fixed order, and share globals: `config.js` → `storage.js` → `analytics.js` → `data.js` → (`taste.js`, feed only) → page script.

---

## 2. File map

| Path | Role |
|---|---|
| `index.html` | Feed page structure: top bar, empty `<main id="feed">`, the welcome-card `<template>`, the shared sliding panel (`#sheet`), toast. |
| `reader.html` | Reader page structure: top bar (back, title/chapter, Contents, Aa), `<main id="reader">`, sliding panel. |
| `about.html` | The About page: mission, how it works, how passages are chosen, library, privacy, roadmap, credits. |
| `css/style.css` | All styling, in seven sections: theme variables, basics, top bar/buttons, feed cards (incl. welcome card), sliding panel, reader, About page. |
| `js/config.js` | `CONFIG` (app name, default languages/theme, analytics code, data paths) and `LANGUAGE_NAMES`. |
| `js/storage.js` | `Store` object (everything remembered per browser) and `applyTheme()`. |
| `js/analytics.js` | Loads GoatCounter with tidy page paths; defines `track(action, detail)`. |
| `js/data.js` | `parseCSV`, `loadLibrary`, `loadBook`, `parseLocation`, `bookMeta`. |
| `js/taste.js` | `Taste` object: learns per-feature scores from reader actions and picks the next passage. |
| `js/editor.js` | Editor mode (`#editor`): Keep / Maybe / Cut / Note bar on each card, reviews stored under `reviews`, CSV export. |
| `js/feed.js` | Builds and runs the feed, the welcome card, the About / Saved / Settings panels, sharing, keyboard. |
| `js/reader.js` | Renders chapters, restores and saves position, highlights the origin passage, Contents and Text panels. |
| `js/about.js` | Fills the About page's library list from `books.csv`. |
| `data/books.csv` | One row per work. |
| `data/passages.csv` | One row per passage, including its classification. |
| `data/books/<id>.json` | Full text of each work. |
| `manifest.json`, `icons/` | "Add to Home Screen" support (name, colours, icons). |
| `tools/build_books.py` | Converts source ebooks → `data/books/*.json`. |
| `tools/check_passages.py` | Verifies every passage matches its book word for word. |
| `tools/apply_reviews.py` | Applies an exported reviews file to `passages.csv` (cut → hidden, maybe → flagged). |
| `tools/book_stats.py` | Writes each book's word count to `books.csv` (for reading time). |
| `tools/prepare_candidates.py` | Curation step 1: numbered paragraph list of a book's spoiler-safe zone. |
| `tools/review_sheet.py` | Curation: validates candidates → `review.csv`; appends approved rows to `passages.csv`. |
| `docs/` | This spec, the curation pipeline, and the maintenance handbook. |
| `README.md` | What the project is and why. |

---

## 3. Data model

### 3.1 `data/books.csv`
| Column | Meaning |
|---|---|
| `id` | Stable slug; also the JSON filename (`moby-dick` → `data/books/moby-dick.json`). |
| `title`, `author`, `year` | Display metadata. |
| `language` | `en` or `pt`; drives the Settings language filter and the `lang` attribute. |
| `kind` | `novel`, `story` or `poem`; changes labels ("Read the poem", "About the story") and the spoiler-safe zone. |
| `translator` | Optional; shown as "trans. …". |
| `words` | Word count of the full text, filled in by `tools/book_stats.py`; used for reading time. |
| `premise` | Spoiler-free description shown in "About this work". |
| `pace` | Optional honest note on how the work reads ("slow, dense opening…"), shown under "Reading it". |

### 3.2 `data/passages.csv`
| Column | Meaning |
|---|---|
| `id` | Stable slug; used in share URLs (`#p=<id>`), saves, taste learning and analytics. |
| `book` | A `books.csv` id. |
| `location` | `chapter.paragraph`, both counted from 0, into the book JSON. |
| `text` | Exact text from the book. A leading/trailing `…` marks a cut mid-paragraph. Newlines = verse lines. |
| `note` | "Why this passage", spoiler-free. |
| `appeal` | 1–2 of imagery, voice, humor, insight, emotion, tension (`;`-separated). |
| `mood` | One of joyful, tender, melancholy, dark, wry, contemplative. |
| `themes` | 1–3 of love, solitude, ambition, family, childhood, nature, sea, city, death, time-memory, identity, society, faith, art, freedom, morality. |
| `difficulty` | 1 easy to read cold · 2 some period language · 3 demanding. |
| `translation` | Optional; enables the "Show translation" toggle (labelled AI translation). |
| `status` | `keep` / `edit` / `cut`. Rows with `cut` are hidden; anything else is shown. |

### 3.3 `data/books/<id>.json`
```json
{
  "id": "pride-and-prejudice",
  "chapters": [
    { "title": "Chapter I",
      "paras": [ { "h": "inline html" }, { "h": "…", "v": 1 }, { "s": 1 } ] }
  ]
}
```
- `h`: paragraph text as sanitized inline HTML. Only `<em>`, `<strong>` and `<br>` are allowed.
- `v: 1`: verse (each `<br>` is a line break; rendered with hanging indents).
- `s: 1`: scene break (rendered as ⁂).
- A passage's `location` `3.12` is `chapters[3].paras[12]`. Scene breaks occupy an index too.

Sizes range from about 2 KB (a poem) to about 2 MB (*Anna Karenina*). A book file is only fetched when the reader opens it, never by the feed.

---

## 4. The feed (`index.html` + `js/feed.js`)

### Startup
1. `loadLibrary()` fetches both CSVs in parallel, parses them, drops `cut` rows and rows pointing to unknown books, and attaches `bookInfo` to each passage.
2. `renderFeed()`:
   - builds `remaining`, the passages matching `Store.languages()` and `Store.kinds()`, minus any marked "Not for me". If the filters exclude everything, it falls back to all passages except the "Not for me" ones;
   - if the URL has `#p=<id>`, adds that passage first (share links, "Back" from the reader);
   - on a first visit (`seenWelcome` not set), adds the welcome card from `<template id="welcome-template">`: first in the feed, or second after a shared passage. It's then marked as seen;
   - calls `addMore()`, which adds cards in batches of 4, each chosen by `Taste.pickNext()`; when nothing is left, it adds the end card ("Start again");
   - shows a one-line hint on the first card only if the welcome card was skipped somehow.
3. A single IntersectionObserver (60% visible) handles three things:
   - fires `view` once per visit and marks the passage as seen;
   - times how long each card stays on screen (under 1.5 s counts as a skip, over 6 s as a linger, both fed to `Taste.learn`);
   - calls `addMore()` when the reader is within 3 cards of the end.

### Welcome card
A full-screen card whose own content scrolls (`overflow-y: auto`). It covers what the app is, how it works, what it remembers, and the fact that it's still being built, and links to the About page. "Read the welcome note again" in Settings clears `seenWelcome` and rebuilds the feed.

### Taste learning (`js/taste.js`)
- **Features of a passage:** `appeal:*`, `mood:*`, `theme:*`, `difficulty:*`, `kind:*`, `book:*`, `author:*`.
- **Learning:** `Taste.learn(passage, action)` adds the action's weight to every feature of the passage. Weights: skip −0.5, linger +0.5, translate +0.5, about +1.5, share +2, save +3, start +3, "Not for me" −3. Scores are clamped to ±10 and stored under `taste`.
- **Scoring:** `Taste.score(p)` is the sum of the scores of p's features.
- **Balance of forms (`Taste.pickKind`):** before choosing a passage, the feed picks a form (novel / story / poem) aiming for `MIX` = 50 / 30 / 20 of the cards shown so far. Taste can lean it: each form's share is multiplied by up to ×3 (or down to ×0.3) according to the reader's `kind:*` score.
- **Choosing the next card (`Taste.pickNext`):**
  - avoids the same work twice in a row;
  - prefers passages not seen in earlier visits (stored under `seen`);
  - the first 3 cards (`WARMUP`), 30% of all picks (`EXPLORE`), and every pick when learning is off are random;
  - otherwise it takes the highest score plus a small random jitter.
- **"Not for me":** `Taste.markNotForMe(p)` stores the id under `notForMe` (the passage is never shown again) and applies the −3 weight to its features.
- **Settings:** an on/off switch (`tasteOn`) and "Reset what it has learned", which clears `taste`, `seen` and `notForMe`.
- **Tested:** with a profile favouring poems, 11 of the first 20 cards were poems, against about 3 with learning off. No two cards from the same work were adjacent, and scrolling to the end showed all 80 passages exactly once.

### Cards
- **Layout:** full-viewport cards in a vertical `scroll-snap` container (`.feed`), one per screen.
- **Text size:** chosen by word count (`size-l` under 35 words, `size-m` under 75, `size-s` otherwise). Verse always uses `size-m`.
- **Verse:** rendered as one `<span class="line">` per line, with a hanging indent. All-caps verse (e.g. a dedication page) is centred.
- **Translation toggle:** swaps text and `lang`, shows the "AI translation" label, and remembers the choice per passage.
- **Footer:** title and author, plus Save, Share and Info buttons. Tapping anywhere on the card opens "About this work".

### Panels (shared `#sheet` component)
- `openSheet(...nodes)` / `closeSheet()`. On phones it slides up from the bottom; at 720 px and wider it's a centred card.
- **About this work:** shows type/year/translator, title, author, "Why this passage", "About the book", and "Reading it" (reading time from `readingTime()` in `data.js`, at about 230 words/minute for prose and 120 for poetry, followed by the book's `pace` note if it has one), then:
  - a **Start reading** button, which becomes **Continue reading** if a saved position exists;
  - a **Save** button;
  - a secondary link, "Already know it? Jump to this passage".
  - a small "Not for me" link: it hides the passage for good, teaches the feed, closes the panel and moves to the next card.
  Both reading links record the origin passage (`Store.setOrigin`) before navigating.
- **Your reading** (bookmark icon): "Continue reading" lists every work with a saved place, most recent first (`Store.booksInProgress()`), with chapter n of total; below it, saved passages (tapping one scrolls to it).
- **Remembering your place in the feed:** as each card comes on screen, the address is updated (`history.replaceState`) to `#p=<passage>`. Going back from a book, or reloading, puts that passage first instead of reshuffling.
- **Feedback:** "Send feedback" (end card, Settings, welcome card, About page) points to `CONFIG.feedbackUrl` if set, otherwise an email (`feedbackHref()` in `config.js`).
- **Settings:** language checkboxes and "Show me" checkboxes for novels / short stories / poems (the feed re-renders on change), theme swatches, the taste-learning switch and reset, a link to the About page, and "Read the welcome note again".

The wordmark in the top bar also links to the About page.

### Sharing
`navigator.share` where available (phones); otherwise the URL is copied to the clipboard; as a last resort, a `prompt()` shows it. URL format: `<site>/#p=<passage id>`.

### Keyboard (desktop)
↓ / j / Space / PageDown go to the next card; ↑ / k / PageUp go to the previous one. Enter opens About, Esc closes the panel.

### DOM helper
`el(tag, attrs, ...children)` builds elements. Attributes starting with `on` become event listeners. All passage and note text is inserted as text, never as HTML.

---

## 5. The reader (`reader.html` + `js/reader.js`)

### URL parameters
`reader.html?book=<id>&from=<passage id>&jump=1`
- `book` (required): which work to open. Without it, the reader redirects to the feed.
- `from` (optional): the passage that brought the reader here. If it's missing, the stored origin for that book is used.
- `jump=1` (optional): open directly at that passage.

### Startup
1. Loads the library (for book metadata and the origin passage) and the book JSON in parallel.
2. Resolves `ORIGIN = { ch, p, text }` from the passage's location.
3. Points the Back button to `index.html#p=<origin>`, so the reader returns to the same passage in the feed.
4. Picks where to start:
   - with `jump`, at the origin passage;
   - otherwise at the saved position, if there is one;
   - otherwise at chapter 0.

### Rendering a chapter (`showChapter(index, scrollToPara)`)
- **Analytics:** fires `chapter` (and `last-chapter`) whenever the chapter changes after the first render, whatever triggered it.
- **Title and byline:** a single-chapter work (poem or story) shows the work's title; otherwise the chapter's title. The author byline appears on the first chapter.
- **Paragraphs:** each is rendered as `<p data-i="n">`. Verse lines become `<span class="line">`, and scene breaks become ⁂.
- **Origin passage:** if this chapter contains it, a small label ("The passage that brought you here") goes above it, and `highlightText()` wraps the exact passage text in `<mark>`. The text is located through the paragraph's text nodes, so a match spanning italics or line breaks still works. If the exact text isn't found, the whole paragraph is highlighted instead.
- **Short front matter:** chapters of 12 lines or fewer, each under 90 characters (dedications, epigraphs), are centred.
- **Navigation:** Previous/Next buttons, "The end." with a link back to the feed on the last chapter, and a progress line ("3 of 61").
- **Finishing:** `checkFinished()` runs after each render and on scroll. On the last chapter, once the navigation block is on screen, it fires `finished` (once per page load).
- Titles and names inserted as HTML go through `esc()`. Paragraph HTML is trusted because it was sanitized at build time.

### Position memory
After each scroll pause (300 ms debounce), the reader saves the first paragraph whose bottom is still below the top bar, as `{ ch, p }` under `pos:<book>`. Changing chapter also saves `{ ch, p: 0 }`.

### Panels and settings
- **Contents:** chapter list with the current chapter highlighted; tapping a chapter jumps to it.
- **Text (Aa):** size from 0.8× to 1.6× in steps of 0.1, applied through the CSS variable `--reader-scale`; theme swatches.
- **Keyboard:** ← / → change chapter; Esc closes the panel.

---

## 6. The About page (`about.html` + `js/about.js`)

Static text in HTML, so it can be edited without touching code. The "What's in the library" section is generated from `books.csv`:
- works are grouped into novels, stories and poems, sorted by author;
- each title links to `reader.html?book=<id>`;
- a line at the end shows the current passage and work counts.

---

## 7. Browser storage (`js/storage.js`)

Everything goes through `Store.get` / `Store.set`, which serialize to JSON and are wrapped in try/catch. If storage is blocked (some private-browsing modes), the app still works but forgets things.

| Key | Value | Used by |
|---|---|---|
| `saved` | array of passage ids, newest first | feed (Save, Saved panel) |
| `languages` | e.g. `["en","pt"]` | feed filter |
| `kinds` | e.g. `["novel","story","poem"]` | feed filter ("Show me") |
| `notForMe` | passage ids marked "Not for me" | feed filter, taste learning |
| `theme` | `light` / `sepia` / `dark` | all pages (`data-theme` on `<html>`) |
| `fontSize` | number, 0.8–1.6 | reader |
| `tr:<passage>` | boolean, translation shown | feed |
| `pos:<book>` | `{ ch, p, of, t }` (chapter, paragraph, chapter count, time) | reader; "Continue reading" label and list |
| `origin:<book>` | passage id | reader highlight |
| `seenWelcome` | boolean | feed welcome card |
| `seenHint` | boolean | feed first-card hint |
| `taste` | `{ "theme:love": 2.5, … }` feature scores | taste learning |
| `seen` | passage ids shown in any visit | taste learning (new passages first) |
| `tasteOn` | boolean | taste learning switch |
| `editor` | boolean | editor mode |
| `reviews` | `{ id: { v, c, t } }` verdicts and notes | editor mode |

**How long it lasts:** it survives reloads, closing the browser and restarting the device. It is lost in private windows, when site data is cleared, and on iOS Safari after about 7 days without a visit; home-screen web apps are exempt from that last one. Each browser and device keeps its own copy, and on iOS the home-screen app and the Safari tab are separate too.

**Swapping in a backend later:** replace the internals of `Store` with API calls, and the rest of the code stays the same. The methods would need to become async, or use a local cache that syncs in the background.

---

## 8. Analytics (`js/analytics.js`)

- Sets `window.goatcounter.path` so page views are tidy: the feed is `/`, the About page is `/about`, and each book is `/reader/<book>`.
- Injects `https://gc.zgo.at/count.js` with `data-goatcounter="https://<CONFIG.analyticsCode>.goatcounter.com/count"`. It is skipped on `localhost` or when the code is empty.
- `track(action, detail)` sends custom events with the path `action/detail`, and silently does nothing if GoatCounter hasn't loaded or is blocked.

| Event | Fired when |
|---|---|
| `welcome/shown` | The welcome card was added for a first-time visitor |
| `view/<passage>` | A card is at least 60% on screen. Counted once per page load. |
| `about/<passage>` | "About this work" opened |
| `start/<book>` | Start/Continue reading tapped |
| `start-from/<passage>` | Same tap, recorded by the passage it came from (books started per passage) |
| `feedback/<where>` | "Send feedback" tapped (`end-card` or `settings`) |
| `jump/<book>` | "Jump to this passage" tapped |
| `save/<passage>` | Passage saved, from the card or the panel (not on unsave) |
| `share/<passage>` | Share tapped |
| `translate/<passage>` | Translation shown |
| `nope/<passage>` | "Not for me" tapped |
| `chapter/<book>/<n>` | Reader moved to chapter n by any means: buttons, Contents or arrow keys. The first chapter shown on opening doesn't count. |
| `last-chapter/<book>` | Reader moved to the final chapter |
| `finished/<book>` | The end-of-book navigation scrolled into view on the final chapter (once per page load) |

Key ratios: `start ÷ about` (intrigue → reading), `chapter/…/2 ÷ start` (kept reading), `finished ÷ start` for poems and stories, and per-passage `about ÷ view` (which passages hook people).

Excluding your own visits: open `<site>/#toggle-goatcounter` once per browser. GoatCounter also offers an "Ignore IPs" option under Settings → Tracking.

---

## 9. Styling (`css/style.css`)

- **Themes:** CSS custom properties on `:root` and `[data-theme=…]`: `--paper`, `--paper-2`, `--ink`, `--ink-2`, `--line`, `--accent`, `--accent-ink`, `--highlight`. Every rule uses these variables, so editing a theme changes the whole look.
- **Typography:** EB Garamond for literature, Inter for interface text (Google Fonts, with serif and system fallbacks). The reading measure is 34rem.
- **Layout units:** the feed and cards use `100dvh`, so mobile browser toolbars don't cut cards off. Safe-area insets keep content clear of notches and home indicators.
- **Feed:** `scroll-snap-type: y mandatory` plus `scroll-snap-stop: always` give one card per swipe. Scrollbars are hidden. `hyphens: manual` keeps passages from being hyphenated. The welcome card scrolls internally.
- **Reader:** book-style first-line indents (none after headings or scene breaks), hanging indents for verse, and a `<mark>` highlight with `box-decoration-break: clone` so it wraps cleanly across lines.
- **About page:** the same reading measure and type scale as the reader, with small-caps section labels in the accent colour.

---

## 10. Content tools (offline, `tools/`)

### `build_books.py`
- **Sources:**
  - Standard Ebooks repositories, cloned from GitHub (English; clean XHTML, CC0).
  - Project Gutenberg plain-text files via GITenberg mirrors (Portuguese).
- **Standard Ebooks:**
  - Walks the book's reading order (the `content.opf` spine), skipping title page, imprint, colophon, licence and endnotes.
  - Takes chapter titles from `<hgroup>` or headings. Roman numerals become "Chapter N".
  - Divider pages with no text (e.g. "Book I · Miss Brooke") are prefixed to the chapters that follow them.
  - Within a chapter: `<p>` becomes a paragraph, `<hr>` and sub-headings (like Chekhov's numbered parts) become scene breaks, and text inside poem/verse containers is marked `v`.
  - Footnote references are removed, and invisible word-joiner and soft-hyphen characters are stripped.
  - *Mrs Dalloway*, which has no chapters, is split at its section breaks.
  - Single stories or poems are pulled out of collections (`only={…}`), and Keats's poems are taken by their id within the poetry file.
- **Gutenberg:**
  - Strips the Gutenberg header, footer and licence.
  - Splits chapters with a regular expression on the chapter headings, and splits paragraphs at blank lines.
  - Converts `--` to an em dash and `_x_` to italics.
  - Cuts the printed table of contents at the end.
  - Brás Cubas's "Ao leitor" note and dedication are handled specially.
- **Inline HTML:** sanitized to `em`, `strong` and `br` only.

### `check_passages.py`
For every row, it loads `chapters[ch].paras[p]` and normalizes both sides: tags removed, `<br>` turned into a space, whitespace collapsed, and leading/trailing `…` stripped. It then checks that the passage text is contained in the paragraph, and reports mismatches and word counts. Run it from the repo root with `python3 tools/check_passages.py`.

### Curation pipeline
`prepare_candidates.py` → LLM selection → `review_sheet.py build` → LLM critique → human review → `review_sheet.py apply`. The full process and prompts are in [curation-pipeline.md](curation-pipeline.md).
- **`prepare_candidates.py`** lists paragraphs in the spoiler-safe zone (novels: first 40%, stories: first 75%, poems: all), skipping ones already featured or under 8 / over 400 words.
- **`review_sheet.py build`** drops candidates that fail any check:
  - the text appears word for word at its location
  - the location is inside the safe zone
  - prose is 110 words or fewer, verse 10 lines or fewer
  - the classification uses the controlled vocabulary
  - the passage isn't already featured

  It writes `review.csv`, sorted by the critic's hook score.
- **`review_sheet.py apply`** appends the rows marked `yes`.

### Browser tests (run during development, not stored in the repo)
A headless Chromium script opens every passage at a 375×667 phone size and confirms the card's text isn't cut off. It also opens every passage in the reader with `jump=1` and confirms a `<mark>` highlight appears, checks the taste-learning bias, full feed coverage and welcome-card placement, and reports any page errors.

---

## 11. Known limitations and next technical steps

- **No cross-device sync.** Everything is in `localStorage`. The planned move is to Supabase or Firebase, replacing `Store`.
- **Taste learning is per device** and starts from zero. With a backend, it could follow the reader across devices and learn from everyone's behaviour (collaborative filtering).
- **Classification is used only by taste learning.** The same fields can drive a future discovery/filter page.
- **Fonts load from Google Fonts.** Self-hosting them would remove the external request and improve privacy and offline use.
- **No offline mode.** There's no service worker. Adding one would allow reading without a connection but adds caching complexity, since visitors can end up seeing stale versions after edits.
- **Large books.** The 2 MB JSON files load in one request. If needed, they could be split per chapter later.
- **UI is English only.** All interface strings are inline in the HTML and JS files. Extracting them is the first step toward a Portuguese UI.
- **Adding books** requires running `build_books.py` with the sources, a step done with Claude for now. Passages can be added by hand in the CSV or through the curation pipeline.
