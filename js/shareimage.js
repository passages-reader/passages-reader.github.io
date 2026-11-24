/* ============================================================
   shareimage.js — turns a passage into a story-sized picture
   (1080 × 1920, the size Instagram and WhatsApp stories use),
   in the reader's current theme:

       Passages.                      ← the wordmark, with its clay dot
       ¶                              ← the drawn pilcrow: a passage begins
       …the passage itself…
       ──────
       Title (italic)
       AUTHOR · YEAR
       Read the whole story, free
       passages-reader.github.io

   Drawn on a <canvas>, so it works offline and needs no server.
   ============================================================ */

const ShareImage = {
  W: 1080, H: 1920, PAD: 112,

  // The theme's colours, read from the page's CSS variables
  colours() {
    const css = getComputedStyle(document.documentElement);
    const v = (name) => css.getPropertyValue(name).trim();
    return { paper: v("--paper"), ink: v("--ink"), ink2: v("--ink-2"), line: v("--line"), accent: v("--accent") };
  },

  // Make the picture; resolves to a PNG Blob
  async make(p) {
    const serif = '"EB Garamond", Garamond, Georgia, serif';
    const sans = 'Inter, system-ui, -apple-system, sans-serif';
    // Make sure the fonts have arrived before drawing with them
    try {
      await Promise.all([
        document.fonts.load(`64px "EB Garamond"`),
        document.fonts.load(`italic 44px "EB Garamond"`),
        document.fonts.load(`26px Inter`),
      ]);
    } catch (e) {}

    const { W, H, PAD } = ShareImage;
    const c = ShareImage.colours();
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext("2d");
    g.fillStyle = c.paper; g.fillRect(0, 0, W, H);
    g.textBaseline = "alphabetic";

    // Wordmark: "Passages" + clay dot
    g.fillStyle = c.ink; g.font = `52px ${serif}`;
    g.fillText("Passages", PAD, 212);
    const wmWidth = g.measureText("Passages").width;
    g.fillStyle = c.accent;
    g.beginPath(); g.arc(PAD + wmWidth + 10, 206, 6, 0, Math.PI * 2); g.fill();

    // Bottom block (drawn first so we know how much room the passage has)
    const b = p.bookInfo;
    const kindWord = b.kind === "poem" ? "poem" : b.kind === "story" ? "story" : "book";
    g.font = `30px ${sans}`;
    g.fillStyle = c.ink; g.fillText(p.whole ? `More ${kindWord}s like this, free` : `Read the whole ${kindWord}, free`, PAD, H - 186);
    g.fillStyle = c.accent; g.fillText(location.host || "passages-reader.github.io", PAD, H - 140);

    // Title and author, above the bottom block
    const metaTop = H - 430;
    g.fillStyle = c.line; g.fillRect(PAD, metaTop, W - PAD * 2, 2);
    g.fillStyle = c.ink; g.font = `italic 46px ${serif}`;
    g.fillText(ShareImage.fit(g, b.title, W - PAD * 2), PAD, metaTop + 84);
    g.fillStyle = c.ink2; g.font = `500 26px ${sans}`;
    const by = [b.author, b.year].filter(Boolean).join(" · ").toUpperCase();
    ShareImage.spaced(g, ShareImage.fit(g, by, W - PAD * 2), PAD, metaTop + 140, 3.5);

    // The passage: as large as fits between the wordmark and the title
    const top = 380, bottom = metaTop - 70, width = W - PAD * 2;
    // Poems: prefer a size where every line of the poem fits on one line;
    // only if none does, let long lines wrap (with a hanging indent).
    const verse = p.text.includes("\n");
    const verseLines = p.text.split("\n").length;
    const fits = (n, s) => n * s * 1.38 <= bottom - top - 90;
    let size = 66, lines;
    for (; size >= 34; size -= 2) {
      g.font = `${size}px ${serif}`;
      lines = ShareImage.wrap(g, p.text, width, verse);
      if (verse && size >= 40 && lines.length > verseLines) continue;
      if (fits(lines.length, size)) break;
    }
    if (verse && size < 40) {             // nothing fitted unwrapped: take the largest size that fits wrapped
      for (size = 66; size >= 34; size -= 2) {
        g.font = `${size}px ${serif}`;
        lines = ShareImage.wrap(g, p.text, width, verse);
        if (fits(lines.length, size)) break;
      }
    }
    const lh = size * 1.38;
    const blockH = 90 + lines.length * lh;
    let y = top + Math.max(0, (bottom - top - blockH) / 2);   // centre it vertically

    // The drawn pilcrow (same shape as the icon), in the accent colour
    ShareImage.pilcrow(g, PAD, y, 64, c.accent);
    y += 90 + size;
    g.fillStyle = c.ink; g.font = `${size}px ${serif}`;
    for (const line of lines) { g.fillText(line.text, PAD + (line.indent ? size * 0.9 : 0), y); y += lh; }

    return new Promise(res => canvas.toBlob(res, "image/png"));
  },

  // Word-wrap text to a width: a list of { text, indent }. Verse keeps its own
  // line breaks, and a verse line that has to wrap continues with an indent.
  wrap(g, text, width, verse) {
    const out = [];
    for (const para of text.split("\n")) {
      if (!para.trim()) { out.push({ text: "" }); continue; }
      let line = "", cont = false;
      const room = () => width - (verse && cont ? g.measureText("M").width * 0.9 : 0);
      for (const word of para.split(/\s+/)) {
        const test = line ? line + " " + word : word;
        if (g.measureText(test).width > room() && line) { out.push({ text: line, indent: verse && cont }); line = word; cont = true; }
        else line = test;
      }
      out.push({ text: line, indent: verse && cont });
    }
    return out;
  },

  // Shorten a single line with "…" if it's too wide
  fit(g, text, width) {
    if (g.measureText(text).width <= width) return text;
    while (text.length > 1 && g.measureText(text + "…").width > width) text = text.slice(0, -1);
    return text.trimEnd() + "…";
  },

  // Letter-spaced small capitals (canvas has no letter-spacing everywhere)
  spaced(g, text, x, y, gap) {
    for (const ch of text) { g.fillText(ch, x, y); x += g.measureText(ch).width + gap; }
  },

  // The pilcrow from the icon: a half-circle and two bars, drawn in a size×size box
  pilcrow(g, x, y, size, colour) {
    const s = size / 100;
    g.save(); g.translate(x - 22 * s, y - 17 * s); g.scale(s, s); g.fillStyle = colour;
    g.beginPath(); g.moveTo(42, 17); g.arc(42, 37, 20, -Math.PI / 2, Math.PI / 2, true); g.lineTo(55, 57); g.lineTo(55, 17); g.closePath(); g.fill();
    g.fillRect(52, 17, 7, 66); g.fillRect(67, 17, 7, 66); g.fillRect(42, 17, 32, 7);
    g.restore();
  },
};
