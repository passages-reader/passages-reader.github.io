# Maintaining Passages

The practical handbook: how to update the site, make common edits, and read the numbers. For how the code works, see [tech-spec.md](tech-spec.md). For how passages are chosen, see [curation-pipeline.md](curation-pipeline.md).

---

## Updating the site

**Upload new files**
1. On the repository page, click **Add file → Upload files**.
2. Drag in the *contents* of the project folder, not the folder itself. Use Chrome or Edge so the subfolders come along.
3. Click **Commit changes**.

A file with the same name in the same place replaces the old one. Files you don't upload stay as they are. The live site updates in a minute or two.

**Edit in the browser (github.dev)**
1. On the repository page, press the **`.`** key. A code editor opens in the browser.
2. Edit any file.
3. Click the **Source Control** icon in the left sidebar.
4. Write a short note about what you changed, then click **Commit & Push**.

If you don't see the change on the site, do a hard reload.

> Opening `index.html` straight from your computer won't work. Browsers block a local page from loading the data files. Always use the GitHub Pages address.

---

## Common edits

**Rename the app.**
- In `js/config.js`, change `appName`.
- In `manifest.json`, change `"name"` and `"short_name"`.
- Change the `<title>` in `index.html` and `about.html`.

**Change the welcome note or the About page.**
- The welcome note is the `<template id="welcome-template">` block in `index.html`.
- The About page is `about.html`. The library page (`library.html`) builds itself from `books.csv`, so adding a work adds it there automatically.

Both are plain HTML text.

**Set up the feedback form.** Create a Google Form, copy its link, and paste it into `feedbackUrl` in `js/config.js`. Until then, "Send feedback" opens an email.

**Change the feed's mix of forms.** `MIX` near the top of `js/taste.js` (currently novels 50%, stories 30%, poems 20%).

**Change colours or fonts.** At the top of `css/style.css`, each theme (light, sepia, dark) is a short list of colours.

**Edit a passage's note or translation.** Edit `data/passages.csv`. It's easiest in Google Sheets (File → Import, then download as CSV), but github.dev works too.

**Edit a book's description or pace note.** In `data/books.csv`, `premise` is the spoiler-free description and `pace` is the optional note on how the book reads (shown under "Reading it" with the reading time). After adding or rebuilding a book, run `python3 tools/book_stats.py` to update its word count.

**Hide a passage without deleting it.** Set its `status` to `cut`.

**Add one passage by hand.** Add a row to `passages.csv`:

| column | what goes in it |
|---|---|
| `id` | a short unique name, e.g. `pp-pride` |
| `book` | the book's id from `books.csv`, e.g. `pride-and-prejudice` |
| `location` | `chapter.paragraph`, both counted from 0. `3.12` = 4th chapter, 13th paragraph |
| `text` | copied exactly from the book. `…` at the start or end if cut mid-paragraph. Poems: one line per line |
| `note` | why the passage is worth reading. No spoilers |
| `appeal` | 1–2 of: imagery; voice; humor; insight; emotion; tension |
| `mood` | one of: joyful, tender, melancholy, dark, wry, contemplative |
| `themes` | 1–3 of: love; solitude; ambition; family; childhood; nature; sea; city; death; time-memory; identity; society; faith; art; freedom; morality |
| `difficulty` | 1 easy to read cold · 2 some period language · 3 demanding |
| `translation` | only for non-English passages |
| `status` | `keep` |

Finding the location by hand is fiddly. It's easier to ask Claude, which finds the location and checks the text.

**Review passages on your phone (editor mode).**
1. Open `https://passages-reader.github.io/#editor` once. Every passage now has a **Keep · Maybe · Cut · Note** bar, and the ones you haven't reviewed come first. Picking a verdict moves you on to the next passage.
   - **To rewrite a text,** tap the passage to open its About panel, then **Edit** under "Why this passage" or "About the book". Save keeps it on your phone, marked "Edited"; **Undo edit** goes back to the original. An edit to "About the book" applies to every passage from that work. Use Note for comments, Edit for new wording.
2. When you're done, open Settings and choose **Export my reviews**. On a phone this opens the share sheet; on a computer it downloads a small CSV file.
3. Send the file to Claude, or run `python3 tools/apply_reviews.py <file>`. Cuts are hidden (status `cut`), maybes are flagged (status `maybe`), edited texts replace the originals in `passages.csv` and `books.csv`, and your notes are printed for the next curation round. A collaborator can do the same on their own phone and send their own file.
4. To leave editor mode, use the button in Settings or open `#editor-off`. Regular visitors never see the bar.

**Add many passages, or a new book.** Use the curation pipeline (see [curation-pipeline.md](curation-pipeline.md)). New books also need `tools/build_books.py` and the source ebook.

**Check every passage against its book:** `python3 tools/check_passages.py`

---

## Reading the numbers (GoatCounter)

The dashboard is at **https://passages-reader.goatcounter.com**.

Page names:
- `/` is the feed
- `/about` is the About page
- `/reader/<book>` is each book

| event | means |
|---|---|
| `view/<passage>` | the passage was on screen (once per visit) |
| `about/<passage>` | someone tapped it to see "About this work" |
| `start/<book>` | someone tapped Start / Continue reading |
| `start-from/<passage>` | the same, counted by the passage that led there: which passages actually get books started |
| `feedback/…` | someone tapped "Send feedback" |
| `jump/<book>` | someone used "Jump to this passage" |
| `chapter/<book>/<n>` | someone moved on to chapter n |
| `last-chapter/<book>` | someone reached the final chapter |
| `finished/<book>` | someone reached the end of the final chapter (for poems and stories: read it all) |
| `welcome/shown` | a first-time visitor saw the welcome note |
| `nope/<passage>` | someone tapped "Not for me" on it |
| `save/…`, `share/…`, `translate/…` | what they sound like |
| `pause/shown` | the pause card appeared (after every 15 passages) |
| `pause/start`, `pause/continue` | at the pause, someone started the suggested work or continued one in progress |
| `pause/keep-exploring`, `pause/done` | at the pause, someone chose more passages, or stopped for now |
| `pause/changed-mind` | after "Done for now", someone asked for a few more |
| `why/<passage>/<answer>` | after saving, someone said what caught them: `imagery`, `voice`, `idea`, `feeling` or `not-sure` |
| `problem/…` | someone tapped "Report a problem" (the report itself arrives by email) |
| `daily/<passage>` | the passage of the day was shown |
| `return/…` | someone came back after 12+ hours: `1-day`, `within-week` or `later`. **The retention number.** |
| `open/home-screen` | someone opened Passages from their home screen |
| `comeback/yes` (`maybe`, `no`) | answers to "Would you come back?" at the first pause |
| `share-image/<passage>` | someone shared a passage as a picture (for stories and chats) |
| `instagram/<where>` | someone tapped the Instagram link (`done`, `end-card`, `settings`, `about`) |
| `reread/<book>` | someone started a work they'd already finished |
| `remove-reading/<book>` | someone removed a work from Continue reading |
| `tonight/open`, `tonight-read/<book>` | someone opened the Bradbury Challenge; someone started tonight's story or poem from it |
| `elsewhere/open/<book>`, `elsewhere/<where>/<book>` | someone opened "Prefer paper or an e-reader?"; someone followed one of its links |
| `elsewhere/place/<place>` | someone switched place (often means the time-zone guess was wrong) |
| `daily-again/<passage>` | someone brought today's passage back from Your reading |
| `welcome/begin-button` | a new visitor tapped "Swipe up to begin" instead of swiping |
| `tip/labels`, `tip/back` | tutorial tips shown (button labels; swipe down to go back) |
| `reader-about/<book>` | someone opened ⓘ About inside the reader |
| `share-work-open/<book>` | someone opened Share from the reader's ⓘ panel |
| `share-work-image/<book>`, `share-work/<book>` | someone shared a whole work, as a picture or as a link |

Questions to ask of the numbers:
- **return ÷ welcome/shown:** roughly what share of new visitors come back
- **pause/start + pause/continue ÷ pause/shown:** how often the pause turns into reading, the closest thing to the pilot's main question
- **start ÷ about:** of the people a passage intrigued, how many started reading?
- **chapter/…/2 ÷ start:** how many kept going?
- **about ÷ view, per passage:** which passages actually make people curious?
- **nope, per passage:** which passages put people off? A passage with several of these is a candidate for replacement.

**Don't count yourself:** on each device, open `https://passages-reader.github.io/#toggle-goatcounter` once. Open it again to undo. To turn counting off entirely, set `analyticsCode: ""` in `js/config.js`.

---

## Sources and rights

- **English texts:** [Standard Ebooks](https://standardebooks.org), CC0.
- **Portuguese texts:** Project Gutenberg, in the original 19th-century spelling. Gutenberg's licence text and trademark have been removed, as their licence allows.
- **All works and translations** are public domain in the US (published before 1931).
- **Portuguese passage translations** are AI-made and labelled as such in the app.


## The visual identity

- **The mark:** a drawn pilcrow (¶): a half-circle and two straight bars, cream on clay (#8b3a2b). It's the app icon and marks where a passage begins (welcome card, shared pictures, link preview). Master file: `icons/icon.svg`.
- **The wordmark:** "Passages" in EB Garamond, followed by a small clay dot (`.wordmark-dot` in the CSS).
- **Colours:** Paper #f5f0e6, Ink #1f1c18, Ink soft #6b645a, Line #d9d0c1, Clay #8b3a2b, Highlight #ecdcb8; dark and sepia versions are in section 1 of `css/style.css`.
- **Type:** EB Garamond for literature (passages, titles, wordmark); Inter for the interface.
- **Changing the icon:** edit `icons/icon.svg`, then ask Claude to re-render the PNGs (they're made from it).
