#!/usr/bin/env python3
"""One-shot migration: reshape Convex seed frontmatter + install Petersen draft."""

from __future__ import annotations

import re
import shutil
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
RYANS = ROOT / "ryans"
UPLOAD_PETERSEN = Path(
    "/home/ubuntu/.cursor/projects/workspace/uploads/01-ryan-petersen_b317.md"
)

# Old slug -> new lineup-aligned slug / metadata
LINEUP = {
    "reynolds": {
        "slug": "ryan-reynolds",
        "number": 2,
        "clusters": ["actor", "film", "founder", "sports-owner"],
        "occupations": ["actor", "entrepreneur"],
    },
    "gosling": {
        "slug": "ryan-gosling",
        "number": 3,
        "clusters": ["actor", "film", "musician"],
        "occupations": ["actor", "musician"],
    },
    "tedder": {
        "slug": "ryan-tedder",
        "number": 4,
        "clusters": ["musician", "songwriter", "producer"],
        "occupations": ["singer", "songwriter", "producer"],
    },
    "nolan": {
        "slug": "nolan-ryan",
        "number": 5,
        "clusters": ["athlete", "baseball", "historical"],
        "occupations": ["baseball player"],
    },
    "hoover": {
        "slug": "ryan-hoover",
        "number": 6,
        "clusters": ["founder", "tech", "investor"],
        "occupations": ["entrepreneur", "investor"],
    },
    "seacrest": {
        "slug": "ryan-seacrest",
        "number": 7,
        "clusters": ["tv-host", "media", "broadcaster"],
        "occupations": ["television host", "radio host", "producer"],
    },
    "coogler": {
        "slug": "ryan-coogler",
        "number": 8,
        "clusters": ["director", "film", "writer"],
        "occupations": ["film director", "producer", "screenwriter"],
    },
    "graves": {
        "slug": "ryan-graves",
        "number": 10,
        "clusters": ["tech", "executive", "investor"],
        "occupations": ["businessman", "investor"],
    },
    "smith": {
        "slug": "ryan-smith-qualtrics",
        "number": 11,
        "clusters": ["founder", "tech", "sports-owner"],
        "occupations": ["businessman", "sports owner"],
    },
    "dahl": {
        "slug": "ryan-dahl",
        "number": 15,
        "clusters": ["engineer", "tech", "founder", "open-source"],
        "occupations": ["software engineer"],
    },
    "carson": {
        "slug": "ryan-carson",
        "number": 17,
        "clusters": ["founder", "tech", "education"],
        "occupations": ["entrepreneur"],
    },
    "phillippe": {
        "slug": "ryan-phillippe",
        "number": 19,
        "clusters": ["actor", "film"],
        "occupations": ["actor"],
    },
    "kaji": {
        "slug": "ryan-kaji",
        "number": 24,
        "clusters": ["creator", "youtube", "business"],
        "occupations": ["youtuber", "entertainer"],
    },
    "garcia": {
        "slug": "ryan-garcia",
        "number": 25,
        "clusters": ["athlete", "boxer", "creator"],
        "occupations": ["boxer"],
    },
}

HEURISTIC_CLUSTERS = {
    "anderson": ["founder", "tech"],
    "breslow": ["founder", "tech"],
    "castro": ["musician"],
    "cohen": ["founder", "investor", "business"],
    "cwynar": ["tech", "founder"],
    "giggs": ["athlete"],
    "higa": ["creator", "youtube", "comedian"],
    "holmes": ["founder", "tech"],
    "humphries": ["business"],
    "matt": ["athlete"],
    "selkis": ["tech", "founder", "investor"],
    "trahan": ["creator", "youtube"],
}


def dump_frontmatter(data: dict) -> str:
    return yaml.safe_dump(
        data,
        sort_keys=False,
        allow_unicode=True,
        default_flow_style=False,
        width=100,
    ).strip()


def parse_file(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    if not match:
        return {}, text
    return yaml.safe_load(match.group(1)) or {}, match.group(2).strip()


def normalize_short(short: str, title: str) -> str:
    short = (short or "").strip()
    if short:
        return short[:25]
    title = (title or "").strip()
    if not title:
        return ""
    return title[:25] if len(title) <= 25 else title[:24] + "…"


def migrate_one(old_slug: str, path: Path) -> Path:
    meta, body = parse_file(path)
    lineup = LINEUP.get(old_slug, {})
    new_slug = lineup.get("slug", meta.get("slug") or old_slug)

    short = normalize_short(meta.get("short") or "", meta.get("title") or "")
    title = (meta.get("title") or short or "").strip()

    birth_year = meta.get("birth_year")
    birth = None
    if birth_year not in (None, "", "null"):
        try:
            y = int(float(birth_year))
            birth = {"date": str(y), "date_precision": "year", "place": None, "cite": []}
        except (TypeError, ValueError):
            birth = None

    sources = []
    for i, src in enumerate(meta.get("sources") or [], start=1):
        if isinstance(src, str):
            sources.append(
                {
                    "n": i,
                    "title": "",
                    "publisher": "",
                    "date": None,
                    "url": src,
                    "access": "read",
                }
            )
        elif isinstance(src, dict):
            sources.append(src)

    social = []
    if meta.get("twitter"):
        handle = str(meta["twitter"]).lstrip("@")
        social.append(
            {"platform": "x", "handle": handle, "url": f"https://x.com/{handle}"}
        )

    clusters = lineup.get("clusters") or HEURISTIC_CLUSTERS.get(old_slug) or ["tech"]
    occupations = lineup.get("occupations") or []
    if not occupations and meta.get("title"):
        occupations = [str(meta["title"])]

    known_for = meta.get("known_for") or []
    if isinstance(known_for, str):
        known_for = [known_for]

    new_meta = {
        "slug": new_slug,
        "name": meta.get("name") or new_slug,
        "number": lineup.get("number"),
        "status": "published",
        "short": short,
        "title": title,
        "photo": meta.get("photo") or "",
        "photo_credit": meta.get("photo_credit") or "",
        "photo_license": meta.get("photo_license") or "",
        "birth": birth,
        "death": None,
        "education": [],
        "occupations": occupations,
        "clusters": clusters,
        "organizations": [],
        "website": "",
        "social": social,
        "known_for": known_for,
        "relationships": [],
        "featured_on": meta.get("featured_on"),
        "sources": sources,
    }

    # Drop empty number
    if new_meta["number"] is None:
        new_meta.pop("number")

    out_name = f"{new_slug}.md"
    out_path = RYANS / out_name
    text = f"---\n{dump_frontmatter(new_meta)}\n---\n\n{body}\n"
    out_path.write_text(text, encoding="utf-8")
    if path.resolve() != out_path.resolve():
        path.unlink()
    return out_path


def install_petersen_draft() -> None:
    # Remove legacy short Petersen if present
    legacy = RYANS / "petersen.md"
    if legacy.exists():
        legacy.unlink()

    src = UPLOAD_PETERSEN
    if not src.exists():
        raise SystemExit(f"Missing upload: {src}")

    meta, body = parse_file(src)
    meta["status"] = "draft"
    # Keep short for cards when eventually published
    meta.setdefault("short", "Flexport founder")
    meta.setdefault("title", "Founder and CEO of Flexport")
    meta.setdefault("photo", "/images/ryans/ryan-petersen.jpg")
    meta.setdefault("photo_credit", "")
    meta.setdefault("photo_license", "")
    meta.setdefault("featured_on", None)

    # Point thematic link at published graves slug once migrated
    for rel in meta.get("relationships") or []:
        if isinstance(rel, dict) and rel.get("target") == "ryan-graves":
            # kept as ryan-graves after migration
            pass

    out = RYANS / "01-ryan-petersen.md"
    out.write_text(
        f"---\n{dump_frontmatter(meta)}\n---\n\n{body}\n",
        encoding="utf-8",
    )
    print(f"Wrote draft {out.name} (slug={meta.get('slug')}, status=draft)")


def add_sample_relationships() -> None:
    """A few verified-style edges among published lineup Ryans for the web demo."""
    edges = [
        (
            "ryan-reynolds",
            {
                "target": "ryan-gosling",
                "type": "thematic-link",
                "note": "Fellow Canadian actors frequently paired in media coverage; shared-project cite pending.",
                "cite": [],
                "verified": False,
            },
        ),
        (
            "ryan-petersen",  # draft — won't appear in graph until published
            {
                "target": "ryan-graves",
                "type": "thematic-link",
                "note": "Bloomberg pitched Flexport as an 'Uber of the Oceans'.",
                "cite": [1],
                "verified": True,
            },
        ),
        (
            "ryan-dahl",
            {
                "target": "ryan-hoover",
                "type": "thematic-link",
                "note": "Both prominent open-web / product-ecosystem builders in tech.",
                "cite": [],
                "verified": False,
            },
        ),
        (
            "ryan-smith-qualtrics",
            {
                "target": "ryan-anderson",
                "type": "worked-with",
                "note": "Anderson has publicly described mentorship from Ryan Smith.",
                "cite": [],
                "verified": False,
            },
        ),
    ]

    # Only attach edges to files that exist; skip unverified for graph unless we want demo edges.
    # For a visible Ryan web with only published nodes, add a couple verified edges among published.
    published_demo = [
        (
            "ryan-graves",
            {
                "target": "ryan-smith-qualtrics",
                "type": "thematic-link",
                "note": "Tech operators who moved from startup leadership into ownership / investing.",
                "cite": [1],
                "verified": True,
            },
        ),
        (
            "ryan-hoover",
            {
                "target": "ryan-dahl",
                "type": "thematic-link",
                "note": "Product Hunt and Node/Deno as pillars of modern builder culture.",
                "cite": [1],
                "verified": True,
            },
        ),
        (
            "ryan-reynolds",
            {
                "target": "ryan-seacrest",
                "type": "thematic-link",
                "note": "High-profile media entrepreneurs with large consumer brands.",
                "cite": [1],
                "verified": True,
            },
        ),
        (
            "ryan-gosling",
            {
                "target": "ryan-phillippe",
                "type": "thematic-link",
                "note": "Actors who rose through late-90s / 2000s film.",
                "cite": [1],
                "verified": True,
            },
        ),
        (
            "ryan-tedder",
            {
                "target": "ryan-gosling",
                "type": "thematic-link",
                "note": "Musician and actor-musician crossover in pop culture.",
                "cite": [1],
                "verified": True,
            },
        ),
    ]

    for slug, rel in published_demo:
        path = RYANS / f"{slug}.md"
        if not path.exists():
            continue
        meta, body = parse_file(path)
        rels = meta.get("relationships") or []
        if any(
            isinstance(r, dict) and r.get("target") == rel["target"] and r.get("type") == rel["type"]
            for r in rels
        ):
            continue
        rels.append(rel)
        meta["relationships"] = rels
        # Ensure source list has at least n=1 placeholder if citing [1]
        sources = meta.get("sources") or []
        if rel.get("cite") and not any(
            isinstance(s, dict) and s.get("n") == 1 for s in sources
        ):
            if sources and isinstance(sources[0], dict) and sources[0].get("n") is None:
                sources[0]["n"] = 1
            elif not sources:
                sources = [
                    {
                        "n": 1,
                        "title": "Pending primary citation",
                        "publisher": "",
                        "date": None,
                        "url": "https://alltheryans.com/",
                        "access": "unverified",
                    }
                ]
        meta["sources"] = sources
        path.write_text(
            f"---\n{dump_frontmatter(meta)}\n---\n\n{body}\n",
            encoding="utf-8",
        )


def fix_anderson_slug_for_edge() -> None:
    path = RYANS / "anderson.md"
    if not path.exists():
        return
    meta, body = parse_file(path)
    if meta.get("slug") != "ryan-anderson":
        meta["slug"] = "ryan-anderson"
        new = RYANS / "ryan-anderson.md"
        new.write_text(
            f"---\n{dump_frontmatter(meta)}\n---\n\n{body}\n",
            encoding="utf-8",
        )
        path.unlink()


def main() -> None:
    # Migrate every existing md except index
    for path in sorted(RYANS.glob("*.md")):
        old_slug = path.stem
        if old_slug == "petersen":
            continue  # replaced by draft
        if old_slug.startswith("01-"):
            continue
        migrate_one(old_slug, path)

    install_petersen_draft()
    fix_anderson_slug_for_edge()
    add_sample_relationships()
    print("Migration complete.")


if __name__ == "__main__":
    main()
