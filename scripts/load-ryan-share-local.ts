/**
 * Bun-local share-card loader (node:fs). Not imported by Edge api/* modules.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createDb } from "../db/client.js";
import { getPublishedRyanBySlug } from "../db/queries.js";
import { slugLookupCandidates } from "../db/slug-alias.js";
import type { RyanShareInput } from "../api/_lib/ryan-shell.js";
import { resolveRyanShare } from "../api/_lib/load-ryan-share.js";

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

async function fromStaticDisk(
  slug: string,
  root: string,
): Promise<RyanShareInput | null> {
  for (const candidate of slugLookupCandidates(slug)) {
    try {
      const raw = await readFile(
        join(root, "data/api/ryans", `${candidate}.json`),
        "utf8",
      );
      const data = JSON.parse(raw) as { ryan?: RyanShareInput };
      if (data.ryan) return asShareInput(data.ryan);
    } catch {
      // try next candidate
    }
  }
  return null;
}

/** Committed JSON first, then optional local libSQL for DB-only Ryans. */
export async function loadRyanShareLocal(
  slug: string,
  root: string,
): Promise<RyanShareInput | null> {
  const fromStatic = await fromStaticDisk(slug, root);

  const url = process.env.LIBSQL_URL?.trim();
  if (url?.startsWith("file:")) {
    try {
      const { db } = createDb();
      const ryan = await getPublishedRyanBySlug(db, slug);
      if (ryan) return resolveRyanShare(asShareInput(ryan), fromStatic);
    } catch {
      // Unmigrated local DB is common in fresh checkouts.
    }
    return fromStatic;
  }

  return fromStatic;
}
