/* ============================================================
   elsewhere.js — "Prefer paper or an e-reader?"

   For novels, a small link under Start reading (feed) and in the
   ⓘ panel (reader) opens a short list of other ways to read the
   same book. Passages wants people to read the book, wherever
   they read it. Plain links: no affiliate codes.

   The list depends on where the reader is, shown as small tabs:
     United States · Brasil · UK · Other
   - The first guess comes from the phone's time zone (it stays on
     the phone; no location permission), not its language: a
     Portuguese-language phone in New York still gets US options.
   - One tap on another tab changes the list; the choice is
     remembered (Store "elsewherePlace").
   What each place shows (the free ebook of our edition first):
   - United States: Libby/OverDrive, WorldCat, Bookshop.org
   - UK: Libby/OverDrive, WorldCat, Bookshop.org UK
   - Brasil: Estante Virtual, searched with the Portuguese title
     (books.csv "title_pt"), so it finds Brazilian translations
   - Other: WorldCat
   Counted: elsewhere/open/<book>, elsewhere/place/<place>,
   elsewhere/<where>/<book>.
   ============================================================ */

const Elsewhere = {
  PLACES: { us: "United States", br: "Brasil", uk: "UK", other: "Other" },

  // Only novels for now: stories and poems are short enough to read here
  applies(b) { return b.kind === "novel"; },

  // Where the reader probably is, from the time zone
  guess() {
    let tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    const brazil = ["Sao_Paulo", "Bahia", "Fortaleza", "Recife", "Belem", "Manaus", "Cuiaba", "Campo_Grande",
      "Porto_Velho", "Boa_Vista", "Rio_Branco", "Noronha", "Araguaina", "Maceio", "Santarem", "Eirunepe"];
    const us = ["New_York", "Chicago", "Denver", "Los_Angeles", "Phoenix", "Anchorage", "Detroit", "Boise",
      "Juneau", "Sitka", "Nome", "Yakutat", "Metlakatla", "Adak", "Menominee", "Indiana/", "Kentucky/", "North_Dakota/"];
    if (tz.startsWith("America/") && brazil.some(z => tz.includes(z))) return "br";
    if ((tz.startsWith("America/") && us.some(z => tz.includes(z))) || tz === "Pacific/Honolulu") return "us";
    if (tz === "Europe/London" || tz === "Europe/Belfast") return "uk";
    return "other";
  },
  place() { return Store.get("elsewherePlace", "") || Elsewhere.guess(); },

  links(b, place) {
    const q = (title) => encodeURIComponent(`${title} ${b.author}`);
    const list = [];
    if (b.ebook) list.push({
      id: "ebook", href: b.ebook, label: "Free ebook",
      detail: (b.ebook.includes("gutenberg") ? "The same text, for any e-reader · Project Gutenberg"
        : "The same text, for Kindle, Kobo and other e-readers · Standard Ebooks")
        + (place === "br" && b.language === "en" ? " · in English" : ""),
    });
    if (place === "br") {
      const translated = b.language !== "pt";
      const title = b.title_pt || b.title;
      list.push({ id: "estante", href: `https://www.estantevirtual.com.br/busca?q=${q(title)}`,
        label: translated ? "Buy it in Portuguese" : "Buy a copy",
        detail: (translated ? `${title}, new and used` : "New and used, from sebos and bookstores") + " · Estante Virtual" });
    } else {
      if (place !== "other") list.push({ id: "libby", href: `https://www.overdrive.com/search?q=${q(b.title)}`,
        label: "Borrow it", detail: "Ebook or audiobook with a library card · Libby" });
      list.push({ id: "worldcat", href: `https://search.worldcat.org/search?q=${q(b.title)}`,
        label: "Find it at a library near you", detail: "WorldCat" });
      if (place === "us") list.push({ id: "bookshop", href: `https://bookshop.org/search?keywords=${q(b.title)}`,
        label: "Buy from an independent bookstore", detail: "Bookshop.org" });
      if (place === "uk") list.push({ id: "bookshop-uk", href: `https://uk.bookshop.org/search?keywords=${q(b.title)}`,
        label: "Buy from an independent bookstore", detail: "Bookshop.org UK" });
    }
    return list;
  },

  // The block itself: a small link that opens the list in place.
  // make(tag, attrs, ...children) is the page's element helper.
  block(b, make) {
    const box = make("div", { class: "elsewhere" });
    const show = (place) => {
      const tabs = make("div", { class: "elsewhere-places", role: "group", "aria-label": "Where are you?" },
        Object.entries(Elsewhere.PLACES).map(([id, name]) =>
          make("button", { class: id === place ? "on" : "", "aria-pressed": String(id === place),
            onclick: () => { Store.set("elsewherePlace", id); track("elsewhere", "place/" + id); show(id); } }, name)));
      const items = Elsewhere.links(b, place).map(l =>
        make("li", {},
          make("a", { href: l.href, target: "_blank", rel: "noopener",
            onclick: () => track("elsewhere", l.id + "/" + b.id) }, l.label + " ↗"),
          make("span", { class: "elsewhere-detail" }, " · " + l.detail)));
      const parts = [make("h3", { class: "about-label" }, "Read it elsewhere"), tabs, make("ul", { class: "elsewhere-list" }, ...items)];
      if (b.ebook && !b.ebook.includes("gutenberg"))
        parts.push(make("p", { class: "elsewhere-note" }, "On a Kindle? Download the EPUB and use Send to Kindle."));
      if (b.translator && place !== "br")
        parts.push(make("p", { class: "elsewhere-note" },
          `Ours is ${b.translator}’s translation. Libraries and bookstores often have newer ones; they’re good too.`));
      box.replaceChildren(...parts);
    };
    box.append(make("button", { class: "linklike elsewhere-open",
      onclick: () => { track("elsewhere", "open/" + b.id); show(Elsewhere.place()); } }, "Prefer paper or an e-reader?"));
    return box;
  },
};
