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
- `src/bibliography.html`, `src/images/` — copied through as-is.
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
    [links](https://example.com). Citations are just links to the
    bibliography: [(Porter, p.257)](bibliography.html#porter-ullman-1993)
  guide:
    - ["0:00", "Head in, AA"]
    - ["0:36", "Brown (tp) solo"]
  notes: |
    Anything for the "Additional Information" box.
```

Fields you leave blank simply don't appear (no more empty "Arranger:" lines). To paste a new
Spotify track, you only need the ID — the part of the embed URL after `/track/`.

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
