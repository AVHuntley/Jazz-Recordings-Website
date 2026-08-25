# Authoring Guide

How to write and edit lesson content. The site is built with [Eleventy](https://www.11ty.dev/);
each lesson is a data file in `src/lessons/`, rendered by the single template in
`src/_includes/lesson.njk`.

**Golden rule:** content and template edits hot-reload under `npm run serve`, but changes to
`.eleventy.js` or the `_data/*.yaml` files require **restarting the server**.

## What's where

- `src/lessons/*.md` — the content, one file per lesson (YAML front matter).
- `src/_data/bibliography.yaml` — the bibliography: one entry per source (id, label, citation).
- `src/_data/vocab.yaml` — the vocabulary: one entry per term (term, definition, optional
  source lesson).
- `src/_includes/lesson.njk` — the lesson template. `src/style.css` — the stylesheet.
- `.eleventy.js` — build configuration: citation, media, vocabulary, and guide systems.
- `_site/` — the built site (generated; don't edit).

## Tracks

```yaml
- title: Daahoud
  performer: Clifford Brown and Max Roach
  composer: Clifford Brown
  recorded: August 1954
  album: Clifford Brown & Max Roach
  spotify: 2s1H8IG0ajYEduKsHip7RB        # the ID from the embed URL, after /track/
  personnel:
  - [Clifford Brown, trumpet]
  - [Max Roach, drums]
  intro: |-
    Prose (markdown) introducing the track.
  guide: |-
    0:00 | Head in, AA
    0:36 | Brown (tp) solo
```

Blank fields simply don't appear. Listening-guide rows are plain text, `time | description`,
split at the first pipe — commas, colons, and quotes are all safe on either side, and the time
column can be anything ("0:36", "1:03, 1:21", "Form"). A line without a `|` fails the build.

## Citations

Two kinds of inline citation, both rendered as numbered superscripts with a consolidated
Sources card at the bottom of the page. Each source gets one note (numbered by first citation)
aggregating every page cited; each marker's own page shows in its hover tooltip.

```markdown
A claim from a book. [p. 41](bibliography.html#gioia-2008)
A one-off web source.[^Author, "Title" (Publisher)](https://example.com/article)
A plain link (no ^) stays a link and never becomes a citation.
```

Section-level general references go in the section's front matter (each entry **must** start
with `- `):

```yaml
sources:
- {ref: gioia-2008, pages: 40-41}
- {url: 'https://example.com', label: 'Author — site name'}
```

If the source is already cited inline, its pages merge into that note; otherwise it renders in
an unnumbered list after the notes. A citation to an id not in `bibliography.yaml` fails the
build. Promote a web source to the bibliography when you quote it, cite it repeatedly, or want
it to survive link-rot.

## Media (video & audio)

Define once per lesson under `media:`, place anywhere prose goes with a token on its own line:

```yaml
media:
  st-louis-blues-1929:
    mp4: https://tile.loc.gov/...mp4        # direct video file (preferred when available)
    poster: https://tile.loc.gov/...jpg     # optional still
    size: large                             # optional: small | medium (default) | large
    title: St. Louis Blues (RKO, 1929)      # optional, for accessibility
    caption: 'Markdown, with [credit links](https://example.com).'
  some-interview:
    youtube: dQw4w9WgXcQ                    # or: iframe: https://archive.org/embed/...
  some-recording:
    mp3: https://.../file.mp3#t=95          # audio; #t= starts playback at 95 seconds
  some-track:
    spotify: 4u2mGcx8iAPueKUOFNQUmb        # renders Spotify's thin compact player
```

```markdown
@video(st-louis-blues-1929)
@audio(some-recording, noposter)     <- optional per-placement overrides: noposter, small, large
```

Prefer `mp3:`/`mp4:` direct files (native player, no third-party scripts); use `youtube:` or
`iframe:` when that's all the source offers. Unknown names or options fail the build. Prefer
.mp3 over .ogg (Safari). In URLs, encode spaces as `%20`, never `+`.

## Vocabulary

Link a term anywhere in prose to get a hover-definition tooltip and a link to the vocabulary
page. The slug is the lowercased, hyphenated term:

```markdown
...features [call-and-response](vocabulary.html#call-and-response) singing.
```

Unknown term slugs fail the build. Add new terms to `src/_data/vocab.yaml`; the vocabulary page
updates itself. `source`/`sourceTitle` are optional (they render the "introduced in" backlink).

**Synonyms.** A term can list alternate names with `aka:`. Any of them works as a link slug and
resolves to the canonical entry, so prose can use whichever name reads best in the sentence while
the tooltip still teaches the headword:

```yaml
- term: 'Sectional form'
  aka: ['multithematic form', 'multi-strain form', 'strain-based form']
  definition: '...'
```

`[multi-strain form](vocabulary.html#multi-strain-form)` links to the "Sectional form" entry and
pops up "**Sectional form:** …". The vocabulary page lists the synonyms after the headword and
gives each its own anchor, so direct links to an alias also land correctly. An alias that
collides with another term (or with another term's alias) fails the build.

## Formatting gotchas

- Write blockquotes with `>`, never raw `<blockquote>` tags — markdown (including citations)
  is not processed inside raw HTML blocks.
- To nest quotes, media tokens, or paragraphs inside a bullet, indent them two spaces past the
  bullet's dash.
- Editorial brackets in quotes should be escaped: `\[He mastered\]`.
- The build's validation errors are your friend: a typo'd citation ref, vocab term, or media
  name stops the build and names the file.
