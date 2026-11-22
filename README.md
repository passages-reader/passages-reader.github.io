# Passages

Passages helps people discover literature through the writing itself, one passage at a time, and makes it easier to begin reading.

**[passages-reader.github.io](https://passages-reader.github.io)**

---

## Why

Thousands of classic works are in the public domain and cost nothing to read, yet many people never begin them. Usually the obstacle isn't availability or price. It's everything that comes before the first page:

- **Discovery.** Books reach us through covers, reviews, bestseller lists and popularity-driven algorithms, which rarely let us judge a writer by the writing.
- **Intimidation.** A long novel, an unfamiliar author or a book known as "difficult" can feel like an obligation instead of an invitation.
- **The commitment of starting.** It's hard to know whether you'll enjoy 600 pages before you've read one.
- **Limited horizons.** Most readers meet a narrow range of authors, languages and traditions.

Passages is for people who can read but don't often read literature: someone who has always meant to try Dostoyevsky, someone who has never found a poet they love, someone who rarely meets literature from their own language. The aim isn't to tell people what they ought to read. It's to help them find something they want to read.

## How it works

A passage can do something a description or a review can't: let you experience the writing yourself. The passage doesn't replace the work. It's an invitation into it.

1. **Discover.** The feed shows one passage per screen, from a novel, a story or a poem. The writing comes first; the title and author are kept small.
2. **Explore.** Tap a passage for a short, spoiler-free introduction to the work, a note on why that passage was chosen, and an honest idea of what reading it involves: roughly how long it takes, and whether it starts slowly.
3. **Read.** Begin the complete work from its first page, in the same place, free.
4. **Continue.** When you reach the passage that first drew you in, it's highlighted in its original context. Your place is saved as you go.
5. **Discover further.** Novels, stories and poems share the feed, and the collection is meant to keep widening across periods, languages and forms.

The feed adapts quietly. It notices which passages you open, save or start reading and shows more like them, but about a third of what it shows stays random, so you keep meeting the unfamiliar. You can mark a passage "Not for me", hide whole forms such as poetry, or switch the learning off. All of this stays on your device. There are no accounts.

## Principles

1. **Access comes first.** Public-domain works stay freely discoverable and readable. The core experience doesn't depend on a subscription.
2. **Reading matters more than scrolling.** The feed is a way into literature, not an end in itself. It should be easy to leave the feed and start reading.
3. **Literature should be broad and representative.** The collection makes room for different languages, cultures, periods, traditions and forms, not only what's already popular.
4. **Editorial judgment remains human.** Technology helps find and evaluate candidate passages. People decide what belongs and how it's presented.
5. **Readers deserve privacy.** Collect only what's needed to improve the experience, and never sell reader data.
6. **The mission should guide growth.** Funding, partnerships and features are worth having only if they make literature more accessible.

## What the pilot measures

The main question is whether Passages helps people read works they would otherwise never have started.

- **Works started:** how often curiosity (opening a passage's introduction) turns into starting the work.
- **Continued reading:** whether people who start reach the second chapter, or an equivalent point in a shorter work.
- **Passage interest:** which passages make people want to learn more.
- **Reader confidence and breadth of discovery:** whether literature feels more approachable, and whether people try unfamiliar authors and traditions. These come from talking to readers, not from analytics.

The usage data is anonymous and aggregate, collected with [GoatCounter](https://www.goatcounter.com): no cookies, nothing that identifies anyone. Time spent in the feed, swipes and daily opens are deliberately not measures of success. Someone who leaves the app after two minutes and spends the evening reading Chekhov is a success.

## Where things stand

Passages is an independent project with a working prototype. Public-domain works are the natural starting point because they can be offered complete and free. The ambition is broader than the classics or the public domain. Reading with others, living writers, contemporary works through publishers and libraries, and many more languages are all possible directions, as long as each one serves the mission.

The immediate priorities are modest:
- test the experience with readers who don't usually read classics, poetry or literary fiction
- seek advice from librarians, scholars, editors, translators, educators and people in public humanities
- keep improving the collection through a transparent editorial process
- learn what kind of support could make the project sustainable

## How passages are chosen

Only the early part of a work is eligible: roughly the first 40% of a novel, so nothing gives away the ending. Within that section, an AI model proposes a shortlist and drafts the notes, and a script checks every passage word for word against the source. A second, independent pass cuts weak candidates. A person then decides what goes in and edits the notes. After that, readers have the last word: passages that don't make anyone curious are replaced.

The English texts come from [Standard Ebooks](https://standardebooks.org) and the Portuguese texts from [Project Gutenberg](https://www.gutenberg.org). Every work and translation used is in the public domain. AI-made translations of Portuguese passages are labelled as such.

## Under the hood

A static site: plain HTML, CSS and JavaScript on GitHub Pages, with no server. Passages are stored in a spreadsheet-friendly CSV, and each work is a JSON file. Everything a reader saves stays in their browser.

- [docs/mission.md](docs/mission.md): mission, theory of change, principles and how impact is measured
- [docs/tech-spec.md](docs/tech-spec.md): how the code works
- [docs/curation-pipeline.md](docs/curation-pipeline.md): how passages are chosen, including the prompts
- [docs/maintaining.md](docs/maintaining.md): updating the site, everyday edits, reading the numbers

## Who's behind it

Passages is made by Jose Renato, a physician from Brazil and a lifelong reader. [More about me, and how to get in touch.](https://passages-reader.github.io/me.html)

---

*Passages begins with a simple belief: people are more likely to read something when they have the chance to fall in love with the writing first.*
