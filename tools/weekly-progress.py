#!/usr/bin/env python3
"""Weekly progress report for the Survey of Jazz Recordings.

Compares the current state of the lessons against the state one week ago (from
git history) and against SCHEDULE.md, then prints a compact factual report.

Run from the repository root:   python3 tools/weekly-progress.py
No output is written; it only reads. Intended to be run by a scheduled task,
which turns this data into a short written brief.

A lesson counts as FINISHED when its front matter contains `status: done`.
Everything else is measured, not judged.
"""

import datetime, glob, os, re, subprocess, sys

try:
    import yaml
except ImportError:
    sys.exit("pyyaml required:  pip install pyyaml --break-system-packages")

PROSE_FIELDS = ("intro", "prose", "notes", "guidenote", "caption")


def git(*args):
    """Run a git command, returning stdout or '' on failure."""
    try:
        return subprocess.run(
            ["git", "--no-optional-locks", *args],
            capture_output=True, text=True, timeout=60,
        ).stdout
    except Exception:
        return ""


def words_in(node):
    """Recursively count words in prose-bearing fields."""
    total = 0
    if isinstance(node, str):
        return len(node.split())
    if isinstance(node, list):
        return sum(words_in(i) for i in node)
    if isinstance(node, dict):
        for k, v in node.items():
            if k in PROSE_FIELDS:
                total += words_in(v)
            elif isinstance(v, (list, dict)):
                total += words_in(v)
    return total


def measure(text):
    """Extract metrics from one lesson file's raw text."""
    try:
        data = yaml.safe_load(text.split("---", 2)[1])
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    sections = data.get("sections") or []
    tracks = [t for s in sections for t in (s.get("tracks") or [])]
    return {
        "title": data.get("title", "?"),
        "order": data.get("order"),
        "status": str(data.get("status", "")).lower(),
        "words": words_in(data.get("intro", "")) + sum(words_in(s) for s in sections),
        "citations": len(re.findall(r"\]\(bibliography\.html#", text)),
        "vocab_links": len(re.findall(r"\]\(vocabulary\.html#", text)),
        "media": len(re.findall(r"@(?:video|audio)\(", text)),
        "tracks": len(tracks),
        "guides": sum(1 for t in tracks if t.get("guide")),
    }


def scheduled_work(when):
    """Return the SCHEDULE.md row covering the week containing `when`."""
    if not os.path.exists("SCHEDULE.md"):
        return None, None
    monday = when - datetime.timedelta(days=when.weekday())
    rows = []
    for line in open("SCHEDULE.md", encoding="utf-8"):
        m = re.match(r"\|\s*(\d+)\s*\|\s*([A-Z][a-z]{2} \d{2}, \d{4})\s*\|\s*(.+?)\s*\|", line)
        if m:
            d = datetime.datetime.strptime(m.group(2), "%b %d, %Y").date()
            rows.append((int(m.group(1)), d, m.group(3)))
    for num, d, label in rows:
        if d == monday:
            return num, label
    # before the schedule starts, or after it ends
    if rows and monday < rows[0][1]:
        return 0, "(schedule has not started yet)"
    return None, None


def main():
    today = datetime.date.today()
    files = sorted(glob.glob("src/lessons/*.md"))

    # --- current state ---
    now = {}
    for f in files:
        m = measure(open(f, encoding="utf-8").read())
        if m:
            now[os.path.basename(f)] = m

    # --- state one week ago, from git ---
    old_rev = git("rev-list", "-1", "--before=7 days ago", "HEAD").strip()
    then = {}
    if old_rev:
        for name in now:
            blob = git("show", f"{old_rev}:src/lessons/{name}")
            if blob:
                m = measure(blob)
                if m:
                    then[name] = m

    # --- what changed ---
    changed = []
    for name, cur in now.items():
        was = then.get(name)
        if not was:
            changed.append((cur["order"], cur["title"], "NEW LESSON", cur["words"], cur["citations"], cur["media"]))
            continue
        dw = cur["words"] - was["words"]
        dc = cur["citations"] - was["citations"]
        dm = cur["media"] - was["media"]
        dg = cur["guides"] - was["guides"]
        dv = cur["vocab_links"] - was["vocab_links"]
        if any((dw, dc, dm, dg, dv)):
            changed.append((cur["order"], cur["title"], "", dw, dc, dm))
    changed.sort()

    commits = [l for l in git("log", "--since=7 days ago", "--oneline").splitlines() if l.strip()]

    # --- schedule position ---
    wk_num, wk_label = scheduled_work(today)
    _, last_label = scheduled_work(today - datetime.timedelta(days=7))

    done = sorted(m["order"] for m in now.values() if m["status"] == "done")
    remaining = len(now) - len(done)

    # expected progress: count lessons whose scheduled weeks have already passed
    expected = 0
    if os.path.exists("SCHEDULE.md"):
        seen = set()
        for line in open("SCHEDULE.md", encoding="utf-8"):
            m = re.match(r"\|\s*\d+\s*\|\s*([A-Z][a-z]{2} \d{2}, \d{4})\s*\|.*?Lesson (\d+):", line)
            if m:
                d = datetime.datetime.strptime(m.group(1), "%b %d, %Y").date()
                if d < today - datetime.timedelta(days=today.weekday()):
                    seen.add(int(m.group(2)))
        expected = len(seen)

    # --- health checks ---
    dirty = [l for l in git("status", "--porcelain").splitlines() if l.strip()]
    thin = [(m["order"], m["title"], m["words"]) for m in now.values()
            if m["status"] != "done" and m["words"] < 900]
    uncited = [(m["order"], m["title"]) for m in now.values()
               if m["status"] != "done" and m["citations"] == 0]

    # --- report ---
    print(f"WEEKLY PROGRESS REPORT — {today:%B %d, %Y}")
    print("=" * 60)
    print(f"\nSCHEDULE")
    print(f"  This week (week {wk_num}): {wk_label}" if wk_num is not None else "  Not on the schedule grid.")
    print(f"  Last week:              {last_label or 'n/a'}")
    days_left = (datetime.date(2028, 1, 22) - today).days
    print(f"  Days to Jan 22, 2028:   {days_left}  ({days_left/7:.0f} weeks)")

    print(f"\nPACE")
    print(f"  Lessons marked done:    {len(done)} of {len(now)}   (orders: {done if done else 'none yet'})")
    print(f"  Schedule expected:      ~{expected} lessons started by now")
    print(f"  Remaining:              {remaining}")

    print(f"\nLAST 7 DAYS")
    if not old_rev:
        print("  No git history from a week ago — first run, or nothing committed yet.")
    print(f"  Commits: {len(commits)}")
    for c in commits[:8]:
        print(f"    {c}")
    if changed:
        print(f"  Lessons touched: {len(changed)}")
        print(f"    {'ord':>3}  {'lesson':32} {'words':>7} {'cites':>6} {'media':>6}")
        for o, t, flag, dw, dc, dm in changed:
            mark = f"  <- {flag}" if flag else ""
            print(f"    {o:>3}  {t[:32]:32} {dw:>+7} {dc:>+6} {dm:>+6}{mark}")
    else:
        print("  No lesson content changed.")

    print(f"\nATTENTION")
    if dirty:
        print(f"  UNCOMMITTED changes in {len(dirty)} files — this work is not backed up or deployed.")
        for l in dirty[:6]:
            print(f"    {l.strip()}")
    if thin:
        print(f"  Thin lessons (<900 words, not yet marked done): {len(thin)}")
        for o, t, w in sorted(thin)[:5]:
            print(f"    {o:>3}  {t[:32]:32} {w:>5} words")
    if uncited:
        print(f"  Lessons with no citations yet: {len(uncited)}")
        for o, t in sorted(uncited)[:5]:
            print(f"    {o:>3}  {t}")
    if not thin and not uncited and not dirty:
        print("  Nothing flagged.")


if __name__ == "__main__":
    main()
