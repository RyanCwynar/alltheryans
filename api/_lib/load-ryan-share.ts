/**
 * Load a published Ryan for share-card HTML: prefer libSQL when configured,
 * else static data/api JSON (committed seed) from the same deployment / disk.
 * When the DB row exists but `photo` is empty, fill photo from static JSON.
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

/** Bun local: committed JSON first, then optional libSQL for DB-only Ryans. */
export async function loadRyanShareLocal(
  slug: string,
  root: string,
): Promise<RyanShareInput | null> {
  let fromStatic: RyanShareInput | null = null;
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const raw = await readFile(
      join(root, "data/api/ryans", `${slug}.json`),
      "utf8",
    );
    const data = JSON.parse(raw) as { ryan?: RyanShareInput };
    if (data.ryan) fromStatic = asShareInput(data.ryan);
  } catch {
    // fall through to DB
  }

  const url = process.env.LIBSQL_URL?.trim();
  if (url?.startsWith("file:")) {
    try {
      const { createDb } = await import("../../db/client.js");
      const { db } = createDb();
      const ryan = await getPublishedRyanBySlug(db, slug);
      if (ryan) {
        const fromDb = asShareInput(ryan);
        return resolveRyanShare(fromDb, fromStatic);
      }
    } catch {
      // Unmigrated local DB is common in fresh checkouts.
    }
    return fromStatic;
  }

  const fromDb = await fromDatabase(slug);
  if (fromDb || fromStatic) return resolveRyanShare(fromDb, fromStatic);
  return null;
}

export { photoMissing };
