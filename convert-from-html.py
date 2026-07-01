#!/usr/bin/env python3
"""Convert existing lesson HTML into Eleventy content files (markdown + YAML front matter)."""
import re, sys
from pathlib import Path
from bs4 import BeautifulSoup, NavigableString, Tag
from markdownify import markdownify as mdify
import yaml

SITE = Path("/sessions/eager-upbeat-wright/mnt/history-of-jazz-recordings")
OUT = SITE / "eleventy" / "src" / "lessons"
ORDER = {c: i for i, c in enumerate([
    "jazz-origins",
    "early-jazz",
    "early-big-bands",
    "swing-big-bands",
    "swing-era-soloists",
    "swing-era-vocalists",
    "diz-and-bird",
    "bebop-pianists",
    "bebop-horn-players",
    "bebop-era-big-bands",
    "cool-big-bands",
    "tristano-school-and-mjq",
    "west-coast-cool",
    "vocalists-of-40s-50s",
    "miles-davis",
    "hard-bop",
    "more-hard-bop",
    "john-coltrane",
    "free-jazz-and-avant-garde",
    "art-of-jazz-piano",
    "soul-jazz",
    "even-more-vocalists",
    "post-bop",
    "big-bands-of-the-1960s",
    "big-bands-of-the-1970s",
    "afro-caribbean-and-brazilian-jazz",
    "fusion",
    "artists-70s-and-80s",
    "vocal-ensembles",
    "contemporary-big-bands",
    "contemporary-pianists",
    "contemporary-saxophonists",
    "contemporary-horn-and-ensemble",
    "contemporary-strings-and-drums",
    "contemporary-vocalists",
])}

def prose_md(el):
    """Inner HTML of a block element -> Markdown, with citations as bibliography links."""
    if el is None:
        return ""
    el = BeautifulSoup(str(el), "html.parser").find(el.name)
    # citation anchors: keep href+text, drop the class and inner <cite> wrapper
    for a in el.find_all("a", class_="citation"):
        a.attrs = {"href": a.get("href", "")}
        cite = a.find("cite")
        if cite:
            cite.unwrap()
    # protect iframes (supplementary videos) - markdownify would drop them
    saved = []
    for ifr in el.find_all("iframe"):
        tok = f"@@IFRAME{len(saved)}@@"
        saved.append(str(ifr))
        ifr.replace_with(tok)
    html = el.decode_contents()
    text = mdify(html, heading_style="ATX", bullets="-", strip=["span"]).strip()
    for i, ih in enumerate(saved):
        text = text.replace(f"@@IFRAME{i}@@", "\n\n" + ih + "\n\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text

def collect_prose(container, stop_at_classes=("track",)):
    """Markdown for the direct prose children (p/ul/ol/blockquote) of a container."""
    parts = []
    for ch in container.find_all(["p", "ul", "ol", "blockquote"], recursive=False):
        md = prose_md(ch)
        if md:
            parts.append(md)
    return "\n\n".join(parts)

def collect_flow(container):
    """Markdown for direct children in order: prose, sub-headings, bare cites, video wrappers."""
    parts = []
    for ch in container.find_all(recursive=False):
        name = getattr(ch, "name", None)
        if name is None:
            continue
        if name in ("h1", "h2", "figure", "hr", "table"):
            continue  # headings/figures/tables handled separately
        if name == "div":
            cls = ch.get("class") or []
            if "video-embed" in cls or "youtube-container" in cls:
                ifr = ch.find("iframe")
                if ifr:
                    parts.append(str(ifr))
            # track / track-notes / page-section etc. handled elsewhere or are cruft -> skip
            continue
        if name in ("p", "ul", "ol", "blockquote", "dl"):
            md = prose_md(ch)               # block: take inner content
        else:
            md = mdify(str(ch), heading_style="ATX", bullets="-").strip()  # h3-h6/cite/a: keep element
        if md:
            parts.append(md)
    return "\n\n".join(parts)

def figures_in(container):
    figs = []
    for fig in container.find_all("figure", recursive=False):
        img = fig.find("img")
        cap = fig.find("figcaption")
        if img:
            figs.append({"src": img.get("src", ""), "alt": img.get("alt", ""),
                         "caption": cap.get_text(" ", strip=True) if cap else ""})
    return figs

def parse_metadata(info):
    fields = {"composer": "", "arranger": "", "recorded": "", "album": "", "released": ""}
    credits = []  # markdown strings for anything that isn't a recognized named field
    has_table = info.find("table") is not None
    for p in info.find_all(["p", "ul", "blockquote"], recursive=False):
        if p.name != "p":
            md = prose_md(p)
            if md:
                credits.append(md)
            continue
        t = p.get_text(" ", strip=True)
        m = re.match(r"^([A-Za-z][A-Za-z &]*?):\s*(.*)$", t)
        if not m:
            md = prose_md(p)
            if md:
                credits.append(md)
            continue
        label, val = m.group(1).strip().lower(), m.group(2).strip()
        if "composer" in label and "arranger" in label:
            fields["composer"] = val; fields["arranger"] = val
        elif label.startswith("composer"):
            fields["composer"] = val
        elif label.startswith("arranger"):
            fields["arranger"] = val
        elif label.startswith("recorded"):
            fields["recorded"] = val
        elif label.startswith("album"):
            amd = prose_md(p)
            amd = re.sub(r"^\s*\*{0,2}Album\s*:\*{0,2}\s*", "", amd)
            amd = re.sub(r"\s*\n\s*", " ", amd).strip()
            fields["album"] = amd
        elif label.startswith("released"):
            fields["released"] = val
        elif label.startswith("personnel"):
            if not has_table and val:
                credits.append(prose_md(p))
        elif val:
            credits.append(prose_md(p))
    return fields, credits

def parse_track(d):
    info = d.find("div", class_="track-info")
    t = {}
    h3 = info.find("h3"); h4 = info.find("h4")
    t["title"] = re.sub(r"\s+", " ", h3.get_text(" ", strip=True)) if h3 else ""
    if h4 and h4.get_text(strip=True):
        t["performer"] = re.sub(r"\s+", " ", h4.get_text(" ", strip=True))
    meta, credits = parse_metadata(info)
    for ve in info.find_all("div", class_=["video-embed", "youtube-container"]):
        ifr = ve.find("iframe")
        if ifr:
            credits.append(str(ifr))
    for k, v in meta.items():
        if v:
            t[k] = v
    if credits:
        t["credits"] = credits
    tbl = info.find("table")
    if tbl:
        rows = []
        for tr in tbl.find_all("tr"):
            tds = tr.find_all("td")
            # most rows are name|instrument; some pack several pairs into one row
            if len(tds) >= 2 and len(tds) % 2 == 0:
                for i in range(0, len(tds), 2):
                    rows.append([tds[i].get_text(" ", strip=True), tds[i + 1].get_text(" ", strip=True)])
        if rows:
            t["personnel"] = rows
    # embed (a track may have more than one Spotify part, e.g. a two-sided 78)
    sp_ids = []
    for ifr in d.select(".track-audio-embed iframe"):
        src = ifr.get("src", "")
        m = re.search(r"spotify\.com/embed/track/([A-Za-z0-9]+)", src)
        if m:
            sp_ids.append(m.group(1))
        ym = re.search(r"youtube\.com/embed/([A-Za-z0-9_-]+)", src)
        if ym:
            t["youtube"] = ym.group(1)
    if sp_ids:
        t["spotify"] = sp_ids[0]
        if len(sp_ids) > 1:
            t["spotify_more"] = sp_ids[1:]
    # track-intro
    ti = d.find("div", class_="track-intro")
    if ti:
        md = collect_flow(ti)
        if md:
            t["intro"] = md
    # listening guide
    lg0 = d.find("div", class_="listening-guide")
    if lg0:
        note_parts = []
        for ch in lg0.find_all(["p", "blockquote"], recursive=False):
            md = prose_md(ch)
            if md:
                note_parts.append(md)
        if note_parts:
            t["guidenote"] = "\n\n".join(note_parts)
    guide = []
    lg = d.find("div", class_="listening-guide")
    if lg:
        for tr in lg.find_all("tr"):
            tds = tr.find_all("td")
            if len(tds) == 2:
                guide.append([tds[0].get_text(" ", strip=True), prose_md_inline(tds[1])])
    if guide:
        t["guide"] = guide
    # additional info
    ai = d.find("div", class_="additional-info")
    if ai:
        body = BeautifulSoup(str(ai), "html.parser").find("div")
        h5 = body.find("h5")
        if h5:
            h5.decompose()
        notes = collect_flow(body)
        if notes:
            t["notes"] = notes
        figs = figures_in(body)
        if figs:
            t["figures"] = figs
    return t

def prose_md_inline(td):
    inner = BeautifulSoup(str(td), "html.parser").find("td")
    for a in inner.find_all("a", class_="citation"):
        a.attrs = {"href": a.get("href", "")}
        c = inner.find("cite")
        if c: c.unwrap()
    return mdify(inner.decode_contents(), bullets="-").strip()

def parse_vocabulary(intro_sec):
    """Detect a 'Vocabulary' <h2> + following <ul> of <strong>term</strong> - def."""
    h2 = None
    for h in intro_sec.find_all("h2"):
        if h.get_text(strip=True).lower() == "vocabulary":
            h2 = h; break
    if not h2:
        return None, None
    ul = h2.find_next_sibling("ul")
    terms = []
    if ul:
        for li in ul.find_all("li", recursive=False):
            strong = li.find(["strong", "b"])
            term = strong.get_text(" ", strip=True) if strong else ""
            # definition = li text minus the term and a leading dash
            full = li.get_text(" ", strip=True)
            defn = full
            if term:
                defn = full[len(term):].lstrip(" -–—")
            terms.append({"term": term, "definition": defn})
    return h2, terms

# ---- block-scalar friendly YAML, with inline (flow) leaf pairs ----
class _Str(str): pass
def _str_rep(dumper, data):
    if "\n" in data:
        return dumper.represent_scalar("tag:yaml.org,2002:str", data, style="|")
    return dumper.represent_scalar("tag:yaml.org,2002:str", data)
yaml.add_representer(_Str, _str_rep)

class FlowList(list): pass
def _flow_rep(dumper, data):
    return dumper.represent_sequence("tag:yaml.org,2002:seq", data, flow_style=True)
yaml.add_representer(FlowList, _flow_rep)

def wrap(o):
    if isinstance(o, str):
        return _Str(o)
    if isinstance(o, list):
        # a pair of plain strings (personnel row / guide row) -> compact inline form
        if len(o) == 2 and all(isinstance(x, str) for x in o):
            return FlowList([_Str(x) for x in o])
        return [wrap(x) for x in o]
    if isinstance(o, dict):
        return {k: wrap(v) for k, v in o.items()}
    return o

def convert(fname):
    soup = BeautifulSoup((SITE / fname).read_text(encoding="utf-8"), "html.parser")
    data = {}
    title = soup.find("title")
    data["title"] = title.get_text(strip=True) if title else fname
    desc = soup.find("meta", attrs={"name": "description"})
    if desc and desc.get("content"):
        data["description"] = desc["content"]
    data["order"] = ORDER.get(Path(fname).stem, 999)

    intro_sec = soup.find("section", class_="introduction")
    if intro_sec and intro_sec.find("h1"):
        h1text = intro_sec.find("h1").get_text(" ", strip=True)
        if h1text and h1text != data["title"]:
            data["heading"] = h1text
    # vocabulary (remove from tree so it isn't double-collected)
    voc_h2, terms = parse_vocabulary(intro_sec) if intro_sec else (None, None)
    if terms:
        data["vocabulary"] = terms
        # remove the vocabulary heading + list so it isn't also pulled into intro prose
        voc_ul = voc_h2.find_next_sibling("ul")
        if voc_ul:
            voc_ul.decompose()
        voc_h2.decompose()
    # intro prose = direct p/ul/blockquote before any h2 (vocabulary)
    data["intro"] = collect_flow(intro_sec) if intro_sec else ""
    if intro_sec:
        figs = figures_in(intro_sec)
        if figs:
            data["introFigures"] = figs

    sections = []
    for sec in soup.find_all("section", class_="artist"):
        h2 = sec.find("h2")
        s = {"heading": h2.get_text(" ", strip=True) if h2 else ""}
        s["prose"] = collect_flow(sec)
        s["tracks"] = [parse_track(d) for d in sec.find_all("div", class_="track")]
        sections.append(s)
    data["sections"] = sections

    fm = yaml.dump(wrap(data), allow_unicode=True, sort_keys=False, width=100)
    out = OUT / (Path(fname).stem + ".md")
    out.write_text("---\n" + fm + "---\n", encoding="utf-8")
    nt = sum(len(s["tracks"]) for s in sections)
    print(f"wrote {out.name}: {len(sections)} sections, {nt} tracks")

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for f in sys.argv[1:] or ["hard-bop.html","miles-davis.html","afro-caribbean-and-brazilian-jazz.html"]:
        convert(f)
