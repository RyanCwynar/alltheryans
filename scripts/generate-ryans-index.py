#!/usr/bin/env python3
"""Regenerate ryans/index.json from ryans/*.md frontmatter. CI helper, not a site build."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RYANS_DIR = ROOT / "ryans"
OUT = RYANS_DIR / "index.json"


def parse_frontmatter(text: str) -> tuple[dict, str]:
    match = re.match(r"^---\n(.*?)\n---\n?(.*)$", text, re.S)
    if not match:
        return {}, text
    raw, body = match.group(1), match.group(2)
    meta: dict = {}
    for line in raw.splitlines():
        if not line.strip() or line.strip().startswith("#") or ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if value.startswith("[") and value.endswith("]"):
            inner = value[1:-1].strip()
            if not inner:
                meta[key] = []
                continue
            items: list[str] = []
            current = ""
            in_quote = False
            quote_char = ""
            for ch in inner:
                if ch in "\"'" and not in_quote:
                    in_quote = True
                    quote_char = ch
                    current += ch
                elif in_quote and ch == quote_char:
                    in_quote = False
                    current += ch
                elif ch == "," and not in_quote:
                    items.append(current.strip())
                    current = ""
                else:
                    current += ch
            if current.strip():
                items.append(current.strip())
            cleaned = []
            for item in items:
                item = item.strip()
                if len(item) >= 2 and item[0] == item[-1] and item[0] in "\"'":
                    item = item[1:-1]
                cleaned.append(item)
            meta[key] = cleaned
        elif len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            meta[key] = value[1:-1]
        elif value in ("null", "Null", "~", ""):
            meta[key] = None
        elif value in ("true", "True"):
            meta[key] = True
        elif value in ("false", "False"):
            meta[key] = False
        else:
            try:
                meta[key] = float(value) if "." in value else int(value)
            except ValueError:
                meta[key] = value
    return meta, body.strip()


def main() -> None:
    entries = []
    for path in sorted(RYANS_DIR.glob("*.md")):
        meta, _body = parse_frontmatter(path.read_text(encoding="utf-8"))
        slug = meta.get("slug") or path.stem
        entry = {
            "slug": slug,
            "name": meta.get("name") or slug,
            "short": meta.get("short") or "",
            "title": meta.get("title") or "",
            "photo": meta.get("photo") or "",
            "photo_credit": meta.get("photo_credit") or "",
            "photo_license": meta.get("photo_license") or "",
            "sources": meta.get("sources") or [],
            "featured_on": meta.get("featured_on"),
            "file": f"ryans/{path.name}",
        }
        for key in ("short", "title", "photo", "photo_credit", "photo_license"):
            if entry[key] in (None, "null"):
                entry[key] = ""
        entries.append(entry)

    payload = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "count": len(entries),
        "ryans": entries,
    }
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({len(entries)} ryans)")


if __name__ == "__main__":
    main()
