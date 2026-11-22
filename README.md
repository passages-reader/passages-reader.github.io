# Passages

A feed of literature, one passage per screen. When a passage stops you, tap it to find out what the work is, then read the whole thing right there.

**[passages-reader.github.io](https://passages-reader.github.io)**

---

## Why

People rarely choose a book because of its title, its rating or a plot summary. More often someone reads them a paragraph, or a line turns up somewhere and won't go away. The writing itself does the persuading.

Most discovery online skips that step. Lists, reviews and star ratings tell you about a book without letting you read any of it. Feeds, meanwhile, are very good at holding attention and rarely lead anywhere.

Passages puts the writing first. You scroll as you would anywhere else, but each screen holds a few lines of real literature, chosen to show what the work is like. If one gets to you, the full text is one tap away, free, with nothing to sign up for.

## Principles

**The writing comes first.** A passage earns its place by what it does on the page, not by how famous the author is or how quotable the line sounds.

**Discovery should lead somewhere.** The point of a passage is the work behind it. Success means someone starts reading, not that they kept scrolling.

**Literature is more than novels.** Stories and poems sit in the same feed as novels and get the same care. Essays and other forms will follow.

**No language is the centre.** The feed starts in English and Portuguese because that's where it began. The aim is literature from many traditions, each read in its own language where possible.

## What it does today

- **Feed.** Full-screen passages from novels, stories and poems, in English and Portuguese. Portuguese passages have an optional English translation, labelled as AI-made.
- **About this work.** Tap a passage for a spoiler-free description of the work, a short note on why that passage was chosen, and an honest idea of what reading it involves: how long it takes, and whether it starts slowly.
- **Reader.** Every work can be read in full, from the first page. The passage that brought you is highlighted when you reach it, and your place is saved.
- **Save and share.** Keep passages, or send one to someone as a link.
- **A feed that adapts.** The app notices which passages you linger on, open, save or start reading, and gradually shows more like them. About a third of what it shows stays random, so it keeps surprising you. You can also mark a passage "Not for me", or hide whole forms (say, poetry) in Settings. This happens only on your device, and you can turn it off or reset it.

There are no accounts, followers, likes or ratings.

## What this version is testing

One question: **can a single passage make someone want to read the work it comes from, and then actually read it?**

To answer it, the site counts a few anonymous events with [GoatCounter](https://www.goatcounter.com): a passage seen, a passage opened, a book started, a chapter reached. It uses no cookies and collects nothing that identifies anyone.

## Where it could go

If the answer is yes, the plan is to build outward from the same idea. That would mean accounts, so reading follows you between devices. It would also mean ways to collect, annotate and pass passages to other people, a much larger and more international catalogue, and eventually a place where living writers can publish directly to readers. None of that exists yet, and all of it depends on the first question.

## How passages are chosen

Only the early part of each work is eligible: roughly the first 40% of a novel, so a passage can't give away the ending. From that section, an AI model proposes a shortlist and drafts the notes. A script then confirms every passage word for word against the source. A second, independent AI pass scores the candidates and cuts the weak ones, and a person makes the final decision.

The AI is there to cover more ground than one person could read, not to decide what's good. Readers have the last word: passages that rarely make anyone curious are replaced.

The English texts come from [Standard Ebooks](https://standardebooks.org) and the Portuguese texts from [Project Gutenberg](https://www.gutenberg.org). All the works, and the translations used, are in the public domain.

## Under the hood

A static site: plain HTML, CSS and JavaScript on GitHub Pages, with no server. The passages live in a CSV file you can open in a spreadsheet, and each work is stored as a JSON file. Everything a reader saves stays in their own browser.

- [docs/tech-spec.md](docs/tech-spec.md): how the code works
- [docs/curation-pipeline.md](docs/curation-pipeline.md): how passages are chosen, including the prompts
- [docs/maintaining.md](docs/maintaining.md): updating the site, everyday edits, reading the numbers
