# All The Ryans

Notable people named Ryan — Lit frontend (no build) + libSQL (Drizzle) + Hono API on Vercel Functions.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Lit 3 ES modules via import map/CDN (no bundler) |
| DB | Self-hosted libSQL at `https://alltheryans-db.byldr.co` |
| ORM | Drizzle (`sqlite` dialect), shared schema in `db/schema.ts` |
| API | Hono on Vercel Functions — **read-only** |
| Writes | Single-writer CLI (`bun run db:seed`) with `LIBSQL_*` env |

Markdown files in `ryans/` are seed/authoring data. Publishing is `status: published` in frontmatter, applied by the CLI.

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
bun run db:seed            # dry-run
bun run db:seed -- --apply # write to local db
bun run dev                # static + /api on :4173
```

## API (published only)

- `GET /api/ryans?tag=&sort=name|number|birth|connections&q=`
- `GET /api/ryans/:slug`
- `GET /api/tags`
- `GET /api/tags/:tag`
- `GET /api/directory` → `{ count, ryans, tags }` (one round-trip for archive)
- `GET /api/ryan-web` → `{ nodes, links }`

Successful GETs send `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.
5xx responses are `no-store`. Functions run in **iad1** (near the Boston Hostinger VPS / libSQL).

## Write path (Head of Content)

**Recommended: CLI import** (implemented). One writer, same Drizzle schema as the API, no multi-writer replication.

```bash
bun run db:seed -- --apply
```

After `--apply`, the seed script tries a Vercel CDN purge when `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` are set. Otherwise bump `API_CACHE_VERSION` in `js/lib/cache-version.js` and redeploy, or run `vercel cache purge --yes`.

Wallet-signature allowlist can wrap the same upserts later; not required while Markdown + CLI is the intake.

## Migrations

Checked in under `drizzle/`. Apply with `bun run db:migrate` against the target `LIBSQL_URL`. Do not run migrate/seed against prod from unattended agents unless Ryan asks.
