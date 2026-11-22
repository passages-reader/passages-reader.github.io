/* ============================================================
   data.js — loads the CSV files and book files.

   books.csv     one row per work (title, author, premise...)
   passages.csv  one row per passage (text, note, location...)
   books/*.json  the full text of each work, split into chapters
   ============================================================ */

// Turns CSV text into a list of objects, using the first row as column names.
// Handles quoted fields with commas and line breaks inside them (as Sheets/Excel export them).
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }   // "" means a literal quote
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift().map(h => h.trim());
  return rows
    .filter(r => r.some(cell => cell.trim() !== ""))                  // skip blank lines
    .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] || "").trim()])));
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load " + url);
  return res.text();
}

// Loads books + passages. Returns { books: {id: book}, passages: [...] }.
// Passages whose status is "cut" are left out, so you can hide one without deleting it.
async function loadLibrary() {
  const [booksText, passagesText] = await Promise.all([
    fetchText(CONFIG.booksCsv), fetchText(CONFIG.passagesCsv),
  ]);
  const books = {};
  for (const b of parseCSV(booksText)) books[b.id] = b;
  const passages = parseCSV(passagesText)
    .filter(p => p.status !== "cut" && books[p.book])
    .map(p => ({ ...p, bookInfo: books[p.book] }));
  return { books, passages };
}

// Loads one book's full text.
async function loadBook(id) {
  const res = await fetch(CONFIG.booksFolder + id + ".json");
  if (!res.ok) throw new Error("Could not load book " + id);
  return res.json();
}

// "3.12" -> { ch: 3, p: 12 }
function parseLocation(loc) {
  const [ch, p] = String(loc).split(".").map(Number);
  return { ch: ch || 0, p: p || 0 };
}

// A short label like "Novel · 1813" or "Story · 1899 · trans. Constance Garnett"
function bookMeta(b) {
  const kind = { novel: "Novel", story: "Short story", poem: "Poem" }[b.kind] || "";
  return [kind, b.year, b.translator && "trans. " + b.translator].filter(Boolean).join(" · ");
}
