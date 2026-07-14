const markdownIt = require("markdown-it");
const yaml = require("js-yaml");
const fs = require("fs");

// Markdown renderer. html:true lets prose contain occasional raw HTML if ever needed.
// typographer/quotes off because the content already uses curly quotes.
const md = markdownIt({ html: true, linkify: false, typographer: false });

// ---------------------------------------------------------------------------
// Citations
//
// Authors cite by linking a locator to a bibliography anchor in prose:
//     [p. 41](bibliography.html#gioia-2008)
// (Older labels like "(Lyons, p.182)" work too — only the page numbers are read.)
// A build transform replaces each such link with a numbered superscript marker
// and collects the citations into a "Sources" list at the bottom of the section.
// Unknown anchors fail the build.
//
// NOTE: bibliography.yaml is read once at startup; restart `npm run serve`
// after editing it.
// ---------------------------------------------------------------------------
const bibEntries = yaml.load(fs.readFileSync("src/_data/bibliography.yaml", "utf8"));
const bib = Object.fromEntries(bibEntries.map((e) => [e.id, e]));

// Vocabulary terms (src/_data/vocab.yaml), keyed by slug. Links in prose
// to vocabulary.html#<slug> are validated and get a hover-definition tooltip.
// Read once at startup, like the bibliography. (Named `vocab`, not
// `vocabulary`, so it doesn't collide with lessons' per-page vocabulary lists.)
const cleanSlugJS = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[’'‘“”"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const vocabEntries = yaml.load(fs.readFileSync("src/_data/vocab.yaml", "utf8"));
const vocab = Object.fromEntries(vocabEntries.map((v) => [cleanSlugJS(v.term), v]));

// "64-65" -> ", pp. 64–65";  "41" -> ", p. 41";  "" -> ""
const pagesLabel = (pages) => {
  if (!pages) return "";
  const p = String(pages).replace(/-/g, "–").replace(/\s+/g, "");
  return (/[–,]/.test(p) ? ", pp. " : ", p. ") + p;
};

// Pull page numbers out of a citation label. Handles "p.182", "pp. 64-65",
// and bare trailing numbers ("Gioia, 2008, 41" -> "41"; 4-digit years excluded).
const parseLocator = (label) => {
  const text = String(label).replace(/<[^>]*>/g, "").replace(/[()\[\]]/g, "").trim();
  let m = text.match(/pp?\.?\s*(\d+(?:\s*[-–]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–]\s*\d+)?)*)/i);
  if (m) return m[1].replace(/\s+/g, "");
  m = text.match(/,\s*(\d{1,3}(?:\s*[-–]\s*\d+)?)\s*$/);
  if (m) return m[1].replace(/\s+/g, "");
  return "";
};

const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

// Rewrite one page: citation links -> superscript markers, one number per
// SOURCE (not per citation), collected in a single deduplicated "Sources" card
// at the bottom of the page. Page numbers stay with the inline markers (shown
// in the hover tooltip); the bottom list names each source once and links to
// its full citation in the bibliography. General references from sections'
// `sources:` front matter (rendered by the template) are merged in, minus any
// source already cited inline.
const processPage = (content, pagePath) => {
  let existing = "";
  let body = content.replace(/<section class="sources"[\s\S]*?<\/section>/, (m) => {
    existing = m;
    return "@@SOURCES@@";
  });
  // Endnote model, consolidated per source: each source gets ONE numbered
  // note, in order of first citation, aggregating every page cited
  // ("Gioia (2008), p. 41, pp. 40–41"). Markers share the source's number;
  // each marker's own page stays in its tooltip. Two kinds:
  //   [p. 41](bibliography.html#gioia-2008)      -> note links to the bibliography
  //   [^Label text](https://example.com/...)     -> one-off web note, no bibliography entry
  const notes = []; // {kind:'bib', ref, pages:[]} | {kind:'web', href, label}
  const byKey = new Map();
  const addNote = (key, make) => {
    if (byKey.has(key)) return byKey.get(key);
    notes.push(make());
    byKey.set(key, notes.length);
    return notes.length;
  };
  const addPages = (note, pages) => {
    if (pages && !note.pages.includes(pages)) note.pages.push(pages);
  };
  body = body.replace(
    /<a href="([^"]+)">(\^?)([\s\S]*?)<\/a>/g,
    (m, href, caret, label) => {
      const bibMatch = href.match(/^bibliography\.html#([a-z0-9-]+)$/);
      if (bibMatch) {
        const ref = bibMatch[1];
        const entry = bib[ref];
        if (!entry)
          throw new Error(`Unknown bibliography ref "${ref}" in ${pagePath}`);
        const pages = parseLocator(label);
        const n = addNote(`bib:${ref}`, () => ({ kind: "bib", ref, pages: [] }));
        addPages(notes[n - 1], pages);
        const tip = escAttr(entry.label + pagesLabel(pages));
        return `<sup class="cite"><a href="#src-${n}" title="${tip}">${n}</a></sup>`;
      }
      if (caret === "^" && /^https?:/.test(href)) {
        const n = addNote(`web:${href}`, () => ({ kind: "web", href, label }));
        const tip = escAttr(label.replace(/<[^>]*>/g, ""));
        return `<sup class="cite"><a href="#src-${n}" title="${tip}">${n}</a></sup>`;
      }
      return m; // ordinary link, leave untouched
    }
  );
  // Markers sit flush against the preceding word/punctuation.
  body = body.replace(/\s+(<sup class="cite">)/g, "$1");
  // General references from sections' `sources:` fields (rendered by the
  // template). A general reference to a source that's already a numbered note
  // merges its pages into that note; the rest stay in the unnumbered list.
  const general = [];
  if (existing) {
    const ulm = existing.match(/<ul class="cite-general">([\s\S]*?)<\/ul>/);
    if (ulm)
      for (const li of ulm[1].matchAll(/<li>[\s\S]*?<\/li>/g)) {
        const item = li[0];
        const bibm = item.match(
          /bibliography\.html#([a-z0-9-]+)"[^>]*>[\s\S]*?<\/a>(?: — (pp?\.\s[^<\n]*))?/
        );
        if (bibm) {
          const n = byKey.get(`bib:${bibm[1]}`);
          if (n) {
            const pages = bibm[2]
              ? bibm[2].trim().replace(/^pp?\.\s*/, "").replace(/\s+/g, "")
              : "";
            addPages(notes[n - 1], pages);
            continue;
          }
        } else {
          const hm = item.match(/<a href="([^"]+)"/);
          if (hm && byKey.has(`web:${hm[1]}`)) continue;
        }
        general.push(item);
      }
  }
  if (!notes.length && !general.length) return content;
  const noteHtml = (note) => {
    if (note.kind === "web") return `<a href="${note.href}">${note.label}</a>`;
    return (
      `<a href="bibliography.html#${note.ref}">${bib[note.ref].label}</a>` +
      note.pages.map(pagesLabel).join("")
    );
  };
  const ol = notes.length
    ? `\n<ol class="cite-notes">\n` +
      notes.map((note, i) => `<li id="src-${i + 1}">${noteHtml(note)}</li>`).join("\n") +
      `\n</ol>`
    : "";
  const ul = general.length
    ? `\n<ul class="cite-general">\n` + general.join("\n") + `\n</ul>`
    : "";
  const card = `<section class="sources" id="sources">\n<h2>Sources</h2>${ol}${ul}\n</section>`;
  if (existing) return body.replace("@@SOURCES@@", card);
  return body.replace(/<footer>/, card + "\n<footer>");
};

// Render one video as a <figure>. Used by the `videoFig` filter (for videos:
// lists on tracks/sections) and by @video(id) tokens inside prose.
// Optional `size:` small | medium (default) | large controls display width.
const renderVideoFig = (v) => {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const size = v.size || "medium";
  if (!["small", "medium", "large"].includes(size))
    throw new Error(`Unknown video size "${v.size}" (use small, medium, or large)`);
  const sizeClass = size === "medium" ? "" : ` video-${size}`;
  let inner = "";
  if (v.mp4) {
    const poster = v.poster ? ` poster="${esc(v.poster)}"` : "";
    const label = v.title ? ` aria-label="${esc(v.title)}"` : "";
    const fallback = v.link
      ? ` <a href="${esc(v.link)}">Watch it here instead.</a>`
      : "";
    inner =
      `<video controls preload="none"${poster}${label}>` +
      `<source src="${esc(v.mp4)}" type="video/mp4"/>` +
      `Your browser doesn't support embedded video.${fallback}</video>`;
  } else if (v.audio || v.mp3) {
    const label = v.title ? ` aria-label="${esc(v.title)}"` : "";
    const img = v.poster
      ? `<img src="${esc(v.poster)}" alt="${esc(v.title || "")}" class="audio-poster"/>`
      : "";
    inner = `${img}<audio controls preload="none" src="${esc(v.audio || v.mp3)}"${label}>Your browser doesn't support embedded audio.</audio>`;
  } else if (v.youtube) {
    const params = v.params ? `?${v.params}` : "";
    inner = `<iframe src="https://www.youtube.com/embed/${esc(v.youtube)}${params}" title="${esc(v.title || "YouTube video")}" loading="lazy" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen="" class="wide"></iframe>`;
  } else if (v.iframe) {
    inner = `<iframe src="${esc(v.iframe)}" title="${esc(v.title || "Embedded video")}" loading="lazy" frameborder="0" allowfullscreen=""></iframe>`;
  }
  const caption = v.caption
    ? `<figcaption>${md.renderInline(String(v.caption))}</figcaption>`
    : "";
  return `<figure class="video${sizeClass}">${inner}${caption}</figure>`;
};

module.exports = function (eleventyConfig) {
  // Lessons in curriculum order (numeric sort by front-matter `order`).
  eleventyConfig.addCollection("lessonsOrdered", (api) =>
    api.getFilteredByTag("lesson").sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999))
  );

  // Render a markdown string to a full block (paragraphs, lists, blockquotes).
  // Optional `media` map (lesson front matter) enables @video(id) tokens: a
  // paragraph containing only `@video(some-id)` becomes that video's figure.
  eleventyConfig.addFilter("md", (s, media) => {
    if (!s) return "";
    let out = md.render(String(s));
    out = out.replace(
      /<p>\s*@(?:video|audio)\(([\w-]+)((?:\s*,\s*[\w-]+)*)\)\s*<\/p>/g,
      (m, id, opts) => {
        const v = media && media[id];
        if (!v)
          throw new Error(
            `@video/@audio(${id}) has no matching entry in this lesson's media: map`
          );
        const o = { ...v };
        for (const opt of opts.split(",").map((x) => x.trim()).filter(Boolean)) {
          if (opt === "noposter") o.poster = null;
          else if (["small", "medium", "large"].includes(opt)) o.size = opt;
          else
            throw new Error(
              `Unknown @video/@audio option "${opt}" on ${id} (use noposter, small, medium, or large)`
            );
        }
        return renderVideoFig(o);
      }
    );
    if (out.includes("@video(") || out.includes("@audio("))
      throw new Error(
        "A @video/@audio(...) token wasn't expanded - it must sit in its own paragraph"
      );
    return out;
  });
  // Single video object -> <figure> (for videos: lists on tracks/sections).
  eleventyConfig.addFilter("videoFig", renderVideoFig);

  // Listening-guide rows. Preferred authoring: a plain text block, one row per
  // line, "time | description" (commas, colons, and quotes are all safe):
  //   guide: |-
  //     0:00 | Head in, AA
  //     0:36 | Brown (tp) solo
  // Legacy [time, description] arrays still work; extra columns that YAML
  // split off at commas are joined back into the description.
  eleventyConfig.addFilter("guideRows", (guide) => {
    if (!guide) return [];
    // js-yaml (YAML 1.1) parses an unquoted 1:23 as the number 83 - undo that.
    const timeStr = (v) => {
      if (typeof v !== "number") return String(v);
      return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
    };
    if (typeof guide === "string")
      return guide
        .split("\n")
        .filter((l) => l.trim())
        .map((line) => {
          const i = line.indexOf("|");
          if (i === -1)
            throw new Error(
              `Listening-guide line is missing its " | " separator: "${line.trim()}"`
            );
          return { time: line.slice(0, i).trim(), text: line.slice(i + 1).trim() };
        });
    return guide.map((row) =>
      Array.isArray(row)
        ? { time: timeStr(row[0]), text: row.slice(1).map(String).join(", ") }
        : { time: "", text: String(row) }
    );
  });
  // Render markdown without the wrapping <p> (for short inline values).
  eleventyConfig.addFilter("mdInline", (s) => (s ? md.renderInline(String(s)) : ""));

  // Render a section heading, injecting each artist's dates + schema.org Person microdata
  // at their name. `artists` is the single source of truth for the years; the heading string
  // holds only names/structure (e.g. "Clifford Brown & Max Roach", "... Big Band"). Names not
  // in the artists list (ensembles, topic words) are left untouched.
  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  eleventyConfig.addFilter("artistHeading", (heading, artists) => {
    if (!heading) return heading;
    if (!artists || !artists.length) return esc(heading);
    let out = "", cursor = 0;
    for (const a of artists) {
      const idx = heading.indexOf(a.name, cursor);
      if (idx === -1) continue; // name not found in heading; skip (leave as-is)
      out += esc(heading.slice(cursor, idx));
      const dates = a.died ? `${a.born}–${a.died}` : `b. ${a.born}`;
      const death = a.died ? `<meta itemprop="deathDate" content="${a.died}"/>` : "";
      out +=
        `<span itemscope itemtype="https://schema.org/Person">` +
        `<span itemprop="name">${esc(a.name)}</span> ` +
        `<span class="lifespan">(${dates})</span>` +
        `<meta itemprop="birthDate" content="${a.born}"/>${death}</span>`;
      cursor = idx + a.name.length;
    }
    out += esc(heading.slice(cursor));
    return out;
  });

  // Strip decorative surrounding quotes from a title for heading display
  // (quotes belong in prose, not in an <h3>). "“St. Louis Blues”" -> "St. Louis Blues".
  eleventyConfig.addFilter("stripQuotes", (s) => {
    if (!s) return s;
    return String(s).replace(/^[\u201c\u2018"']+\s*/, "").replace(/\s*[\u201d\u2019"']+$/, "");
  });

  // Clean slug for element ids: lowercase, drop quotes/apostrophes, collapse any run of
  // non-alphanumerics to a single hyphen. "“St. Louis Blues”" -> "st-louis-blues".
  eleventyConfig.addFilter("cleanSlug", (s) =>
    String(s)
      .toLowerCase()
      .replace(/[\u2019'\u2018\u201c\u201d"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );

  // YAML files in _data (bibliography.yaml).
  eleventyConfig.addDataExtension("yaml", (contents) => yaml.load(contents));

  // Short label for a bibliography ref, e.g. "gioia-2008" -> "Gioia (2008)".
  // Throws on unknown refs so bad `sources:` entries fail the build.
  eleventyConfig.addFilter("bibLabel", (ref) => {
    const entry = bib[ref];
    if (!entry) throw new Error(`Unknown bibliography ref "${ref}" in a sources: list`);
    return entry.label;
  });
  // General references from all sections' `sources:` lists, in order of
  // appearance. Entries are either bibliography refs ({ref, pages}) or one-off
  // web sources ({url, label}). Pages merge per source ("64-65" + "70" ->
  // "pp. 64–65, 70"). Returns display-ready {href, text, pagesText}.
  eleventyConfig.addFilter("allSourceRefs", (sections) => {
    const map = new Map();
    for (const s of sections || []) {
      const list = s.sources;
      if (!list) continue;
      if (!Array.isArray(list))
        throw new Error(
          `A section's sources: must be a list — start each entry with "- " (section "${s.heading}")`
        );
      for (const src of list) {
        if (src && src.url) {
          if (!map.has(src.url))
            map.set(src.url, {
              href: src.url,
              text: src.label || src.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0],
              pages: [],
            });
          continue;
        }
        if (!src || !src.ref)
          throw new Error(
            `A sources: entry needs a ref (bibliography id) or a url (section "${s.heading}")`
          );
        const entry = bib[src.ref];
        if (!entry)
          throw new Error(`Unknown bibliography ref "${src.ref}" in a sources: list`);
        if (!map.has(src.ref))
          map.set(src.ref, {
            href: `bibliography.html#${src.ref}`,
            text: entry.label,
            pages: [],
          });
        if (src.pages)
          map.get(src.ref).pages.push(
            String(src.pages).replace(/-/g, "–").replace(/\s+/g, "")
          );
      }
    }
    return [...map.values()].map(({ href, text, pages }) => {
      const joined = pages.join(", ");
      return {
        href,
        text,
        pagesText: joined ? (/[–,]/.test(joined) ? "pp. " : "p. ") + joined : "",
      };
    });
  });

  // Turn citation links into numbered footnote markers, one list per page.
  eleventyConfig.addTransform("citations", function (content) {
    if (!this.page.outputPath || !this.page.outputPath.endsWith(".html")) return content;
    if (this.page.outputPath.endsWith("bibliography.html")) return content;
    const hasCitations =
      content.includes("bibliography.html#") ||
      /<a href="https?:[^"]+">\^/.test(content);
    if (!hasCitations) return content;
    return processPage(content, this.page.inputPath);
  });

  // Decorate vocabulary links with hover-definition tooltips. Unknown terms
  // fail the build.
  eleventyConfig.addTransform("vocabTips", function (content) {
    if (!this.page.outputPath || !this.page.outputPath.endsWith(".html")) return content;
    if (this.page.outputPath.endsWith("vocabulary.html")) return content;
    if (!content.includes("vocabulary.html#")) return content;
    return content.replace(
      /<a href="(?:\.\/)?vocabulary\.html#([a-z0-9-]+)">([\s\S]*?)<\/a>/g,
      (m, slug, text) => {
        const v = vocab[slug];
        if (!v)
          throw new Error(
            `Unknown vocabulary term "#${slug}" in ${this.page.inputPath}`
          );
        let def = md.renderInline(String(v.definition)).replace(/<[^>]*>/g, "");
        if (def.length > 280) def = def.slice(0, 277).replace(/\s+\S*$/, "") + "…";
        return `<a class="vocab" href="vocabulary.html#${slug}">${text}<span class="vocab-tip" role="tooltip">${def}</span></a>`;
      }
    );
  });

  // Static assets copied straight through to the output folder.
  eleventyConfig.addPassthroughCopy({ "src/style.css": "style.css" });
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
