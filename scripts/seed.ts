#!/usr/bin/env bun
/**
 * Single-writer import CLI: load ryans/*.md into libSQL via the shared Drizzle schema.
 *
 * Default: dry-run (read DB, print insert/update/delete plan, no writes).
 * Apply:    bun run db:seed -- --apply
 * Subset:   bun run db:seed -- --only=slug1,slug2 [--apply]
 *
 * Auth for Head of Content: use this CLI with LIBSQL_URL + LIBSQL_AUTH_TOKEN
 * (wallet SIWE can wrap the same upserts later; one writer at a time).
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { createDb, type Db } from "../db/client.js";
import {
  citations,
  education,
  organizations,
  relationships,
  ryanOrganizations,
  ryans,
  ryanTags,
  sources,
  tags,
} from "../db/schema.js";
import { jsonString, slugify, tagLabel } from "../db/serialize.js";
import { parseRyanMarkdown, type ParsedRyan, type ParsedRelationship } from "./parse-ryan-md.js";

export type SeedArgs = {
  apply: boolean;
  /** null = all repo Ryans; otherwise only these slugs */
  onlySlugs: string[] | null;
};

export type RelEdge = {
  sourceSlug: string;
  targetSlug: string;
  type: string;
  directed: boolean;
  note: string;
  verified: boolean;
};

export type SeedPlan = {
  ryansInsert: string[];
  ryansUpdate: string[];
  relInsert: RelEdge[];
  relUpdate: RelEdge[];
  relDelete: RelEdge[];
  relSkipMissingTarget: RelEdge[];
};

/** Parse CLI flags from argv (defaults to process.argv). */
export function parseSeedArgs(argv: string[] = process.argv): SeedArgs {
  const apply = argv.includes("--apply");
  const onlyArg = argv.find((a) => a === "--only" || a.startsWith("--only="));
  let onlySlugs: string[] | null = null;
  if (onlyArg) {
    let raw = "";
    if (onlyArg.startsWith("--only=")) {
      raw = onlyArg.slice("--only=".length);
    } else {
      const idx = argv.indexOf("--only");
      raw = argv[idx + 1] ?? "";
      if (!raw || raw.startsWith("--")) {
        throw new Error("--only requires a comma-separated slug list (e.g. --only=slug1,slug2)");
      }
    }
    onlySlugs = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (onlySlugs.length === 0) {
      throw new Error("--only requires at least one slug");
    }
  }
  return { apply, onlySlugs };
}

/**
 * Restrict the parsed list to `--only` slugs. Throws if any requested slug is
 * missing from the repo. When onlySlugs is null, returns the full list.
 */
export function filterParsedRyans(
  parsedList: ParsedRyan[],
  onlySlugs: string[] | null,
): ParsedRyan[] {
  if (onlySlugs == null) return parsedList;
  const bySlug = new Map(parsedList.map((p) => [p.slug, p]));
  const missing = onlySlugs.filter((s) => !bySlug.has(s));
  if (missing.length > 0) {
    throw new Error(`Unknown slug(s) for --only: ${missing.join(", ")}`);
  }
  // Preserve --only order for predictable dry-run output
  return onlySlugs.map((s) => bySlug.get(s)!);
}

function relKey(e: Pick<RelEdge, "sourceSlug" | "targetSlug" | "type">): string {
  return `${e.sourceSlug}\0${e.targetSlug}\0${e.type}`;
}

function relFieldsEqual(a: RelEdge, b: RelEdge): boolean {
  return (
    a.directed === b.directed &&
    (a.note || "") === (b.note || "") &&
    a.verified === b.verified
  );
}

/**
 * Diff desired relationships against existing DB edges for scoped source Ryans.
 * Edges whose source is outside `scopedSourceSlugs` are never deleted or updated.
 */
export function planRelationshipOps(
  desired: RelEdge[],
  existing: RelEdge[],
  scopedSourceSlugs: Set<string>,
): Pick<SeedPlan, "relInsert" | "relUpdate" | "relDelete"> {
  const scopedDesired = desired.filter((e) => scopedSourceSlugs.has(e.sourceSlug));
  const scopedExisting = existing.filter((e) => scopedSourceSlugs.has(e.sourceSlug));

  const desiredByKey = new Map(scopedDesired.map((e) => [relKey(e), e]));
  const existingByKey = new Map(scopedExisting.map((e) => [relKey(e), e]));

  const relInsert: RelEdge[] = [];
  const relUpdate: RelEdge[] = [];
  const relDelete: RelEdge[] = [];

  for (const [key, want] of desiredByKey) {
    const have = existingByKey.get(key);
    if (!have) relInsert.push(want);
    else if (!relFieldsEqual(want, have)) relUpdate.push(want);
  }
  for (const [key, have] of existingByKey) {
    if (!desiredByKey.has(key)) relDelete.push(have);
  }

  return { relInsert, relUpdate, relDelete };
}

/** Build desired RelEdge list from parsed markdown; collect missing-target skips. */
export function collectDesiredRelationships(
  parsedInScope: ParsedRyan[],
  slugToId: Map<string, number>,
): { desired: RelEdge[]; skipMissingTarget: RelEdge[] } {
  const desired: RelEdge[] = [];
  const skipMissingTarget: RelEdge[] = [];
  for (const parsed of parsedInScope) {
    for (const rel of parsed.relationships) {
      const edge = toRelEdge(parsed.slug, rel);
      if (!slugToId.has(rel.target)) {
        skipMissingTarget.push(edge);
        continue;
      }
      desired.push(edge);
    }
  }
  return { desired, skipMissingTarget };
}

function toRelEdge(sourceSlug: string, rel: ParsedRelationship): RelEdge {
  return {
    sourceSlug,
    targetSlug: rel.target,
    type: rel.type,
    directed: rel.directed,
    note: rel.note || "",
    verified: rel.verified,
  };
}

export function formatSeedPlan(plan: SeedPlan, opts: SeedArgs): string[] {
  const lines: string[] = [];
  const scope =
    opts.onlySlugs == null
      ? "all repo Ryans"
      : `--only=${opts.onlySlugs.join(",")}`;
  lines.push(`Scope: ${scope}`);
  lines.push(
    `Ryans: insert=${plan.ryansInsert.length} update=${plan.ryansUpdate.length}`,
  );
  lines.push(
    `Relationships: insert=${plan.relInsert.length} update=${plan.relUpdate.length} delete=${plan.relDelete.length} skip(missing target)=${plan.relSkipMissingTarget.length}`,
  );
  lines.push("");

  for (const slug of plan.ryansInsert) {
    lines.push(`INSERT ryan ${slug}`);
  }
  for (const slug of plan.ryansUpdate) {
    lines.push(
      `UPDATE ryan ${slug} (replace tags, organizations, education, citations)`,
    );
  }
  for (const e of plan.relInsert) {
    lines.push(
      `INSERT rel ${e.sourceSlug} -[${e.type}]-> ${e.targetSlug}`,
    );
  }
  for (const e of plan.relUpdate) {
    lines.push(
      `UPDATE rel ${e.sourceSlug} -[${e.type}]-> ${e.targetSlug}`,
    );
  }
  for (const e of plan.relDelete) {
    lines.push(
      `DELETE rel ${e.sourceSlug} -[${e.type}]-> ${e.targetSlug}`,
    );
  }
  for (const e of plan.relSkipMissingTarget) {
    lines.push(
      `SKIP rel ${e.sourceSlug} -[${e.type}]-> ${e.targetSlug} (target missing)`,
    );
  }
  return lines;
}

async function loadSlugToId(db: Db): Promise<Map<string, number>> {
  const rows = await db.select({ id: ryans.id, slug: ryans.slug }).from(ryans);
  return new Map(rows.map((r) => [r.slug, r.id]));
}

async function loadExistingRelationships(
  db: Db,
  idToSlug: Map<number, string>,
  scopedSourceIds: number[],
): Promise<RelEdge[]> {
  if (scopedSourceIds.length === 0) return [];
  const rows = await db
    .select({
      sourceId: relationships.sourceId,
      targetId: relationships.targetId,
      type: relationships.type,
      directed: relationships.directed,
      note: relationships.note,
      verified: relationships.verified,
    })
    .from(relationships)
    .where(inArray(relationships.sourceId, scopedSourceIds));

  const edges: RelEdge[] = [];
  for (const r of rows) {
    const sourceSlug = idToSlug.get(r.sourceId);
    const targetSlug = idToSlug.get(r.targetId);
    if (!sourceSlug || !targetSlug) continue;
    edges.push({
      sourceSlug,
      targetSlug,
      type: r.type,
      directed: r.directed,
      note: r.note || "",
      verified: r.verified,
    });
  }
  return edges;
}

async function buildSeedPlan(
  db: Db,
  parsedInScope: ParsedRyan[],
): Promise<{ plan: SeedPlan; slugToId: Map<string, number> }> {
  const slugToId = await loadSlugToId(db);
  const idToSlug = new Map([...slugToId.entries()].map(([s, id]) => [id, s]));

  const ryansInsert: string[] = [];
  const ryansUpdate: string[] = [];
  for (const p of parsedInScope) {
    if (slugToId.has(p.slug)) ryansUpdate.push(p.slug);
    else ryansInsert.push(p.slug);
  }

  const scopedSourceSlugs = new Set(parsedInScope.map((p) => p.slug));
  // New inserts are not in slugToId yet; relationship planning only needs
  // existing DB edges for sources that already have ids.
  const scopedSourceIds = [...scopedSourceSlugs]
    .map((s) => slugToId.get(s))
    .filter((id): id is number => id != null);

  const existing = await loadExistingRelationships(db, idToSlug, scopedSourceIds);
  // Targets being inserted in this same run are not in slugToId yet — mark them
  // provisionally so desired edges between new Ryans are not skipped.
  const provisional = new Map(slugToId);
  for (const slug of ryansInsert) provisional.set(slug, -1);
  const { desired, skipMissingTarget } = collectDesiredRelationships(
    parsedInScope,
    provisional,
  );

  const { relInsert, relUpdate, relDelete } = planRelationshipOps(
    desired,
    existing,
    scopedSourceSlugs,
  );

  return {
    plan: {
      ryansInsert,
      ryansUpdate,
      relInsert,
      relUpdate,
      relDelete,
      relSkipMissingTarget: skipMissingTarget,
    },
    slugToId,
  };
}

async function upsertTag(
  db: Db,
  slug: string,
): Promise<number> {
  const label = tagLabel(slug);
  const existing = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
  if (existing[0]) return existing[0].id;
  const inserted = await db
    .insert(tags)
    .values({ slug, label, kind: "cluster" })
    .returning({ id: tags.id });
  return inserted[0]!.id;
}

async function upsertOrg(
  db: Db,
  name: string,
  url: string,
): Promise<number> {
  const slug = slugify(name);
  const existing = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const inserted = await db
    .insert(organizations)
    .values({ slug, name, url: url || null })
    .returning({ id: organizations.id });
  return inserted[0]!.id;
}

async function upsertSource(
  db: Db,
  src: ParsedRyan["sources"][number],
): Promise<number> {
  const existing = await db
    .select()
    .from(sources)
    .where(eq(sources.url, src.url))
    .limit(1);
  if (existing[0]) {
    await db
      .update(sources)
      .set({
        title: src.title || existing[0].title,
        publisher: src.publisher || existing[0].publisher,
        author: src.author || existing[0].author,
        publishedOn: src.date || existing[0].publishedOn,
        access: src.access || existing[0].access,
        archiveUrl: src.archiveUrl || existing[0].archiveUrl,
        checkedAt: src.checkedAt || existing[0].checkedAt,
      })
      .where(eq(sources.id, existing[0].id));
    return existing[0].id;
  }
  const inserted = await db
    .insert(sources)
    .values({
      url: src.url,
      title: src.title || null,
      publisher: src.publisher || null,
      author: src.author || null,
      publishedOn: src.date,
      access: src.access,
      archiveUrl: src.archiveUrl,
      checkedAt: src.checkedAt,
    })
    .returning({ id: sources.id });
  return inserted[0]!.id;
}

async function syncFts(
  client: ReturnType<typeof createDb>["client"],
  row: {
    slug: string;
    name: string;
    short: string;
    title: string;
    bodyMd: string;
  },
) {
  await client.execute({
    sql: "DELETE FROM ryans_fts WHERE slug = ?",
    args: [row.slug],
  });
  await client.execute({
    sql: `INSERT INTO ryans_fts(slug, name, short, title, body_md)
          VALUES (?, ?, ?, ?, ?)`,
    args: [row.slug, row.name, row.short, row.title, row.bodyMd],
  });
}

async function importRyan(
  db: Db,
  client: ReturnType<typeof createDb>["client"],
  parsed: ParsedRyan,
  slugToId: Map<string, number>,
) {
  const now = new Date().toISOString();
  const values = {
    slug: parsed.slug,
    name: parsed.name,
    seriesNumber: parsed.number,
    short: parsed.short || null,
    title: parsed.title || null,
    photo: parsed.photo || null,
    photoCredit: parsed.photoCredit || null,
    photoLicense: parsed.photoLicense || null,
    photoSource: parsed.photoSource || null,
    birthDate: parsed.birthDate,
    birthYearMin: parsed.birthYearMin,
    birthYearMax: parsed.birthYearMax,
    birthPlace: parsed.birthPlace,
    deathDate: parsed.deathDate,
    website: parsed.website || null,
    leadSummary: parsed.leadSummary || null,
    bodyMd: parsed.bodyMd || null,
    occupations: jsonString(parsed.occupations),
    knownFor: jsonString(parsed.knownFor),
    social: jsonString(parsed.social),
    featuredOn: parsed.featuredOn,
    status: parsed.status,
    publishedAt: parsed.status === "published" ? now : null,
    updatedAt: now,
  };

  const existing = await db
    .select({ id: ryans.id })
    .from(ryans)
    .where(eq(ryans.slug, parsed.slug))
    .limit(1);

  let ryanId: number;
  if (existing[0]) {
    ryanId = existing[0].id;
    await db.update(ryans).set(values).where(eq(ryans.id, ryanId));
    await db.delete(ryanTags).where(eq(ryanTags.ryanId, ryanId));
    await db.delete(ryanOrganizations).where(eq(ryanOrganizations.ryanId, ryanId));
    await db.delete(education).where(eq(education.ryanId, ryanId));
    await db.delete(citations).where(eq(citations.ryanId, ryanId));
  } else {
    const inserted = await db
      .insert(ryans)
      .values({ ...values, createdAt: now })
      .returning({ id: ryans.id });
    ryanId = inserted[0]!.id;
  }
  slugToId.set(parsed.slug, ryanId);

  for (const cluster of parsed.clusters) {
    const tagId = await upsertTag(db, cluster);
    await db.insert(ryanTags).values({ ryanId, tagId }).onConflictDoNothing();
  }

  for (const org of parsed.organizations) {
    const orgId = await upsertOrg(db, org.name, org.url);
    await db.insert(ryanOrganizations).values({
      ryanId,
      organizationId: orgId,
      role: org.role || null,
      startYear: org.start,
      endYear: org.end,
      note: org.note || null,
    });
  }

  for (const edu of parsed.education) {
    await db.insert(education).values({
      ryanId,
      institution: edu.institution,
      degree: edu.degree,
      field: edu.field,
      year: edu.year,
    });
  }

  for (const src of parsed.sources) {
    const sourceId = await upsertSource(db, src);
    if (src.n != null) {
      await db.insert(citations).values({
        sourceId,
        ryanId,
        footnoteN: src.n,
        field: null,
        quote: null,
      });
    }
  }

  await syncFts(client, {
    slug: parsed.slug,
    name: parsed.name,
    short: parsed.short,
    title: parsed.title,
    bodyMd: parsed.bodyMd,
  });
}

async function applyRelationshipPlan(
  db: Db,
  plan: SeedPlan,
  slugToId: Map<string, number>,
) {
  for (const e of plan.relDelete) {
    const sourceId = slugToId.get(e.sourceSlug);
    const targetId = slugToId.get(e.targetSlug);
    if (sourceId == null || targetId == null) continue;
    await db
      .delete(relationships)
      .where(
        and(
          eq(relationships.sourceId, sourceId),
          eq(relationships.targetId, targetId),
          eq(relationships.type, e.type),
        ),
      );
  }

  const upserts = [...plan.relInsert, ...plan.relUpdate];
  for (const e of upserts) {
    const sourceId = slugToId.get(e.sourceSlug);
    const targetId = slugToId.get(e.targetSlug);
    if (sourceId == null || targetId == null) {
      console.log(
        `  skip relationship ${e.sourceSlug} -> ${e.targetSlug} (${e.type}) — id unresolved`,
      );
      continue;
    }
    await db
      .insert(relationships)
      .values({
        sourceId,
        targetId,
        type: e.type,
        directed: e.directed,
        note: e.note || null,
        verified: e.verified,
      })
      .onConflictDoUpdate({
        target: [
          relationships.sourceId,
          relationships.targetId,
          relationships.type,
        ],
        set: {
          directed: e.directed,
          note: e.note || null,
          verified: e.verified,
        },
      });
  }
}

async function main() {
  const opts = parseSeedArgs();
  const allParsed = await parseAllRyans();
  const parsedInScope = filterParsedRyans(allParsed, opts.onlySlugs);

  console.log(
    `Parsed ${allParsed.length} markdown files; seeding ${parsedInScope.length}. Mode: ${opts.apply ? "APPLY" : "DRY-RUN"}`,
  );
  console.log(
    `  in-scope published=${parsedInScope.filter((p) => p.status === "published").length} draft=${parsedInScope.filter((p) => p.status === "draft").length}`,
  );

  const { findPhotoGaps } = await import("./fetch-ryan-photos.js");
  const photoGaps = findPhotoGaps(parsedInScope).filter(
    (g) => g.reason === "x-without-photo" || g.reason === "hotlink",
  );
  if (photoGaps.length) {
    console.log("");
    console.log("Photo warnings (prefer local images/ryans/; fetch X avatars with bun run photos:fetch -- --write):");
    for (const g of photoGaps) {
      console.log(`  ${g.slug}: ${g.reason}${g.handle ? ` (@${g.handle})` : ""}`);
    }
  }

  const { db, client } = createDb();
  try {
    const { plan, slugToId } = await buildSeedPlan(db, parsedInScope);

    for (const line of formatSeedPlan(plan, opts)) {
      console.log(line);
    }

    if (!opts.apply) {
      console.log("");
      console.log("Dry-run complete (no writes). Re-run with --apply to write.");
      return;
    }

    // Never wipe relationships wholesale — only mutate edges for scoped sources.
    for (const parsed of parsedInScope) {
      await importRyan(db, client, parsed, slugToId);
    }
    await applyRelationshipPlan(db, plan, slugToId);

    console.log("");
    console.log(
      `Applied ${parsedInScope.length} Ryan(s) to ${process.env.LIBSQL_URL}`,
    );
    await invalidateCdnCache();
  } finally {
    client.close();
  }
}

/** Parse every ryans/*.md file, sorted by filename. */
export async function parseAllRyans(): Promise<ParsedRyan[]> {
  const ryansDir = join(import.meta.dir, "..", "ryans");
  const files = (await readdir(ryansDir))
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => join(ryansDir, f));
  const parsedList: ParsedRyan[] = [];
  for (const file of files) {
    parsedList.push(await parseRyanMarkdown(file));
  }
  return parsedList;
}

/**
 * Upsert parsed Ryans + relationships into a migrated database.
 * Optional `onlySlugs` limits which Ryans (and their outgoing relationships)
 * are replaced. Relationships for Ryans outside the scope are never deleted.
 */
export async function applyParsedRyans(
  db: Db,
  client: ReturnType<typeof createDb>["client"],
  parsedList: ParsedRyan[],
  onlySlugs: string[] | null = null,
) {
  const parsedInScope = filterParsedRyans(parsedList, onlySlugs);
  const { plan, slugToId } = await buildSeedPlan(db, parsedInScope);

  for (const parsed of parsedInScope) {
    await importRyan(db, client, parsed, slugToId);
  }
  await applyRelationshipPlan(db, plan, slugToId);
}

/**
 * After seed, CDN still serves stale API JSON for up to s-maxage / SWR.
 * Prefer Vercel tag invalidate when creds are present; otherwise bump the
 * frontend cache-version query param (no env var changes).
 *
 * API responses set `Vercel-Cache-Tag: alltheryans-api`.
 */
async function invalidateCdnCache() {
  const token = process.env.VERCEL_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  const tag = "alltheryans-api";

  console.log("");
  console.log("CDN cache after seed:");

  if (token && projectId) {
    const purgeUrl = new URL(
      `https://api.vercel.com/v1/edge-cache/invalidate-by-tag`,
    );
    purgeUrl.searchParams.set("projectId", projectId);
    if (teamId) purgeUrl.searchParams.set("teamId", teamId);

    try {
      const res = await fetch(purgeUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tags: [tag] }),
      });
      if (res.ok) {
        console.log(`  Invalidated Vercel CDN tag "${tag}" (HTTP ${res.status}).`);
        return;
      }
      const body = await res.text();
      console.log(`  Vercel invalidate returned HTTP ${res.status}: ${body.slice(0, 200)}`);
      console.log("  Falling back to manual cache-bust instructions.");
    } catch (err) {
      console.log(`  Vercel invalidate failed: ${(err as Error).message}`);
    }
  } else {
    console.log("  No VERCEL_TOKEN + VERCEL_PROJECT_ID — skip automatic purge.");
  }

  console.log(`  Or: vercel cache invalidate --tag ${tag}`);
  console.log("  The site itself reads data/api/*.json — run `bun run build:data` and commit.");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
