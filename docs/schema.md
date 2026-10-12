# All The Ryans — schema (libSQL / SQLite)

Authoring format remains Markdown + YAML frontmatter in `ryans/*.md`.
The single-writer CLI (`bun run db:seed -- --apply`) upserts into libSQL.
The public Hono API is **read-only** and only returns `status = 'published'`.

Drizzle source of truth: `db/schema.ts`  
Checked-in SQL: `drizzle/0000_init.sql`

## Tables

- `ryans` — profile + `body_md`, JSON TEXT for `occupations` / `known_for` / `social`, publish gate `status` (`draft`|`approved`|`published`)
- `tags` / `ryan_tags` — clusters (actor, founder, …)
- `organizations` / `ryan_organizations`
- `education`
- `relationships` — Ryan web edges (verified edges shown on `/api/ryan-web`)
- `sources` / `citations` — footnotes
- `ryans_fts` — FTS5 mirror maintained by the seed CLI

## Env (server only)

- `LIBSQL_URL` — e.g. `https://alltheryans-db.byldr.co` or `file:./.data/local.db`
- `LIBSQL_AUTH_TOKEN` — required for remote URL
