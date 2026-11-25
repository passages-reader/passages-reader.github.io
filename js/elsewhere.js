/* ============================================================
   elsewhere.js — "Prefer paper or an e-reader?"

   For novels, a small link in the About panel (feed) and the ⓘ
   panel (reader) opens a short list of other ways to read the
   same book. Passages wants people to read the book, wherever
   they read it. Plain links: no affiliate codes.

   Which links appear depends on the phone's language:
   - everyone: the free ebook of our edition (Standard Ebooks, or
     Project Gutenberg for Portuguese works), from books.csv "ebook";
   - Portuguese phones: Estante Virtual (used copies from sebos);
   - everyone else: Libby/OverDrive (borrow), WorldCat (a library
     near you), Bookshop.org (independent bookstores).
   Taps are counted: elsewhere/open/<book>, elsewhere/<where>/<book>.
   ============================================================ */

const Elsewhere = {
  // Only novels for now: stories and poems are short enough to read here
  applies(b) { return b.kind === "novel"; },

  links(b) {
    const q = encodeURIComponent(`${b.title} ${b.author}`);
    const portuguese = (navigator.language || "").toLowerCase().startsWith("pt");
    const list = [];
    if (b.ebook) list.push({
      id: "ebook", href: b.ebook,
      label: "Free ebook",
      detail: b.ebook.includes("gutenberg")
        ? "The same text, for any e-reader · Project Gutenberg"
        : "The same text, for Kindle, Kobo and other e-readers · Standard Ebooks",
    });
    if (portuguese) {
      list.push({ id: "estante", href: `https://www.estantevirtual.com.br/busca?q=${q}`,
        label: "Buy a used copy", detail: "From sebos and small bookstores · Estante Virtual" });
    } else {
      list.push(
        { id: "libby", href: `https://www.overdrive.com/search?q=${q}`,
          label: "Borrow it", detail: "Ebook or audiobook with a library card · Libby" },
        { id: "worldcat", href: `https://search.worldcat.org/search?q=${q}`,
          label: "Find it at a library near you", detail: "WorldCat" },
        { id: "bookshop", href: `https://bookshop.org/search?keywords=${q}`,
          label: "Buy from an independent bookstore", detail: "Bookshop.org" },
      );
    }
    return list;
  },

  // The block itself: a small link that opens the list in place.
  // make(tag, attrs, ...children) is the page's element helper.
  block(b, make) {
    const box = make("div", { class: "elsewhere" });
    const open = () => {
      track("elsewhere", "open/" + b.id);
      const items = Elsewhere.links(b).map(l =>
        make("li", {},
          make("a", { href: l.href, target: "_blank", rel: "noopener",
            onclick: () => track("elsewhere", l.id + "/" + b.id) }, l.label + " ↗"),
          make("span", { class: "elsewhere-detail" }, " · " + l.detail)));
      const parts = [make("h3", { class: "about-label" }, "Read it elsewhere"), make("ul", { class: "elsewhere-list" }, ...items)];
      if (b.ebook && !b.ebook.includes("gutenberg"))
        parts.push(make("p", { class: "elsewhere-note" }, "On a Kindle? Download the EPUB and use Send to Kindle."));
      if (b.translator)
        parts.push(make("p", { class: "elsewhere-note" },
          `Ours is ${b.translator}’s translation. Libraries and bookstores often have newer ones; they’re good too.`));
      box.replaceChildren(...parts);
    };
    box.append(make("button", { class: "linklike elsewhere-open", onclick: open }, "Prefer paper or an e-reader?"));
    return box;
  },
};
