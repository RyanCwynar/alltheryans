import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import YAML from "yaml";
import {
  DIRECTED_RELATIONSHIP_TYPES,
  type RelationshipType,
} from "../db/schema.js";

export type ParsedSource = {
  n: number | null;
  title: string;
  publisher: string;
  author: string;
  date: string | null;
  url: string;
  access: string | null;
  archiveUrl: string | null;
};

export type ParsedRelationship = {
  target: string;
  type: RelationshipType;
  note: string;
  cite: number[];
  directed: boolean;
  verified: boolean;
};

export type ParsedRyan = {
  file: string;
  slug: string;
  name: string;
  number: number | null;
  status: "draft" | "approved" | "published";
  short: string;
  title: string;
  photo: string;
  photoCredit: string;
  photoLicense: string;
  birthDate: string | null;
  birthYearMin: number | null;
  birthYearMax: number | null;
  birthPlace: string | null;
  deathDate: string | null;
  website: string;
  leadSummary: string;
  bodyMd: string;
  occupations: string[];
  clusters: string[];
  knownFor: string[];
  social: Array<{ platform: string; handle: string; url: string }>;
  organizations: Array<{
    name: string;
    role: string;
    start: number | null;
    end: number | null;
    note: string;
    url: string;
  }>;
  education: Array<{
    institution: string;
    degree: string | null;
    field: string | null;
    year: number | null;
  }>;
  featuredOn: string | null;
  relationships: ParsedRelationship[];
  sources: ParsedSource[];
};

function asArray(value: unknown): unknown[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function asString(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function yearFromUnknown(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseBirth(meta: Record<string, unknown>): {
  birthDate: string | null;
  birthYearMin: number | null;
  birthYearMax: number | null;
  birthPlace: string | null;
} {
  const birth = meta.birth;
  if (birth && typeof birth === "object") {
    const b = birth as Record<string, unknown>;
    const date = asString(b.date) || null;
    const place = b.place == null ? null : asString(b.place);
    let birthYearMin: number | null = null;
    let birthYearMax: number | null = null;
    if (date) {
      const years = date.match(/\d{4}/g)?.map(Number) ?? [];
      if (years.length >= 2) {
        birthYearMin = years[0]!;
        birthYearMax = years[1]!;
      } else if (years.length === 1) {
        birthYearMin = birthYearMax = years[0]!;
      }
    }
    return {
      birthDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      birthYearMin,
      birthYearMax,
      birthPlace: place,
    };
  }
  const y = yearFromUnknown(meta.birth_year);
  return {
    birthDate: null,
    birthYearMin: y,
    birthYearMax: y,
    birthPlace: null,
  };
}

function parseSources(raw: unknown): ParsedSource[] {
  return asArray(raw).flatMap((item, idx) => {
    if (typeof item === "string" && item.trim()) {
      return [
        {
          n: idx + 1,
          title: "",
          publisher: "",
          author: "",
          date: null,
          url: item.trim(),
          access: "read",
          archiveUrl: null,
        },
      ];
    }
    if (item && typeof item === "object") {
      const s = item as Record<string, unknown>;
      const url = asString(s.url);
      if (!url) return [];
      return [
        {
          n: s.n == null ? idx + 1 : Number(s.n),
          title: asString(s.title),
          publisher: asString(s.publisher),
          author: asString(s.author),
          date: s.date == null ? null : asString(s.date),
          url,
          access: s.access == null ? null : asString(s.access),
          archiveUrl: s.archive_url == null ? null : asString(s.archive_url),
        },
      ];
    }
    return [];
  });
}

function parseRelationships(raw: unknown): ParsedRelationship[] {
  return asArray(raw).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    const target = asString(r.target);
    const type = asString(r.type) as RelationshipType;
    if (!target || !type) return [];
    const cite = asArray(r.cite).map((n) => Number(n)).filter((n) => Number.isFinite(n));
    const directed =
      typeof r.directed === "boolean"
        ? r.directed
        : DIRECTED_RELATIONSHIP_TYPES.has(type);
    const verified =
      typeof r.verified === "boolean" ? r.verified : cite.length > 0;
    return [
      {
        target,
        type,
        note: asString(r.note),
        cite,
        directed,
        verified,
      },
    ];
  });
}

export async function parseRyanMarkdown(path: string): Promise<ParsedRyan> {
  const text = await readFile(path, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta = (match ? YAML.parse(match[1]!) : {}) as Record<string, unknown>;
  const bodyMd = (match ? match[2]! : text).trim();

  const fileBase = basename(path, ".md").replace(/^\d+-/, "");
  const slug = asString(meta.slug) || fileBase;
  const birth = parseBirth(meta);

  let status = asString(meta.status || "").toLowerCase();
  if (!status) {
    // Convex seed files without status default to published; encyclopedia drafts set status.
    status = "published";
  }
  if (status !== "draft" && status !== "approved" && status !== "published") {
    status = "draft";
  }

  const social: ParsedRyan["social"] = [];
  for (const item of asArray(meta.social)) {
    if (item && typeof item === "object") {
      const s = item as Record<string, unknown>;
      social.push({
        platform: asString(s.platform),
        handle: asString(s.handle),
        url: asString(s.url),
      });
    }
  }
  if (!social.length && meta.twitter) {
    const handle = asString(meta.twitter).replace(/^@/, "");
    social.push({
      platform: "x",
      handle,
      url: `https://x.com/${handle}`,
    });
  }

  const organizations = asArray(meta.organizations).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    if (!o.name) return [];
    return [
      {
        name: asString(o.name),
        role: asString(o.role),
        start: yearFromUnknown(o.start),
        end: yearFromUnknown(o.end),
        note: asString(o.note),
        url: asString(o.url),
      },
    ];
  });

  const education = asArray(meta.education).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const e = item as Record<string, unknown>;
    if (!e.institution) return [];
    return [
      {
        institution: asString(e.institution),
        degree: e.degree == null ? null : asString(e.degree),
        field: e.field == null ? null : asString(e.field),
        year: yearFromUnknown(e.year),
      },
    ];
  });

  const knownFor = asArray(meta.known_for).map(asString).filter(Boolean);
  const occupations = asArray(meta.occupations).map(asString).filter(Boolean);
  const clusters = asArray(meta.clusters).map(asString).filter(Boolean);

  // Heuristic clusters for Convex seed files
  if (!clusters.length) {
    const blob = `${asString(meta.title)} ${knownFor.join(" ")}`.toLowerCase();
    if (/actor|film|notebook|deadpool|barbie/.test(blob)) clusters.push("actor", "film");
    else if (/boxer|football|baseball|athlete|nfl|mlb/.test(blob)) clusters.push("athlete");
    else if (/singer|musician|oneRepublic|reggaeton/.test(blob)) clusters.push("musician");
    else if (/youtube|youtuber/.test(blob)) clusters.push("creator", "youtube");
    else clusters.push("tech");
    if (/founder|ceo|co-founder|entrepreneur/.test(blob)) clusters.push("founder");
  }

  const lead =
    bodyMd
      .split(/\n\n+/)
      .map((p) => p.replace(/^#+\s.*/, "").trim())
      .find((p) => p && !p.startsWith("#")) || "";

  return {
    file: path,
    slug,
    name: asString(meta.name) || slug,
    number: yearFromUnknown(meta.number),
    status: status as ParsedRyan["status"],
    short: asString(meta.short).slice(0, 25),
    title: asString(meta.title) || asString(meta.short),
    photo: asString(meta.photo),
    photoCredit: asString(meta.photo_credit),
    photoLicense: asString(meta.photo_license),
    ...birth,
    deathDate: meta.death == null || meta.death === "" ? null : asString(meta.death),
    website: asString(meta.website),
    leadSummary: lead.slice(0, 600),
    bodyMd,
    occupations,
    clusters: [...new Set(clusters)],
    knownFor,
    social,
    organizations,
    education,
    featuredOn:
      meta.featured_on == null || meta.featured_on === ""
        ? null
        : asString(meta.featured_on),
    relationships: parseRelationships(meta.relationships),
    sources: parseSources(meta.sources),
  };
}
