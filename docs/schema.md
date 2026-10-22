# All The Ryans — schema (libSQL / SQLite)

Authoring format remains Markdown + YAML frontmatter in `ryans/*.md`.
The single-writer CLI (`bun run db:seed -- --apply`) upserts into libSQL.
Use `--only=slug1,slug2` for incremental seeding; relationships are upserted and
only outgoing edges for in-scope sources are replaced (never a wholesale wipe).
The public Hono API is **read-only** and only returns `status = 'published'`.

Drizzle source of truth: `db/schema.ts`  
Checked-in SQL: `drizzle/0000_init.sql`, `drizzle/0001_photo_source.sql`

## Tables

- `ryans` — profile + `body_md`, photo fields (`photo`, `photo_credit`, `photo_license`, `photo_source`), JSON TEXT for `occupations` / `known_for` / `social`, publish gate `status` (`draft`|`approved`|`published`)
- `tags` / `ryan_tags` — clusters (actor, founder, …)
- `organizations` / `ryan_organizations`
- `education`
- `relationships` — Ryan web edges (verified edges shown on `/api/ryan-web`)
- `sources` / `citations` — footnotes
- `ryans_fts` — FTS5 mirror maintained by the seed CLI

## Clusters (controlled vocabulary)

Frontmatter `clusters:` values are tag slugs. Prefer this list; new sport/field tags need an entry here (and a friendly label in `db/serialize.ts` `tagLabel` when the default title-case is wrong).

- Core: `actor`, `athlete`, `author`, `business`, `creator`, `engineer`, `entertainment`, `founder`, `investor`, `media`, `musician`, `producer`, `tech`
- Fields: `3d-printing`, `boxing`, `crypto`, `education`, `film`, `fintech`, `football`, `hardware`, `hockey`, `latin`, `legal-tech`, `logistics`, `mlb`, `motorsport`, `music`, `nfl`, `open-source`, `philosophy`, `radio`, `real-estate`, `retail`, `sales`, `sports`, `television`, `tv`, `youtube`

## Env (server only)

- `LIBSQL_URL` — e.g. `https://alltheryans-db.byldr.co` or `file:./.data/local.db`
- `LIBSQL_AUTH_TOKEN` — required for remote URL
