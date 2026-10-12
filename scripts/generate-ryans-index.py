#!/usr/bin/env python3
"""Regenerate ryans/index.json from ryans/*.md frontmatter.

CI helper (not a site build). Publishes only status=published entries into the
public catalog and builds graph nodes/edges from relationships.
"""

from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RYANS_DIR = ROOT / "ryans"
OUT = RYANS_DIR / "index.json"

try:
    import yaml
except ImportError:
    print("PyYAML is required: pip install pyyaml", file=sys.stderr)
    sys.exit(1)

# Directed relationship types (from schema proposal)
DIRECTED_TYPES = {"invested-in"}

TAG_LABELS = {
    "actor": "Actor Ryans",
    "founder": "Founder Ryans",
    "athlete": "Athlete Ryans",
    "musician": "Musician Ryans",
    "tech": "Tech Ryans",
    "olympian": "Olympian Ryans",
    "sports-owner": "Sports-owner Ryans",
    "historical": "Historical Ryans",
    "investor": "Investor Ryans",
    "logistics": "Logistics Ryans",
    "film": "Film Ryans",
    "director": "Director Ryans",
    "tv-host": "TV Host Ryans",
    "media": "Media Ryans",
    "broadcaster": "Broadcaster Ryans",
    "engineer": "Engineer Ryans",
    "open-source": "Open-source Ryans",
    "education": "Education Ryans",
    "creator": "Creator Ryans",
    "youtube": "YouTube Ryans",
    "business": "Business Ryans",
    "boxer": "Boxer Ryans",
    "baseball": "Baseball Ryans",
    "songwriter": "Songwriter Ryans",
    "producer": "Producer Ryans",
    "executive": "Executive Ryans",
    "writer": "Writer Ryans",
    "activist": "Activist Ryans",
    "real-estate": "Real-estate Ryans",
    "comedian": "Comedian Ryans",
    "tv": "TV Ryans",
}


def split_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    match = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    if not match:
        return {}, text
    data = yaml.safe_load(match.group(1)) or {}
    if not isinstance(data, dict):
        data = {}
    return data, match.group(2).strip()


def as_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def normalize_sources(sources) -> list[dict]:
    out = []
    for item in as_list(sources):
        if isinstance(item, dict) and item.get("url"):
            out.append(
                {
                    "n": item.get("n"),
                    "title": item.get("title") or "",
                    "publisher": item.get("publisher") or "",
                    "date": str(item["date"]) if item.get("date") is not None else "",
                    "url": item["url"],
                    "access": item.get("access") or "",
                }
            )
        elif isinstance(item, str) and item.strip():
            out.append(
                {
                    "n": None,
                    "title": "",
                    "publisher": "",
                    "date": "",
                    "url": item.strip(),
                    "access": "",
                }
            )
    return out


def normalize_relationships(rels) -> list[dict]:
    out = []
    for item in as_list(rels):
        if not isinstance(item, dict):
            continue
        target = item.get("target")
        rtype = item.get("type")
        if not target or not rtype:
            continue
        out.append(
            {
                "target": str(target),
                "type": str(rtype),
                "note": item.get("note") or "",
                "cite": as_list(item.get("cite")),
                "directed": bool(item.get("directed", rtype in DIRECTED_TYPES)),
                "verified": bool(item.get("verified", bool(as_list(item.get("cite"))))),
            }
        )
    return out


def birth_years(birth) -> tuple[int | None, int | None]:
    if not isinstance(birth, dict):
        return None, None
    if birth.get("date_precision") == "year-range" and isinstance(birth.get("date"), str):
        parts = re.findall(r"\d{4}", birth["date"])
        if len(parts) >= 2:
            return int(parts[0]), int(parts[1])
        if len(parts) == 1:
            return int(parts[0]), int(parts[0])
    if birth.get("year"):
        y = int(birth["year"])
        return y, y
    if isinstance(birth.get("date"), str):
        parts = re.findall(r"\d{4}", birth["date"])
        if parts:
            return int(parts[0]), int(parts[0])
    return None, None


def tag_label(slug: str) -> str:
    if slug in TAG_LABELS:
        return TAG_LABELS[slug]
    return f"{slug.replace('-', ' ').title()} Ryans"


def entry_from_meta(meta: dict, path: Path) -> dict:
    slug = meta.get("slug") or path.stem
    # Allow NN-slug filenames
    if re.match(r"^\d+-", str(slug)):
        slug = re.sub(r"^\d+-", "", str(slug))
    if path.stem != slug and re.match(r"^\d+-", path.stem):
        slug = meta.get("slug") or re.sub(r"^\d+-", "", path.stem)

    birth = meta.get("birth") if isinstance(meta.get("birth"), dict) else None
    by_min, by_max = birth_years(birth)
    if by_min is None and meta.get("birth_year") is not None:
        try:
            y = int(float(meta["birth_year"]))
            by_min = by_max = y
        except (TypeError, ValueError):
            pass

    short = meta.get("short") or ""
    title = meta.get("title") or ""
    status = (meta.get("status") or "draft").strip().lower()
    if status not in ("draft", "published"):
        status = "draft"

    clusters = [str(c) for c in as_list(meta.get("clusters"))]
    occupations = [str(o) for o in as_list(meta.get("occupations"))]
    known_for = [str(k) for k in as_list(meta.get("known_for"))]

    orgs = []
    for org in as_list(meta.get("organizations")):
        if isinstance(org, dict) and org.get("name"):
            orgs.append(
                {
                    "name": org.get("name"),
                    "role": org.get("role") or "",
                    "start": org.get("start"),
                    "end": org.get("end"),
                    "note": org.get("note") or "",
                }
            )

    education = []
    for edu in as_list(meta.get("education")):
        if isinstance(edu, dict) and edu.get("institution"):
            education.append(
                {
                    "institution": edu.get("institution"),
                    "degree": edu.get("degree"),
                    "field": edu.get("field"),
                    "year": edu.get("year"),
                }
            )

    social = []
    for s in as_list(meta.get("social")):
        if isinstance(s, dict) and (s.get("url") or s.get("handle")):
            social.append(
                {
                    "platform": s.get("platform") or "",
                    "handle": s.get("handle") or "",
                    "url": s.get("url") or "",
                }
            )
    if not social and meta.get("twitter"):
        handle = str(meta["twitter"]).lstrip("@")
        social.append(
            {
                "platform": "x",
                "handle": handle,
                "url": f"https://x.com/{handle}",
            }
        )

    relationships = normalize_relationships(meta.get("relationships"))
    sources = normalize_sources(meta.get("sources"))

    return {
        "slug": str(slug),
        "name": meta.get("name") or str(slug),
        "number": meta.get("number"),
        "short": short if short not in (None, "null") else "",
        "title": title if title not in (None, "null") else "",
        "photo": meta.get("photo") or "",
        "photo_credit": meta.get("photo_credit") or "",
        "photo_license": meta.get("photo_license") or "",
        "status": status,
        "featured_on": meta.get("featured_on"),
        "birth": birth,
        "birth_year_min": by_min,
        "birth_year_max": by_max,
        "death": meta.get("death"),
        "occupations": occupations,
        "clusters": clusters,
        "organizations": orgs,
        "education": education,
        "website": meta.get("website") or "",
        "social": social,
        "known_for": known_for,
        "relationships": relationships,
        "sources": sources,
        "file": f"ryans/{path.name}",
    }


def build_tags(published: list[dict]) -> list[dict]:
    seen = {}
    for ryan in published:
        for cluster in ryan.get("clusters") or []:
            if cluster not in seen:
                seen[cluster] = {
                    "slug": cluster,
                    "label": tag_label(cluster),
                    "kind": "cluster",
                    "count": 0,
                }
            seen[cluster]["count"] += 1
    return sorted(seen.values(), key=lambda t: (-t["count"], t["slug"]))


def build_graph(published: list[dict]) -> dict:
    by_slug = {r["slug"]: r for r in published}
    nodes = []
    for r in published:
        nodes.append(
            {
                "id": r["slug"],
                "slug": r["slug"],
                "name": r["name"],
                "number": r.get("number"),
                "clusters": r.get("clusters") or [],
                "photo": r.get("photo") or "",
            }
        )

    links = []
    seen_edges = set()
    for r in published:
        for rel in r.get("relationships") or []:
            target = rel["target"]
            if target not in by_slug:
                continue
            # Include edges that have a cite, or verified=true; skip dangling drafts
            if not rel.get("verified") and not rel.get("cite"):
                continue
            rtype = rel["type"]
            directed = bool(rel.get("directed"))
            if directed:
                key = (r["slug"], target, rtype)
                if key in seen_edges:
                    continue
                seen_edges.add(key)
                links.append(
                    {
                        "source": r["slug"],
                        "target": target,
                        "type": rtype,
                        "directed": True,
                        "note": rel.get("note") or "",
                    }
                )
            else:
                a, b = sorted([r["slug"], target])
                key = (a, b, rtype)
                if key in seen_edges:
                    continue
                seen_edges.add(key)
                links.append(
                    {
                        "source": a,
                        "target": b,
                        "type": rtype,
                        "directed": False,
                        "note": rel.get("note") or "",
                    }
                )
    return {"nodes": nodes, "links": links}


def main() -> None:
    all_entries = []
    for path in sorted(RYANS_DIR.glob("*.md")):
        meta, _body = split_frontmatter(path.read_text(encoding="utf-8"))
        all_entries.append(entry_from_meta(meta, path))

    published = [e for e in all_entries if e["status"] == "published"]
    drafts = [e for e in all_entries if e["status"] != "published"]

    # Connection counts for sorting
    graph = build_graph(published)
    conn = {n["id"]: 0 for n in graph["nodes"]}
    for link in graph["links"]:
        conn[link["source"]] = conn.get(link["source"], 0) + 1
        conn[link["target"]] = conn.get(link["target"], 0) + 1
    for e in published:
        e["connection_count"] = conn.get(e["slug"], 0)

    payload = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "count": len(published),
        "draft_count": len(drafts),
        "tags": build_tags(published),
        "ryans": published,
        "graph": graph,
    }
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {OUT.relative_to(ROOT)} "
        f"({len(published)} published, {len(drafts)} draft, "
        f"{len(graph['nodes'])} nodes, {len(graph['links'])} edges)"
    )


if __name__ == "__main__":
    main()
