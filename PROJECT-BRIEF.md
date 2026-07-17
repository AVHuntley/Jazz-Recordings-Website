# Project Brief — Survey of Jazz Recordings

*Prepared July 2026 for anyone getting up to speed on this project: collaborators, agents, or a
manager wanting the shape of the work. Technical details live in README.md; this is the picture.*

## What it is

A **listening-based history of jazz**, taught through roughly 190 curated recordings across
**35 lessons**, from the African, ragtime, and blues roots of jazz through swing, bebop, cool,
hard bop, fusion, and today's working artists. The author is Alec Villars Huntley, a jazz
keyboardist and educator (DMA in jazz piano performance, University of North Texas). The
material originated as a real course — students originally received Spotify playlists — and is
being rebuilt as a self-contained, publishable website.

The pedagogical unit is the **lesson**: historical prose introducing a style and its key
figures, then curated tracks, each with personnel, recording details, an embedded player, and a
**timestamped listening guide** (~1,360 guide rows across the site) directing the student's ear
moment by moment. Terms link to a site-wide vocabulary with hover definitions; claims carry
academic citations.

## Scholarliness — the distinguishing ambition

This is not a casual blog. The project holds itself to academic citation standards while staying
readable for students:

- **Endnote-style citations**: superscript markers in prose, page-level references on hover, a
  consolidated Sources list per page, all linking to a bibliography of ~20 scholarly sources
  (Gioia, Schuller, Porter & Ullman, DeVeaux & Giddins, etc.). ~140 inline citations so far.
- **Primary sources, used seriously**: Library of Congress National Screening Room film (Bessie
  Smith's only film appearance), National Jukebox 78s, National Film Registry essays, the 1938
  Lomax–Jelly Roll Morton sessions. Rights and public-domain status are checked before use.
- **Fact-checking as method**: claims get verified against scholarship before publication
  (e.g., the authenticity debate around Joplin's 1916 piano rolls is now *part of the lesson*
  rather than a glossed-over simplification).

## How it's built (one paragraph)

A static website (Eleventy) with a strict separation: lesson **content is plain data** (one
readable YAML/Markdown file per lesson), and all presentation logic lives in one template plus
a small build configuration. Custom build systems — developed with an AI collaborator in July
2026 — handle citations, media embedding (Spotify, YouTube, Library of Congress and Internet
Archive audio/video), listening-guide formatting, and vocabulary tooltips, each with build-time
validation so that a typo'd source, term, or media reference **fails the build loudly** instead
of shipping silently. Version control via Git/GitHub.

## Timeline

- **2022–2025** — original course site: hand-built HTML pages.
- **June 2026** — converted to the data + template architecture; all 35 lessons migrated.
- **July 2026** — infrastructure sprint: citation system, media system, vocabulary system,
  guide format, Git/GitHub setup. Content revision begun (jazz-origins lesson actively being
  enriched with new scholarship, primary-source audio and film).

## State of the work

**Done:** all 35 lessons exist, build cleanly, and are structurally complete — 175 sections,
186 tracks, 174 listening guides, 49 media embeds, 32 vocabulary terms. The infrastructure is
essentially finished and validated. One lesson (Jazz Origins) is well into deep content
revision and represents the target quality bar.

**Remaining — primarily a writing project now.** A content audit found ~135 discrete gaps:
~95 sections without "additional information" notes, ~15 empty or thin listening guides, ~11
lessons without introductions, plus prose polish and typo passes throughout. Beyond writing:
linking vocabulary terms across all lessons, filling citations in later lessons (coverage is
strongest in early ones), and a handful of known cleanup items (a few dead links from the
original conversion). The site is **live on GitHub Pages**
(https://avhuntley.github.io/Jazz-Recordings-Website/) and redeploys automatically on every
push.

**Reasonable framing of scale:** infrastructure ~complete; content perhaps 60–70% present but
at varying depth, with one lesson at target quality and 34 to bring up to it. The honest unit
of remaining work is "revise one lesson to the Jazz Origins standard," times 34.

## Ambitions

Near-term: a polished, self-hosted course site a student can work through independently —
listen, read, hover a term, check a source. Longer-term possibilities the architecture already
supports: per-video/audio sizing and richer media layouts, auto-generated cross-references,
sequential lesson navigation, and — because every lesson is structured data — reuse of the
material in other forms (print, slides, LMS) without rewriting content. The scholarly apparatus
is deliberately over-built for a hobby site: the aspiration is something citable, durable, and
worthy of the music.
