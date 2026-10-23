/**
 * Load a published Ryan for share-card HTML: prefer libSQL when configured,
 * else static data/api JSON (committed seed) from the same deployment.
 * When the DB row exists but `photo` is empty, fill photo from static JSON.
 *
 * Edge-safe: no node:* imports. Bun-local disk loading lives in
 * scripts/load-ryan-share-local.ts.
 */
import { createDb as createWebDb } from "../../db/client-web.js";
import { getPublishedRyanBySlug } from "../../db/queries.js";
import type { RyanShareInput } from "./ryan-shell.js";
import { mergeRyanWithStaticPhoto, photoMissing } from "./static-photo.js";

function asShareInput(ryan: {
  slug: string;
  name: string;
  title?: string | null;
  short?: string | null;
  lead_summary?: string | null;
  photo?: string | null;
}): RyanShareInput {
  return {
    slug: ryan.slug,
    name: ryan.name,
    title: ryan.title,
    short: ryan.short,
    lead_summary: ryan.lead_summary,
    photo: ryan.photo,
  };
}

async function fromDatabase(slug: string): Promise<RyanShareInput | null> {
  const url = process.env.LIBSQL_URL?.trim();
  if (!url || url.startsWith("file:")) return null;
  if (!process.env.LIBSQL_AUTH_TOKEN?.trim()) return null;
  try {
    const { db } = createWebDb();
    const ryan = await getPublishedRyanBySlug(db, slug);
    return ryan ? asShareInput(ryan) : null;
  } catch (err) {
    console.error("loadRyanShare db:", err);
    return null;
  }
}

async function fromStaticFetch(
  slug: string,
  request: Request,
): Promise<RyanShareInput | null> {
  try {
    const res = await fetch(
      new URL(`/data/api/ryans/${encodeURIComponent(slug)}.json`, request.url),
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { ryan?: RyanShareInput };
    return data.ryan ? asShareInput(data.ryan) : null;
  } catch (err) {
    console.error("loadRyanShare static fetch:", err);
    return null;
  }
}

/**
 * Edge / serverless: DB first; if photo is missing, overlay static JSON photo.
 * Exported merge helper keeps the empty-DB-photo case unit-testable.
 */
export function resolveRyanShare(
  fromDb: RyanShareInput | null,
  fromStatic: RyanShareInput | null,
): RyanShareInput | null {
  return mergeRyanWithStaticPhoto(fromDb, fromStatic);
}

/** Edge / serverless: DB first, then static JSON on the deployment. */
export async function loadRyanShare(
  slug: string,
  request: Request,
): Promise<RyanShareInput | null> {
  const fromDb = await fromDatabase(slug);
  if (fromDb && !photoMissing(fromDb.photo)) return fromDb;

  const fromStatic = await fromStaticFetch(slug, request);
  return resolveRyanShare(fromDb, fromStatic);
}

export { photoMissing };
