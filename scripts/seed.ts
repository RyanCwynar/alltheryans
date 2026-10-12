#!/usr/bin/env bun
/**
 * Single-writer import CLI: load ryans/*.md into libSQL via the shared Drizzle schema.
 *
 * Default: dry-run (no writes).
 * Apply:    bun run db:seed -- --apply
 *
 * Auth for Head of Content: use this CLI with LIBSQL_URL + LIBSQL_AUTH_TOKEN
 * (wallet SIWE can wrap the same upserts later; one writer at a time).
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { createDb } from "../db/client.js";
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
import { parseRyanMarkdown, type ParsedRyan } from "./parse-ryan-md.js";

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function upsertTag(
  db: ReturnType<typeof createDb>["db"],
  slug: string,
  apply: boolean,
): Promise<number | null> {
  const label = tagLabel(slug);
  if (!apply) return null;
  const existing = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
  if (existing[0]) return existing[0].id;
  const inserted = await db
    .insert(tags)
    .values({ slug, label, kind: "cluster" })
    .returning({ id: tags.id });
  return inserted[0]!.id;
}

async function upsertOrg(
  db: ReturnType<typeof createDb>["db"],
  name: string,
  url: string,
  apply: boolean,
): Promise<number | null> {
  const slug = slugify(name);
  if (!apply) return null;
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
  db: ReturnType<typeof createDb>["db"],
  src: ParsedRyan["sources"][number],
  apply: boolean,
): Promise<number | null> {
  if (!apply) return null;
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
    })
    .returning({ id: sources.id });
  return inserted[0]!.id;
}

async function syncFts(
  client: ReturnType<typeof createDb>["client"],
  _ryanId: number,
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
  db: ReturnType<typeof createDb>["db"],
  client: ReturnType<typeof createDb>["client"],
  parsed: ParsedRyan,
  apply: boolean,
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

  console.log(
    `${apply ? "UPSERT" : "DRY"} ${parsed.slug} status=${parsed.status} tags=${parsed.clusters.join(",") || "-"} sources=${parsed.sources.length}`,
  );

  if (!apply) return;

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
    const tagId = await upsertTag(db, cluster, true);
    if (tagId != null) {
      await db.insert(ryanTags).values({ ryanId, tagId }).onConflictDoNothing();
    }
  }

  for (const org of parsed.organizations) {
    const orgId = await upsertOrg(db, org.name, org.url, true);
    if (orgId != null) {
      await db.insert(ryanOrganizations).values({
        ryanId,
        organizationId: orgId,
        role: org.role || null,
        startYear: org.start,
        endYear: org.end,
        note: org.note || null,
      });
    }
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

  const footnoteToSourceId = new Map<number, number>();
  for (const src of parsed.sources) {
    const sourceId = await upsertSource(db, src, true);
    if (sourceId != null && src.n != null) {
      footnoteToSourceId.set(src.n, sourceId);
      await db.insert(citations).values({
        sourceId,
        ryanId,
        footnoteN: src.n,
        field: null,
        quote: null,
      });
    }
  }

  await syncFts(client, ryanId, {
    slug: parsed.slug,
    name: parsed.name,
    short: parsed.short,
    title: parsed.title,
    bodyMd: parsed.bodyMd,
  });

  // Stash pending relationships on the object for pass 2
  (parsed as ParsedRyan & { _ryanId: number; _footnoteMap: Map<number, number> })._ryanId =
    ryanId;
  (
    parsed as ParsedRyan & { _footnoteMap: Map<number, number> }
  )._footnoteMap = footnoteToSourceId;
}

async function importRelationships(
  db: ReturnType<typeof createDb>["db"],
  parsedList: ParsedRyan[],
  slugToId: Map<string, number>,
  apply: boolean,
) {
  for (const parsed of parsedList) {
    const sourceId = slugToId.get(parsed.slug);
    if (!sourceId) continue;
    for (const rel of parsed.relationships) {
      const targetId = slugToId.get(rel.target);
      if (!targetId) {
        console.log(
          `  queue relationship ${parsed.slug} -> ${rel.target} (${rel.type}) — target missing`,
        );
        continue;
      }
      console.log(
        `${apply ? "REL" : "DRY-REL"} ${parsed.slug} -[${rel.type}]-> ${rel.target}`,
      );
      if (!apply) continue;

      await db
        .insert(relationships)
        .values({
          sourceId,
          targetId,
          type: rel.type,
          directed: rel.directed,
          note: rel.note || null,
          verified: rel.verified,
        })
        .onConflictDoUpdate({
          target: [
            relationships.sourceId,
            relationships.targetId,
            relationships.type,
          ],
          set: {
            directed: rel.directed,
            note: rel.note || null,
            verified: rel.verified,
          },
        });
    }
  }
}

async function main() {
  const apply = hasFlag("--apply");
  const ryansDir = join(import.meta.dir, "..", "ryans");
  const files = (await readdir(ryansDir))
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => join(ryansDir, f));

  const parsedList: ParsedRyan[] = [];
  for (const file of files) {
    parsedList.push(await parseRyanMarkdown(file));
  }

  console.log(
    `Parsed ${parsedList.length} markdown files. Mode: ${apply ? "APPLY" : "DRY-RUN"}`,
  );
  console.log(
    `  published=${parsedList.filter((p) => p.status === "published").length} draft=${parsedList.filter((p) => p.status === "draft").length}`,
  );

  if (!apply) {
    for (const p of parsedList) {
      console.log(
        `DRY ${p.slug} status=${p.status} clusters=${p.clusters.join("|") || "-"} rels=${p.relationships.length}`,
      );
    }
    console.log("Dry-run complete. Re-run with --apply to write.");
    return;
  }

  const { db, client } = createDb();
  const slugToId = new Map<string, number>();

  // Clear relationship edges before re-import so stale links do not linger
  await db.delete(relationships);

  for (const parsed of parsedList) {
    await importRyan(db, client, parsed, true, slugToId);
  }
  await importRelationships(db, parsedList, slugToId, true);

  console.log(`Applied ${parsedList.length} Ryans to ${process.env.LIBSQL_URL}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
