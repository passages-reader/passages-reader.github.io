# Curation Pipeline — how passages are found, checked and approved

The goal is to make passage selection mostly automatic while keeping a human, the reader the app is for, as the final judge of what makes someone curious. Literary expertise is not required for the human step.

```
1. PREPARE  (script)  book → numbered list of paragraphs in the spoiler-safe zone
2. SELECT   (LLM)     selector proposes 12–15 candidates per work, fully classified
3. CHECK    (script)  verbatim / zone / length / vocabulary checks; failures dropped
4. CRITIQUE (LLM)     an independent critic scores each candidate and the slate
5. REVIEW   (human)   one question per row: would this make you curious?
6. PUBLISH  (script)  "yes" rows are appended to passages.csv
7. LEARN    (data)    after launch, GoatCounter shows which passages hook people; weak ones are replaced
```

Scripts live in `tools/`. The LLM steps are currently run by hand with Claude. They could later become a script that calls an API, at some cost per run.

---

## 1. Prepare — `tools/prepare_candidates.py <book-id>`

- **Output:** every paragraph from the safe zone, tagged with its location, its position in the book, its word count and its chapter.
- **Spoiler-safe zone:** first 40% of a novel, first 75% of a story, the whole of a poem. Override with `--zone`.
- **Skipped:** paragraphs under 8 or over 400 words, and locations already in `passages.csv`.
- **Why it matters:** the selector picks from this list by location and copies the text from it, so it cannot invent text or misplace a passage.

## 2. Select — selector prompt

```
# Passages — Literary Candidate Discovery

You are the first reader for Passages, an app that shows one literary passage per
screen. A reader who is struck by a passage taps it, learns about the work, and
can start reading the whole thing in the app. Your job: find the passages most
likely to make an ordinary, curious reader want to read this work.

You are not compiling a quotation collection. A beautiful aphorism that tells
you nothing about the book is a weaker choice than a strange, vivid, funny or
unsettling moment that makes someone ask "what is this book?"

## Input
A numbered list of paragraphs from the spoiler-safe part of the work, each tagged
[location | position in book | words | chapter]. Choose only from this list.

## What to look for (aim for a mix across your selections)
- imagery    — description you can see, hear or feel
- voice      — a narrator or character you'd follow anywhere
- humor      — wit, irony, comedy
- insight    — a psychological or moral observation that rings true
- emotion    — a moment that moves
- tension    — something unresolved that makes you want the next page
Also: memorable dialogue, surprising observations, the author's distinctive manner.

## Rules
1. Copy the passage exactly from the list. You may take a span within a paragraph
   (start and/or end mid-paragraph); mark a cut with … at that end. Never join
   paragraphs, change words, fix spelling or punctuation, or paraphrase.
2. Length: prose 15–100 words (≤110 hard limit). Verse: ≤ 10 lines.
3. It must work cold: no unexplained names doing crucial work, no "as I said".
4. No spoilers: nothing that reveals deaths, twists, who ends up with whom,
   secrets, or how anything ends — even if it is in the safe zone.
5. Variety: at most a third of your picks may be "insight" (aphorism-type). At
   most two of the work's famous, much-quoted lines. Spread picks across the
   list (not all from chapter one) and across moods.
6. Do not invent context. If you are unsure what is happening at that point in
   the book, say so in `why` and lower your confidence.

## Output
CSV with a header row and these columns, one row per candidate (12–15 rows):
id          short slug: <book prefix>-<keyword>, e.g. pe-baronetage
book        the book id given
location    exactly as in the list, e.g. 3.12
text        the passage (verse: one line per line)
why         1–2 sentences for the editor: what makes it hook a reader
note        the reader-facing note, 1–2 sentences, ≤ 45 words: who/where we are
            (without spoilers), then what to notice. Plain, warm, specific.
            No "masterful", "timeless", "beautifully"; no plot beyond the passage.
appeal      1–2 of: imagery; voice; humor; insight; emotion; tension
mood        exactly 1 of: joyful, tender, melancholy, dark, wry, contemplative
themes      1–3 of: love; solitude; ambition; family; childhood; nature; sea; city;
            death; time-memory; identity; society; faith; art; freedom; morality
difficulty  1 = easy to read cold, 2 = some period language, 3 = demanding
translation English translation if the work is not in English, else empty
confidence  high / medium / low — how sure you are it will hook an ordinary reader
            AND is spoiler-free AND stands alone
Separate multiple values with ";". Leave the critic_* columns out.

The output is a shortlist for review. Nothing you select is approved yet.
```

## 3. Check — `tools/review_sheet.py build candidates/*.csv`

A candidate is dropped, with a printed reason, if any of these fail:
- the text appears word for word at its location
- the location is inside the safe zone
- prose is 110 words or fewer, verse 10 lines or fewer
- appeal, mood, themes and difficulty use the controlled vocabulary
- the passage isn't already featured

The script writes `review.csv`, sorted with the critic's strongest picks first.

## 4. Critique — critic prompt (a separate pass that doesn't see the selector's reasoning)

```
You are the second reader for Passages. Below are candidate passages proposed by
another editor for a feed that should make ordinary readers want to read the
book. Judge each one coldly, as a reader scrolling on a phone who has never
heard of this book.

For each candidate add:
critic_hook        1–5  Would I stop scrolling and tap? (5 = absolutely)
critic_standalone  1–5  Does it make sense with zero context?
critic_spoiler     low / medium / high  Does the passage OR the note reveal plot?
critic_comment     ≤ 20 words: the main reason for your scores; if the note can
                   be improved, give the improved note instead.

Be strict: a typical good slate has a few 5s, many 3–4s and some 1–2s.
Penalize: generic wisdom, passages that sound impressive but are dull, notes
that over-explain or praise, anything that only works if you know the book.

Then judge the slate as a whole in 2–3 sentences: is there enough variety of
mood and appeal? What kind of passage is missing?
```

Candidates with a hook score of 2 or lower, or any "high" spoiler rating, are cut before the human sees them.

## 5. Review — a person

Open `review.csv` in Google Sheets. For each row, answer one question in `verdict`:

> **If this came up on my phone, would I want to know what book it's from?**  yes / maybe / no

You don't need to judge literary merit. The selector and critic already filtered for that; what matters is whether a real reader is curious, and you are one. Add a word in `your_comment` when something bothers you ("note gives too much away", "boring", "love this"). Those comments get folded back into the prompts.

## 6. Publish — `tools/review_sheet.py apply review.csv`

Appends every `yes` row to `data/passages.csv` with status `keep`. `maybe` rows stay in the sheet for later.

## 7. Learn — after launch

From GoatCounter, per passage:
- **about ÷ view** shows whether a passage makes people curious.
- **start ÷ about** shows whether the note and premise turn curiosity into reading.

Passages that fall well below the median after enough views (say, 30 or more) get replaced. The best performers show what to look for next, and those patterns go back into the selector prompt.

---

## Classification (used by the feed's taste learning)

| Field | Values | Meaning |
|---|---|---|
| appeal | imagery, voice, humor, insight, emotion, tension | why it hooks (1–2) |
| mood | joyful, tender, melancholy, dark, wry, contemplative | overall feeling (1) |
| themes | love, solitude, ambition, family, childhood, nature, sea, city, death, time-memory, identity, society, faith, art, freedom, morality | subject (1–3) |
| difficulty | 1, 2, 3 | how easy it is to read cold |

The feed learns on the device from how someone uses it: lingering, skipping, opening, saving, sharing and starting to read. It shifts toward passages with the features they respond to, but about 30% of picks stay random, and the first 3 cards of each visit are always random. Readers can turn this off or reset it in Settings.
