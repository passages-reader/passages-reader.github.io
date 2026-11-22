/* ============================================================
   about.js — fills in "What's in the library" on the About page
   from data/books.csv, grouped into novels, stories and poems.
   ============================================================ */

loadLibrary().then(({ books, passages }) => {
  const groups = { novel: "Novels", story: "Stories", poem: "Poems" };
  const box = document.getElementById("library");
  box.innerHTML = "";

  for (const [kind, label] of Object.entries(groups)) {
    const list = Object.values(books)
      .filter(b => b.kind === kind)
      .sort((a, b) => a.author.localeCompare(b.author) || a.title.localeCompare(b.title));
    if (!list.length) continue;

    const h = document.createElement("h3");
    h.textContent = label;
    const ul = document.createElement("ul");
    for (const b of list) {
      const li = document.createElement("li");
      const title = document.createElement("a");
      title.href = "reader.html?book=" + encodeURIComponent(b.id);   // opens the work in the reader
      title.textContent = b.title;
      li.append(title, " — " + b.author + ", " + b.year + (b.translator ? " (trans. " + b.translator + ")" : ""));
      ul.append(li);
    }
    box.append(h, ul);
  }

  const count = document.createElement("p");
  count.className = "muted small";
  count.textContent = `${passages.length} passages from ${Object.keys(books).length} works so far.`;
  box.append(count);
}).catch(() => {
  document.getElementById("library").textContent = "Couldn't load the list.";
});
