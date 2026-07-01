const markdownIt = require("markdown-it");

// Markdown renderer. html:true lets prose contain occasional raw HTML if ever needed.
// typographer/quotes off because the content already uses curly quotes.
const md = markdownIt({ html: true, linkify: false, typographer: false });

module.exports = function (eleventyConfig) {
  // Lessons in curriculum order (numeric sort by front-matter `order`).
  eleventyConfig.addCollection("lessonsOrdered", (api) =>
    api.getFilteredByTag("lesson").sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999))
  );

  // Render a markdown string to a full block (paragraphs, lists, blockquotes).
  eleventyConfig.addFilter("md", (s) => (s ? md.render(String(s)) : ""));
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

  // bibliography.html is a finished static page - copy it, don't treat it as a template.
  eleventyConfig.ignores.add("src/bibliography.html");

  // Static assets copied straight through to the output folder.
  eleventyConfig.addPassthroughCopy({ "src/style.css": "style.css" });
  eleventyConfig.addPassthroughCopy({ "src/images": "images" });
  eleventyConfig.addPassthroughCopy({ "src/bibliography.html": "bibliography.html" });

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
