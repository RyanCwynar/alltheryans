/**
 * Read-only query helpers shared by the public API.
 * Only status='published' rows are exposed.
 *
 * Keep round-trips low: one query per concern, parallelize independent reads.
 */
import { and, asc, desc, eq, sql, inArray, or } from "drizzle-orm";
import type { Db } from "./client.js";
import {
  education,
  organizations,
  relationships,
  ryanOrganizations,
  ryans,
  ryanTags,
  sources,
  citations,
  tags,
} from "./schema.js";
import { jsonParse } from "./serialize.js";

export type SortKey = "name" | "number" | "birth" | "connections";

/**
 * Alphabetize by whichever of the first/last names isn't "Ryan".
 * If both or neither is Ryan, use the last name.
 * e.g. Ryan Fleury → F, Nolan Ryan → N, Ryan Ryan → Ryan.
 */
export function nameSortKey(name: string): string {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  const isRyan = (part: string) => part.toLowerCase() === "ryan";
  if (isRyan(first) === isRyan(last)) return last;
  return isRyan(first) ? last : first;
}

function compareByRyanName(a: { name: string }, b: { name: string }): number {
  const byKey = nameSortKey(a.name).localeCompare(nameSortKey(b.name), undefined, {
    sensitivity: "base",
  });
  if (byKey !== 0) return byKey;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function parseJsonFields<T extends { occupations: string; knownFor: string; social: string }>(
  row: T,
) {
  return {
    ...row,
    occupations: jsonParse<string[]>(row.occupations, []),
    known_for: jsonParse<string[]>(row.knownFor, []),
    social: jsonParse<Array<{ platform: string; handle: string; url: string }>>(
      row.social,
      [],
    ),
  };
}

function mapRyanListItem(
  row: typeof ryans.$inferSelect,
  extra: { clusters?: string[]; connection_count?: number } = {},
) {
  const parsed = parseJsonFields(row);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    number: row.seriesNumber,
    short: row.short || "",
    title: row.title || "",
    photo: row.photo || "",
    photo_credit: row.photoCredit || "",
    photo_license: row.photoLicense || "",
    photo_source: row.photoSource || "",
    birth_year_min: row.birthYearMin,
    birth_year_max: row.birthYearMax,
    birth_place: row.birthPlace,
    website: row.website || "",
    lead_summary: row.leadSummary || "",
    occupations: parsed.occupations,
    known_for: parsed.known_for,
    social: parsed.social,
    featured_on: row.featuredOn,
    status: row.status,
    clusters: extra.clusters ?? [],
    connection_count: extra.connection_count ?? 0,
  };
}

/** One round-trip: all cluster slugs for the given Ryan ids. */
async function clustersByRyanIds(db: Db, ids: number[]) {
  const map = new Map<number, string[]>();
  if (!ids.length) return map;
  const rows = await db
    .select({
      ryanId: ryanTags.ryanId,
      slug: tags.slug,
    })
    .from(ryanTags)
    .innerJoin(tags, eq(ryanTags.tagId, tags.id))
    .where(inArray(ryanTags.ryanId, ids));
  for (const row of rows) {
    const list = map.get(row.ryanId) || [];
    list.push(row.slug);
    map.set(row.ryanId, list);
  }
  return map;
}

/**
 * One round-trip: load verified edges and tally in memory (no correlated subquery).
 * Dataset is small (dozens of edges); avoids N per-row SQL.
 */
async function connectionCounts(db: Db, ids?: number[]) {
  const edges = await db
    .select({
      sourceId: relationships.sourceId,
      targetId: relationships.targetId,
    })
    .from(relationships)
    .where(eq(relationships.verified, true));

  const map = new Map<number, number>();
  const bump = (id: number) => {
    if (ids && !ids.includes(id)) return;
    map.set(id, (map.get(id) || 0) + 1);
  };
  for (const e of edges) {
    bump(e.sourceId);
    bump(e.targetId);
  }
  return map;
}

export async function listPublishedRyans(
  db: Db,
  opts: { tag?: string; sort?: SortKey; q?: string } = {},
) {
  const sort = opts.sort || "name";

  let idFilter: number[] | null = null;
  if (opts.tag) {
    const tagged = await db
      .select({ ryanId: ryanTags.ryanId })
      .from(ryanTags)
      .innerJoin(tags, eq(ryanTags.tagId, tags.id))
      .where(eq(tags.slug, opts.tag));
    idFilter = tagged.map((t) => t.ryanId);
    if (!idFilter.length) return [];
  }

  const rows = await db
    .select()
    .from(ryans)
    .where(
      idFilter
        ? and(eq(ryans.status, "published"), inArray(ryans.id, idFilter))
        : eq(ryans.status, "published"),
    );

  let filtered = rows;
  if (opts.q) {
    const needle = opts.q.toLowerCase();
    filtered = rows.filter((r) => {
      const hay = `${r.name} ${r.short || ""} ${r.title || ""} ${r.leadSummary || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }

  const ids = filtered.map((r) => r.id);
  const [clusters, connections] = await Promise.all([
    clustersByRyanIds(db, ids),
    connectionCounts(db, ids),
  ]);

  const mapped = filtered.map((row) =>
    mapRyanListItem(row, {
      clusters: clusters.get(row.id) || [],
      connection_count: connections.get(row.id) || 0,
    }),
  );

  mapped.sort((a, b) => {
    switch (sort) {
      case "number": {
        const an = a.number ?? 9999;
        const bn = b.number ?? 9999;
        if (an !== bn) return an - bn;
        return compareByRyanName(a, b);
      }
      case "birth": {
        const ay = a.birth_year_min ?? 9999;
        const by = b.birth_year_min ?? 9999;
        if (ay !== by) return ay - by;
        return compareByRyanName(a, b);
      }
      case "connections":
        if (a.connection_count !== b.connection_count) {
          return b.connection_count - a.connection_count;
        }
        return compareByRyanName(a, b);
      case "name":
      default:
        return compareByRyanName(a, b);
    }
  });

  return mapped;
}

export async function getPublishedRyanBySlug(db: Db, slug: string) {
  const rows = await db
    .select()
    .from(ryans)
    .where(and(eq(ryans.slug, slug), eq(ryans.status, "published")))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  // Detail joins in parallel after the primary row (2 round-trip waves total).
  const [clusterMap, edu, orgs, relRows, citeRows] = await Promise.all([
    clustersByRyanIds(db, [row.id]),
    db.select().from(education).where(eq(education.ryanId, row.id)),
    db
      .select({
        name: organizations.name,
        url: organizations.url,
        role: ryanOrganizations.role,
        start: ryanOrganizations.startYear,
        end: ryanOrganizations.endYear,
        note: ryanOrganizations.note,
      })
      .from(ryanOrganizations)
      .innerJoin(
        organizations,
        eq(ryanOrganizations.organizationId, organizations.id),
      )
      .where(eq(ryanOrganizations.ryanId, row.id)),
    db
      .select({
        type: relationships.type,
        note: relationships.note,
        directed: relationships.directed,
        verified: relationships.verified,
        sourceSlug: sql<string>`(select slug from ryans where id = ${relationships.sourceId})`,
        targetSlug: sql<string>`(select slug from ryans where id = ${relationships.targetId})`,
      })
      .from(relationships)
      .where(
        or(eq(relationships.sourceId, row.id), eq(relationships.targetId, row.id)),
      ),
    db
      .select({
        n: citations.footnoteN,
        field: citations.field,
        title: sources.title,
        publisher: sources.publisher,
        author: sources.author,
        date: sources.publishedOn,
        url: sources.url,
        access: sources.access,
        archive_url: sources.archiveUrl,
        checked_at: sources.checkedAt,
      })
      .from(citations)
      .innerJoin(sources, eq(citations.sourceId, sources.id))
      .where(eq(citations.ryanId, row.id))
      .orderBy(asc(citations.footnoteN)),
  ]);

  const base = mapRyanListItem(row, { clusters: clusterMap.get(row.id) || [] });

  return {
    ...base,
    birth: {
      date: row.birthDate,
      year_min: row.birthYearMin,
      year_max: row.birthYearMax,
      place: row.birthPlace,
    },
    death: row.deathDate,
    body_md: row.bodyMd || "",
    education: edu.map((e) => ({
      institution: e.institution,
      degree: e.degree,
      field: e.field,
      year: e.year,
    })),
    organizations: orgs,
    relationships: relRows.map((r) => ({
      type: r.type,
      note: r.note || "",
      directed: !!r.directed,
      verified: !!r.verified,
      source: r.sourceSlug,
      target: r.targetSlug,
    })),
    sources: citeRows.map((c) => ({
      n: c.n,
      title: c.title || "",
      publisher: c.publisher || "",
      author: c.author || "",
      date: c.date || "",
      url: c.url,
      access: c.access || "",
      archive_url: c.archive_url || "",
      checked_at: c.checked_at || "",
    })),
  };
}

export async function listTags(db: Db) {
  const rows = await db
    .select({
      slug: tags.slug,
      label: tags.label,
      kind: tags.kind,
      count: sql<number>`count(${ryans.id})`.mapWith(Number),
    })
    .from(tags)
    .leftJoin(ryanTags, eq(tags.id, ryanTags.tagId))
    .leftJoin(ryans, and(eq(ryanTags.ryanId, ryans.id), eq(ryans.status, "published")))
    .groupBy(tags.id)
    .orderBy(desc(sql`count(${ryans.id})`), asc(tags.slug));

  return rows
    .filter((r) => (r.count || 0) > 0)
    .map((r) => ({
      slug: r.slug,
      label: r.label,
      kind: r.kind,
      count: r.count || 0,
    }));
}

/** Directory payload: ryans + tags in parallel (one function, fewer client round-trips). */
export async function getDirectory(
  db: Db,
  opts: { tag?: string; sort?: SortKey; q?: string } = {},
) {
  const [ryansList, tagList] = await Promise.all([
    listPublishedRyans(db, opts),
    listTags(db),
  ]);
  return {
    count: ryansList.length,
    ryans: ryansList,
    tags: tagList,
  };
}

export async function getTagPage(db: Db, tagSlug: string, sort: SortKey = "number") {
  const tagRows = await db.select().from(tags).where(eq(tags.slug, tagSlug)).limit(1);
  const tag = tagRows[0];
  if (!tag) return null;
  const ryansList = await listPublishedRyans(db, { tag: tagSlug, sort });
  return {
    tag: { slug: tag.slug, label: tag.label, kind: tag.kind, count: ryansList.length },
    ryans: ryansList,
  };
}

export async function getRyanWeb(db: Db) {
  const [published, edgeRows] = await Promise.all([
    db.select().from(ryans).where(eq(ryans.status, "published")),
    db.select().from(relationships).where(eq(relationships.verified, true)),
  ]);

  const clusterMap = await clustersByRyanIds(
    db,
    published.map((r) => r.id),
  );

  const nodes = published.map((r) => ({
    id: r.slug,
    slug: r.slug,
    name: r.name,
    number: r.seriesNumber,
    clusters: clusterMap.get(r.id) || [],
    photo: r.photo || "",
  }));

  const idToSlug = new Map(published.map((r) => [r.id, r.slug]));

  const links = [];
  const seen = new Set<string>();
  for (const e of edgeRows) {
    const source = idToSlug.get(e.sourceId);
    const target = idToSlug.get(e.targetId);
    if (!source || !target) continue;
    let from = source;
    let to = target;
    if (!e.directed) {
      [from, to] = [source, target].sort();
    }
    const key = `${from}|${to}|${e.type}|${e.directed ? 1 : 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({
      source: from,
      target: to,
      type: e.type,
      directed: !!e.directed,
      note: e.note || "",
    });
  }

  return { nodes, links };
}
