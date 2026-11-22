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
- The About page is `about.html`.

Both are plain HTML text.

**Change colours or fonts.** At the top of `css/style.css`, each theme (light, sepia, dark) is a short list of colours.

**Edit a passage's note or translation.** Edit `data/passages.csv`. It's easiest in Google Sheets (File → Import, then download as CSV), but github.dev works too.

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
| `jump/<book>` | someone used "Jump to this passage" |
| `chapter/<book>/<n>` | someone moved on to chapter n |
| `last-chapter/<book>` | someone reached the final chapter |
| `finished/<book>` | someone reached the end of the final chapter (for poems and stories: read it all) |
| `welcome/shown` | a first-time visitor saw the welcome note |
| `save/…`, `share/…`, `translate/…` | what they sound like |

Questions to ask of the numbers:
- **start ÷ about:** of the people a passage intrigued, how many started reading?
- **chapter/…/2 ÷ start:** how many kept going?
- **about ÷ view, per passage:** which passages actually make people curious?

**Don't count yourself:** on each device, open `https://passages-reader.github.io/#toggle-goatcounter` once. Open it again to undo. To turn counting off entirely, set `analyticsCode: ""` in `js/config.js`.

---

## Sources and rights

- **English texts:** [Standard Ebooks](https://standardebooks.org), CC0.
- **Portuguese texts:** Project Gutenberg, in the original 19th-century spelling. Gutenberg's licence text and trademark have been removed, as their licence allows.
- **All works and translations** are public domain in the US (published before 1931).
- **Portuguese passage translations** are AI-made and labelled as such in the app.
