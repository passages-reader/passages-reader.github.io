# Passages (working name)

Passages from great books, one at a time. If one catches you, tap it to learn about the work, then read it right here, from the beginning.

This is the MVP: a static website, so there's no server and no database. Content lives in data files, and each visitor's saves and reading positions live in their own browser.

---

## Putting it online (GitHub Pages)

**Option A: clean address (recommended).** The site lives at `something.github.io`.

1. On github.com, click your profile picture, then **Your organizations → New organization**. Choose the **Free** plan and pick a name, e.g. `passages-app`. That name becomes the address.
2. Inside the organization, click **New repository**. Name it exactly `passages-app.github.io` (your organization name + `.github.io`), set it to **Public**, and click **Create repository**.
3. Continue with step 3 below.

**Option B: quickest.** The site lives at `joserenatocn.github.io/passages`.

1. Click **New repository**, name it `passages`, set it to **Public**, and click **Create repository**.

**Then, for both options:**

3. On the empty repository page, click the link **"uploading an existing file"**.
4. Open the unzipped `passages` folder on your computer, select **everything inside it** (not the folder itself), and drag it into the browser window. Use Chrome or Edge so the subfolders come along.
5. Click **Commit changes**. The upload takes a moment because the books are about 6 MB.
6. Go to **Settings → Pages**. Under "Build and deployment", set Source to **Deploy from a branch**, Branch to **main**, folder **/ (root)**, then click **Save**.
7. Wait 1–2 minutes and refresh that page. It shows your site's address at the top.

> Opening `index.html` directly from your computer won't work: browsers block pages from loading data files that way. Always use the GitHub Pages address.

## Editing in github.dev

On the repository page, press the **`.`** key (or change `github.com` to `github.dev` in the address bar). A code editor opens in the browser.

1. Edit any file.
2. Click the **Source Control** icon in the left sidebar (the branching icon).
3. Type a short note about what you changed, then click **Commit & Push**.
4. The live site updates in 1–2 minutes. If you don't see the change, refresh with a hard reload.

---

## What each file does

```
index.html            The feed (page structure only)
reader.html           The e-reader (page structure only)
css/style.css         All visual styling: colours, fonts, spacing. Themes are at the top.
js/config.js          App name, default languages, default theme, analytics code. Start here.
js/analytics.js       Anonymous counting with GoatCounter (no cookies, no personal data)
js/storage.js         What the app remembers per browser (saves, settings, reading position)
js/data.js            Reads the CSV and book files
js/feed.js            Builds the feed, the "About this work" panel, Saved, Settings, sharing
js/reader.js          Shows a book chapter by chapter, remembers your place, highlights the passage
data/books.csv        One row per work: title, author, year, language, kind, translator, premise
data/passages.csv     One row per passage: text, note, location, tags, translation, status
data/books/*.json     Full text of each work, split into chapters and paragraphs
manifest.json, icons/ Lets people add the site to their phone's home screen
tools/                Scripts used to prepare content (not part of the website)
```

## Common edits

**Rename the app.** In `js/config.js`, change `appName`. Also change `"name"` and `"short_name"` in `manifest.json`, and the `<title>` in `index.html`.

**Change colours or fonts.** At the top of `css/style.css`, each theme (light, sepia, dark) is a short list of colours.

**Edit a passage's note or translation.** Edit `data/passages.csv`. It's easiest in Google Sheets or Excel (File → Import, then download as CSV), but github.dev works too.

**Hide a passage without deleting it.** Set its `status` column to `cut`.

**Add a passage from a book that's already here.** Add a row to `passages.csv`:

| column | what goes in it |
|---|---|
| `id` | any short unique name, e.g. `pp-pride` |
| `book` | the book's id from `books.csv`, e.g. `pride-and-prejudice` |
| `location` | `chapter.paragraph`, both counted from 0. `3.12` = 4th chapter, 13th paragraph |
| `text` | copied exactly from the book. Put `…` at the start or end if you cut mid-paragraph. For poems, one line per line. |
| `note` | why this passage is worth reading. No spoilers. |
| `tags` | separated by `;` (not used yet; for future filters) |
| `translation` | only for non-English passages |
| `status` | `keep` |

Finding the location by hand is fiddly. It's easiest to ask Claude ("add this passage from Middlemarch"), which finds it and checks it.

**Check that every passage matches its book word for word:**
`python3 tools/check_passages.py`

**Add a new book.** This needs `tools/build_books.py` and the source ebook. Ask Claude.

---

## Analytics (GoatCounter)

The dashboard is at **https://passages-reader.goatcounter.com**. Besides normal page visits, the site records these events:

| event | means |
|---|---|
| `view/<passage>` | the passage was on screen (counted once per visit) |
| `about/<passage>` | someone tapped it to see "About this work" |
| `start/<book>` | someone tapped Start / Continue reading |
| `jump/<book>` | someone used "Jump to this passage" |
| `chapter/<book>/<n>` | someone moved on to chapter n |
| `last-chapter/<book>` | someone reached the final chapter |
| `save/…`, `share/…`, `translate/…` | what they sound like |

The key question is **start ÷ about**: of the people a passage intrigued, how many began reading? Then **chapter/2 ÷ start**: how many kept going?

Visits from `localhost` aren't counted. To turn counting off, set `analyticsCode: ""` in `js/config.js`.

---

## Curation rules

1. The passage works on its own, with no setup needed.
2. No plot reveals: deaths, twists, who ends up with whom, endings.
3. Under about 100 words (a poem can use a full stanza).
4. Prefer the first third of a book. Anything later gets extra spoiler scrutiny.
5. Variety: aphorisms, descriptions, voice, ideas, not only famous lines.

## Sources

- English texts: [Standard Ebooks](https://standardebooks.org), public domain (CC0).
- Portuguese texts: Project Gutenberg, original 19th-century spelling (e.g. *Braz*, *pharmacia*). Gutenberg's license text and trademark have been removed, as their license allows.
- Translations of Portuguese passages: AI-made, labelled as such in the app.

All works are public domain in the US (published before 1931), including the translations used.
