/**
 * Shared Drizzle sqlite schema — source of truth for API (read-only) and write CLI.
 * Adapted from docs/schema.md for libSQL/SQLite (JSON as TEXT, integer PKs).
 */
import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";

export const RELATIONSHIP_TYPES = [
  "co-starred-with",
  "bandmate-of",
  "teammate-of",
  "rival-of",
  "invested-in",
  "co-founded-with",
  "worked-with",
  "same-school",
  "same-hometown",
  "same-company",
  "married-to",
  "related-to",
  "thematic-link",
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export const DIRECTED_RELATIONSHIP_TYPES = new Set<RelationshipType>([
  "invested-in",
]);

export const RYAN_STATUSES = ["draft", "approved", "published"] as const;
export type RyanStatus = (typeof RYAN_STATUSES)[number];

export const ryans = sqliteTable(
  "ryans",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    seriesNumber: integer("series_number"),
    short: text("short"),
    title: text("title"),
    photo: text("photo"),
    photoCredit: text("photo_credit"),
    photoLicense: text("photo_license"),
    birthDate: text("birth_date"),
    birthYearMin: integer("birth_year_min"),
    birthYearMax: integer("birth_year_max"),
    birthPlace: text("birth_place"),
    deathDate: text("death_date"),
    website: text("website"),
    leadSummary: text("lead_summary"),
    bodyMd: text("body_md"),
    /** JSON array of strings */
    occupations: text("occupations").notNull().default("[]"),
    /** JSON array of strings */
    knownFor: text("known_for").notNull().default("[]"),
    /** JSON array of {platform,handle,url} */
    social: text("social").notNull().default("[]"),
    featuredOn: text("featured_on"),
    status: text("status").notNull().default("draft"),
    publishedAt: text("published_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [
    uniqueIndex("ryans_slug_uq").on(t.slug),
    uniqueIndex("ryans_series_number_uq").on(t.seriesNumber),
    index("ryans_status_idx").on(t.status),
    index("ryans_birth_year_min_idx").on(t.birthYearMin),
    index("ryans_featured_on_idx").on(t.featuredOn),
  ],
);

export const tags = sqliteTable(
  "tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    kind: text("kind").notNull().default("cluster"),
  },
  (t) => [uniqueIndex("tags_slug_uq").on(t.slug)],
);

export const ryanTags = sqliteTable(
  "ryan_tags",
  {
    ryanId: integer("ryan_id")
      .notNull()
      .references(() => ryans.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.ryanId, t.tagId] }),
    index("ryan_tags_tag_id_idx").on(t.tagId),
  ],
);

export const organizations = sqliteTable(
  "organizations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    url: text("url"),
  },
  (t) => [uniqueIndex("organizations_slug_uq").on(t.slug)],
);

export const ryanOrganizations = sqliteTable("ryan_organizations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ryanId: integer("ryan_id")
    .notNull()
    .references(() => ryans.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  role: text("role"),
  startYear: integer("start_year"),
  endYear: integer("end_year"),
  note: text("note"),
});

export const education = sqliteTable("education", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ryanId: integer("ryan_id")
    .notNull()
    .references(() => ryans.id, { onDelete: "cascade" }),
  institution: text("institution").notNull(),
  degree: text("degree"),
  field: text("field"),
  year: integer("year"),
});

export const relationships = sqliteTable(
  "relationships",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: integer("source_id")
      .notNull()
      .references(() => ryans.id, { onDelete: "cascade" }),
    targetId: integer("target_id")
      .notNull()
      .references(() => ryans.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    directed: integer("directed", { mode: "boolean" }).notNull().default(false),
    note: text("note"),
    verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    uniqueIndex("relationships_source_target_type_uq").on(
      t.sourceId,
      t.targetId,
      t.type,
    ),
    index("relationships_target_id_idx").on(t.targetId),
  ],
);

export const sources = sqliteTable(
  "sources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    url: text("url").notNull(),
    archiveUrl: text("archive_url"),
    title: text("title"),
    publisher: text("publisher"),
    author: text("author"),
    publishedOn: text("published_on"),
    access: text("access"),
    checkedAt: text("checked_at"),
  },
  (t) => [uniqueIndex("sources_url_uq").on(t.url)],
);

export const citations = sqliteTable(
  "citations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "restrict" }),
    ryanId: integer("ryan_id")
      .notNull()
      .references(() => ryans.id, { onDelete: "cascade" }),
    footnoteN: integer("footnote_n"),
    field: text("field"),
    relationshipId: integer("relationship_id").references(() => relationships.id, {
      onDelete: "cascade",
    }),
    quote: text("quote"),
  },
  (t) => [
    uniqueIndex("citations_ryan_footnote_uq").on(t.ryanId, t.footnoteN),
  ],
);

export const schema = {
  ryans,
  tags,
  ryanTags,
  organizations,
  ryanOrganizations,
  education,
  relationships,
  sources,
  citations,
};
