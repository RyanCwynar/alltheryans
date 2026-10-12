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
- `GET /api/ryan-web` → `{ nodes, links }`

## Write path (Head of Content)

**Recommended: CLI import** (implemented). One writer, same Drizzle schema as the API, no multi-writer replication.

```bash
bun run db:seed -- --apply
```

Wallet-signature allowlist can wrap the same upserts later; not required while Markdown + CLI is the intake.

## Photos

Photos are self-hosted: files live in `images/ryans/` and Vercel serves them as static assets. Don't hotlink.

To pull in a new photo, put its URL in the profile's `photo:` field (a Wikimedia Commons URL is best), then:

```bash
bun run photos:fetch            # dry-run: lists remote photos
bun run photos:fetch -- --apply # download to images/ryans/, rewrite photo/credit/license
bun run db:seed -- --apply      # push the new paths to the DB
```

For Commons files the script fills `photo_credit` and `photo_license` from the file's metadata.

## Migrations

Checked in under `drizzle/`. Apply with `bun run db:migrate` against the target `LIBSQL_URL`. Do not run migrate/seed against prod from unattended agents unless Ryan asks.
