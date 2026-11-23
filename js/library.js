/* ============================================================
   library.js — builds the list on library.html from data/books.csv:
   every work, grouped into novels, stories and poems, sorted by
   author. Each title opens the work in the reader.
   Works you've finished or started are marked.
   ============================================================ */

loadLibrary().then(({ books, passages }) => {
  const groups = { novel: "Novels", story: "Stories", poem: "Poems" };
  const box = document.getElementById("library");
  box.innerHTML = "";
  const finished = Store.finished();
  const started = new Set(Store.booksInProgress().map(r => r.book));

  for (const [kind, label] of Object.entries(groups)) {
    const list = Object.values(books)
      .filter(b => b.kind === kind)
      .sort((a, b) => a.author.localeCompare(b.author) || a.title.localeCompare(b.title));
    if (!list.length) continue;

    const h = document.createElement("h2");
    h.textContent = `${label} · ${list.length}`;
    const ul = document.createElement("ul");
    ul.className = "library-list";
    for (const b of list) {
      const li = document.createElement("li");
      const title = document.createElement("a");
      title.className = "library-title";
      title.href = "reader.html?book=" + encodeURIComponent(b.id);   // opens the work in the reader
      title.textContent = b.title;

      // "Anton Chekhov · 1898 · trans. Constance Garnett · about 20 minutes"
      const details = [b.author, b.year];
      if (b.translator) details.push("trans. " + b.translator);
      if (b.language !== "en") details.push(LANGUAGE_NAMES[b.language] || b.language);
      details.push(readingTime(b));
      const meta = document.createElement("span");
      meta.className = "library-meta";
      meta.textContent = details.filter(Boolean).join(" · ");

      li.append(title);
      if (b.id in finished) li.append(mark("Read"));
      else if (started.has(b.id)) li.append(mark("Started"));
      li.append(meta);
      ul.append(li);
    }
    box.append(h, ul);
  }

  document.getElementById("library-count").textContent =
    `${Object.keys(books).length} works and ${passages.length} passages so far, all free to read in full.`;
}).catch(() => {
  document.getElementById("library").textContent = "Couldn't load the list.";
});

function mark(text) {
  const s = document.createElement("span");
  s.className = "library-mark";
  s.textContent = " · " + text;
  return s;
}
