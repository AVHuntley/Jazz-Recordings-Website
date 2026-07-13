# Eleventy prototype — Survey of Jazz Recordings

This folder is a **proof of concept** for rebuilding the site with [Eleventy (11ty)](https://www.11ty.dev/),
a static site generator. The idea: store each lesson's *content* as plain data, and let a single
*template* turn it into HTML. Edit content once; the look is defined in one place.

Nothing here touches your existing pages in the parent folder — it's a self-contained experiment.

## What's where

- `src/lessons/*.md` — **the content.** One file per lesson. Each is human-readable data
  (title, intro, sections, and a list of tracks with their fields). This is what you'd edit.
- `src/_includes/lesson.njk` — **the template.** The single file that decides how every lesson
  and every track is laid out. Change it once, all lessons update.
- `src/style.css` — the stylesheet (copied from your site, plus citation-link styling).
- `src/index.njk` — the home page; its lesson list builds itself from the lesson files.
- `src/_data/bibliography.yaml` — **the bibliography.** One entry per source: anchor id, short
  label, and the full citation. The bibliography page and every citation label render from it.
- `src/images/` — copied through as-is.
- `_site/` — the **built website** (generated; don't edit by hand).
- `convert-from-html.py` — a script that turns an existing page in the parent folder into a
  `src/lessons/*.md` data file. Used to seed this prototype; can convert the rest.

## How to run it

You need [Node.js](https://nodejs.org/) installed. Then, in this folder:

```
npm install        # one time, downloads Eleventy
npm run serve      # builds the site and opens a live-preview server
```

Leave `npm run serve` running and edit any file in `src/lessons/`. The browser refreshes
automatically. To produce the final files without the preview server, run `npm run build`;
the output lands in `_site/`.

## Editing a lesson

Open e.g. `src/lessons/hard-bop.md`. A track looks like this:

```yaml
- title: “Daahoud”
  performer: Clifford Brown and Max Roach
  composer: Clifford Brown
  recorded: August 1954
  album: Clifford Brown & Max Roach
  spotify: 2s1H8IG0ajYEduKsHip7RB
  personnel:
    - [Clifford Brown, trumpet]
    - [Max Roach, drums]
  intro: |
    Prose goes here. Plain text, with **bold**, *italics*, and
    [links](https://example.com). To cite a source, link page numbers
    to its bibliography anchor: [p. 257](bibliography.html#porter-ullman-1993)
  guide: |-
    0:00 | Head in, AA
    0:36 | Brown (tp) solo
  notes: |
    Anything for the "Additional Information" box.
```

Fields you leave blank simply don't appear (no more empty "Arranger:" lines). To paste a new
Spotify track, you only need the ID — the part of the embed URL after `/track/`.

Listening-guide rows are plain text lines, `time | description`, split at the **first** pipe.
Commas, colons, quotes, and apostrophes are all safe on either side; the time column can be
anything ("0:36", "1:03, 1:21", "Form"). A line without a `|` fails the build.

## Videos

Define each video once in the lesson's front matter under `media:`, giving it a short name:

```yaml
media:
  st-louis-blues-1929:
    mp4: https://tile.loc.gov/storage-services/service/mbrs/ntscrm/00063365/00063365.mp4
    poster: https://tile.loc.gov/.../00063365.jpg     # optional still shown before play
    size: large                                       # optional: small | medium (default) | large
    title: St. Louis Blues (RKO, 1929)                # optional, for accessibility
    caption: '*St. Louis Blues* (RKO, 1929). Video from the [Library of Congress](https://www.loc.gov/item/2023602002/).'
```

Then place it **anywhere prose goes** — page intro, section prose, track intros, or the
Additional Information `notes:` — with a token on its own line between paragraphs:

```markdown
There exists exactly one video recording of Bessie Smith...

@video(st-louis-blues-1929)
```

A token pointing at a name that isn't in `media:` fails the build. For YouTube, use
`youtube: <video-id>` (plus optional `params: list=...` for playlist context) instead of `mp4:`.
For sources that only offer embed codes (like Internet Archive), use
`iframe: https://archive.org/embed/...`. For plain audio files, use `audio: <url>` and place it
with an `@audio(name)` token (same map, same figure styling — prefer .mp3 over .ogg, which
Safari can't play; Wikimedia Commons publishes .mp3 transcodes of its audio files). Prefer `mp4:` when the source offers a direct file (Library of Congress National
Screening Room items do): it uses the browser's native player, loads nothing until pressed, and
keeps the page free of third-party scripts. Captions take markdown, so credit the source with a
link. (Tracks and sections can also take a `videos:` list of the same objects for fixed
placement after the audio embed / section prose, but the token form is usually what you want.)

## Citations

There are two kinds, and both draw their labels from `src/_data/bibliography.yaml` so every
citation on the site is formatted identically.

**Point citations** support a specific claim. In any prose field, link the page number(s) to the
source's anchor:

```markdown
...the highest paid Black performing artist in the world [p. 41](bibliography.html#gioia-2008).
```

At build time this becomes a small numbered superscript (endnote style: numbered in reading
order). Hovering shows "Gioia (2008), p. 41"; clicking jumps to that note in the **Sources**
card at the bottom of the page, where the note shows the pages and links to the full citation
in the bibliography. Citing the same source at the same pages reuses its number; different
pages get a new note — that's how footnotes work.

**Web citations** are for one-off sources that don't belong in the bibliography. Start the link
text with `^` to make it a numbered note instead of a plain link:

```markdown
...named to the National Film Registry in 2006.[^National Film Registry, Library of Congress](https://www.loc.gov/programs/...)
```

The note shows the label, linked to the URL. Links *without* the `^` stay ordinary hyperlinks
and never touch the Sources card. Older labels
like `[(Lyons, p.182)](...)` still work — only the page numbers are read — but `[p. 182](...)` is
the preferred form going forward.

**Section sources** are general references for a whole section (not tied to one claim). Declare
them in the section's front matter; they render as an unnumbered list after the numbered notes,
with consulted pages shown ("Porter & Ullman (1993) — pp. 64–65"). One is dropped only if a
numbered note already cites exactly the same source and pages. Entries are either bibliography
refs or one-off web sources — each entry **must start with `- `** (it's a YAML list):

```yaml
sources:
- {ref: gioia-2008, pages: 40-41}
- {url: 'https://www.ragtimepiano.ca/rags/classical.htm', label: 'Classic ragtime piano — ragtimepiano.ca'}
```

One-off pointers — especially web sources — don't need the bibliography at all: an ordinary
markdown link in prose is the right tool. Promote a web source to `bibliography.yaml` only when
you quote it, cite it repeatedly, or want readers to find it if the URL dies.

```yaml
- heading: Bessie Smith
  prose: |-
    ...
  sources:
  - {ref: porter-ullman-1993, pages: 64-65}
  - {ref: gioia-2008, pages: 40-41}
```

**One formatting rule:** write quotations with markdown (`>` at the start of the line), not raw
`<blockquote>` tags. Markdown — including citation links — is not processed inside raw HTML
blocks, so citations there degrade to literal text.

**Adding a source:** add an entry to `src/_data/bibliography.yaml` (id, label, citation). The
bibliography page updates itself. A citation pointing at an id that doesn't exist **fails the
build** — typos can't slip through silently. Note: after editing `bibliography.yaml`, restart
`npm run serve` (it's read once at startup).

## Conversion status

- **All 35 lessons are converted** into `src/lessons/*.md` and build cleanly. The index page lists
  them in curriculum order automatically.
- Generated pages match your current ones closely. Intentional clean-ups: empty metadata labels
  (e.g. a blank "Arranger:") are dropped; packed personnel rows are split into proper rows; album
  titles always render in italics; song titles keep their quotation marks.
- Citations are plain Markdown links styled by CSS, no special syntax to learn.

## Three pages to eyeball

- **diz-and-bird**, **big-bands-of-the-1960s**, **post-bop**: each had a duplicate, older copy of
  its tracks left over in the page intro. The conversion kept the clean set and dropped the
  duplicates; worth a glance to confirm nothing wanted is gone.
- **more-hard-bop**: one trailing note (about Barry Harris, after "The Sidewinder") now sits in the
  section intro rather than after the track. Move it in the data file if you prefer.
