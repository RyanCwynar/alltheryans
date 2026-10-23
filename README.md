# All The Ryans

Notable people named Ryan — Lit frontend + static JSON built from Markdown, served from the Vercel CDN.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Lit 3 ES modules via import map; deps bundled into `js/vendor/` |
| Site data | Static JSON in `data/api/`, generated from `ryans/*.md` and committed |
| DB | Self-hosted libSQL at `https://alltheryans-db.byldr.co` (optional; backs `/api/*`) |
| ORM | Drizzle (`sqlite` dialect), shared schema in `db/schema.ts` |
| API | Hono on Vercel Functions — **read-only** |
| Ryan share cards | `GET /ryan/:slug` rewrites to Edge `api/ryan-page/[slug]` — SPA shell + per-Ryan OG/Twitter meta |
| Writes | Single-writer CLI (`bun run db:seed`) with `LIBSQL_*` env |

Markdown files in `ryans/` are the source of truth. Publishing is `status: published` in frontmatter.

## Publishing changes

```bash
bun run build:data   # ryans/*.md → data/api/*.json (throwaway local DB, same queries as the API)
git add data/api && git commit && git push
```

### Profile photos

Store files under `images/ryans/` and point `photo:` at that local path (no hotlinks). Prefer the Ryan’s X avatar when `social` has a confirmed handle:

```bash
bun run photos:check                              # fail if an X handle has no local photo
bun run photos:fetch -- --only=ryan-holiday --write   # download avatar + patch frontmatter
bun run build:data
```

Otherwise use a Wikimedia Commons image (set `photo_credit`, `photo_license`, `photo_source`) or leave `photo: ""` for the initials placeholder. See `docs/format-spec.md`.

The deploy is the cache bust: Vercel serves `data/api/` as static files from its CDN, so pages
never wait on a function cold start or the VPS. The output is deterministic, so a rebuild with no
Markdown changes produces no diff.

Browser deps (Lit, marked, DOMPurify) are pinned in `package.json` and bundled with
`bun run build:vendor` into `js/vendor/` (also committed).

## Env vars (server only)

```
LIBSQL_URL=https://alltheryans-db.byldr.co
LIBSQL_AUTH_TOKEN=...
```

Never ship these to the browser. See `.env.example`.

## Local

```bash
bun install
export LIBSQL_URL=file:./.data/local.db
bun run db:migrate
bun run db:seed            # dry-run (reads DB; lists insert/update/delete)
bun run db:seed -- --apply # write to local db
bun run build:data         # the frontend only needs this
bun run test               # unit tests (bun:test)
bun run dev                # static + /api on :4173
```

## API (published only)

The frontend no longer calls these; they remain for external consumers and debugging.

- `GET /api/ryans?tag=&sort=name|number|birth|connections&q=`
- `GET /api/ryans/:slug`
- `GET /api/tags`
- `GET /api/tags/:tag`
- `GET /api/directory` → `{ count, ryans, tags }` (one round-trip for archive)
- `GET /api/ryan-web` → `{ nodes, links }`

Successful GETs send `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.
5xx responses are `no-store`. Functions run on Edge pinned to **iad1** (near the Boston Hostinger VPS / libSQL); `vercel.json` also sets `regions: ["iad1"]`.

## Write path (Head of Content)

**Recommended: CLI import** (implemented). One writer, same Drizzle schema as the API, no multi-writer replication.

```bash
# Dry-run against LIBSQL_URL (read-only): prints exact INSERT/UPDATE/DELETE plan
bun run db:seed

# Full apply: upsert every ryans/*.md Ryan; replace their child rows + outgoing relationships
bun run db:seed -- --apply

# Incremental: only these slugs (and their tags/orgs/education/citations + outgoing relationships)
bun run db:seed -- --only=slug1,slug2
bun run db:seed -- --only=slug1,slug2 --apply
```

### Seed safety

- **`--only=slug,…`** — when set, only those Ryans are deleted/reinserted for child tables (`ryan_tags`, `ryan_organizations`, `education`, `citations`). All other Ryans are untouched.
- **Relationships are never wiped wholesale.** The CLI upserts edges from Markdown (insert if missing, update if fields changed) and only deletes stale outgoing edges whose **source** Ryan is in scope (`--only` set, or every repo Ryan when `--only` is omitted). Relationships for Ryans that exist in the DB but are outside scope (or not in the repo) are left alone.
- **Dry-run** always connects to `LIBSQL_URL` and lists every ryan/relationship insert, update, and delete before any write.

After `--apply`, the seed script tries a Vercel CDN purge of `/api/*` when `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` are set. The public pages read `data/api/`, so also run `bun run build:data` and commit.

Wallet-signature allowlist can wrap the same upserts later; not required while Markdown + CLI is the intake.

## Migrations

Checked in under `drizzle/`. Apply with `bun run db:migrate` against the target `LIBSQL_URL`. Do not run migrate/seed against prod from unattended agents unless Ryan asks.
