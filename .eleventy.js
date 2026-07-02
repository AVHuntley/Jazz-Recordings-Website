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
  // Pass 1: collect every source used on the page (inline citations + general card).
  const used = new Set();
  for (const m of body.matchAll(/<a href="bibliography\.html#([a-z0-9-]+)">/g)) {
    if (!bib[m[1]])
      throw new Error(`Unknown bibliography ref "${m[1]}" in ${pagePath}`);
    used.add(m[1]);
  }
  const genPages = new Map(); // pages consulted per section `sources:` fields
  if (existing)
    for (const m of existing.matchAll(
      /<a href="bibliography\.html#([a-z0-9-]+)">[\s\S]*?<\/a>(?: — (pp?\.\s[^<\n]*))?/g
    )) {
      used.add(m[1]);
      if (m[2]) genPages.set(m[1], m[2].trim());
    }
  const all = [...used];
  if (!all.length) return content;
  // Alphabetical by author, then year ascending (parsed from labels like "Gioia (2008)").
  const sortKey = (ref) => {
    const m = bib[ref].label.match(/^(.*?)\s*\((\d{4})\)/);
    return m
      ? { author: m[1].toLowerCase(), year: parseInt(m[2], 10) }
      : { author: bib[ref].label.toLowerCase(), year: 9999 };
  };
  all.sort((a, b) => {
    const ka = sortKey(a), kb = sortKey(b);
    return ka.author < kb.author ? -1 : ka.author > kb.author ? 1 : ka.year - kb.year;
  });
  const num = new Map(all.map((ref, i) => [ref, i + 1]));
  // Pass 2: swap citation links for numbered superscript markers.
  body = body.replace(
    /<a href="bibliography\.html#([a-z0-9-]+)">([\s\S]*?)<\/a>/g,
    (m, ref, label) => {
      const n = num.get(ref);
      const tip = escAttr(bib[ref].label + pagesLabel(parseLocator(label)));
      return `<sup class="cite"><a href="#src-${n}" title="${tip}">${n}</a></sup>`;
    }
  );
  // Markers sit flush against the preceding word/punctuation.
  body = body.replace(/\s+(<sup class="cite">)/g, "$1");
  const ol =
    `\n<ol class="cite-notes">\n` +
    all
      .map(
        (ref) =>
          `<li id="src-${num.get(ref)}"><a href="bibliography.html#${ref}">${bib[ref].label}</a>${genPages.has(ref) ? " — " + genPages.get(ref) : ""}</li>`
      )
      .join("\n") +
    `\n</ol>`;
  const card = `<section class="sources" id="sources">\n<h2>Sources</h2>${ol}\n</section>`;
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
    out = out.replace(/<p>\s*@video\(([\w-]+)\)\s*<\/p>/g, (m, id) => {
      const v = media && media[id];
      if (!v)
        throw new Error(
          `@video(${id}) has no matching entry in this lesson's media: map`
        );
      return renderVideoFig(v);
    });
    if (out.includes("@video("))
      throw new Error(
        "A @video(...) token wasn't expanded - it must sit in its own paragraph"
      );
    return out;
  });
  // Single video object -> <figure> (for videos: lists on tracks/sections).
  eleventyConfig.addFilter("videoFig", renderVideoFig);
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
  // Unique refs across all sections' `sources:` lists, in order of appearance,
  // with consulted pages merged per source ("64-65" + "70" -> "pp. 64–65, 70").
  eleventyConfig.addFilter("allSourceRefs", (sections) => {
    const map = new Map();
    for (const s of sections || [])
      for (const src of s.sources || []) {
        const pages = map.get(src.ref) || [];
        if (src.pages)
          pages.push(String(src.pages).replace(/-/g, "–").replace(/\s+/g, ""));
        map.set(src.ref, pages);
      }
    return [...map.entries()].map(([ref, pages]) => {
      const joined = pages.join(", ");
      return {
        ref,
        pagesText: joined ? (/[–,]/.test(joined) ? "pp. " : "p. ") + joined : "",
      };
    });
  });

  // Turn citation links into numbered footnote markers, one list per page.
  eleventyConfig.addTransform("citations", function (content) {
    if (!this.page.outputPath || !this.page.outputPath.endsWith(".html")) return content;
    if (this.page.outputPath.endsWith("bibliography.html")) return content;
    if (!content.includes("bibliography.html#")) return content;
    return processPage(content, this.page.inputPath);
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
