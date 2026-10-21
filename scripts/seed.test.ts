import { describe, expect, test } from "bun:test";
import {
  filterParsedRyans,
  formatSeedPlan,
  parseSeedArgs,
  planRelationshipOps,
  type RelEdge,
  type SeedPlan,
} from "./seed.js";
import type { ParsedRyan } from "./parse-ryan-md.js";

function stubRyan(slug: string): ParsedRyan {
  return {
    file: `${slug}.md`,
    slug,
    name: slug,
    number: null,
    status: "published",
    short: "",
    title: "",
    photo: "",
    photoCredit: "",
    photoLicense: "",
    birthDate: null,
    birthYearMin: null,
    birthYearMax: null,
    birthPlace: null,
    deathDate: null,
    website: "",
    leadSummary: "",
    bodyMd: "",
    occupations: [],
    clusters: [],
    knownFor: [],
    social: [],
    organizations: [],
    education: [],
    featuredOn: null,
    relationships: [],
    sources: [],
  };
}

function edge(
  sourceSlug: string,
  targetSlug: string,
  type = "thematic-link",
  extras: Partial<RelEdge> = {},
): RelEdge {
  return {
    sourceSlug,
    targetSlug,
    type,
    directed: false,
    note: "",
    verified: true,
    ...extras,
  };
}

describe("parseSeedArgs", () => {
  test("defaults to dry-run with no --only", () => {
    expect(parseSeedArgs(["bun", "scripts/seed.ts"])).toEqual({
      apply: false,
      onlySlugs: null,
    });
  });

  test("parses --apply and --only=a,b", () => {
    expect(
      parseSeedArgs(["bun", "scripts/seed.ts", "--apply", "--only=a,b"]),
    ).toEqual({ apply: true, onlySlugs: ["a", "b"] });
  });

  test("parses --only a,b as a separate argv token", () => {
    expect(
      parseSeedArgs(["bun", "scripts/seed.ts", "--only", "x,y", "--apply"]),
    ).toEqual({ apply: true, onlySlugs: ["x", "y"] });
  });

  test("rejects empty --only", () => {
    expect(() => parseSeedArgs(["bun", "scripts/seed.ts", "--only="])).toThrow(
      /at least one slug/,
    );
  });
});

describe("filterParsedRyans", () => {
  const list = [stubRyan("alpha"), stubRyan("beta"), stubRyan("gamma")];

  test("returns all when onlySlugs is null", () => {
    expect(filterParsedRyans(list, null).map((p) => p.slug)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });

  test("filters and preserves --only order", () => {
    expect(filterParsedRyans(list, ["gamma", "alpha"]).map((p) => p.slug)).toEqual([
      "gamma",
      "alpha",
    ]);
  });

  test("throws on unknown slug", () => {
    expect(() => filterParsedRyans(list, ["alpha", "nope"])).toThrow(/Unknown slug/);
  });
});

describe("planRelationshipOps", () => {
  test("inserts missing, updates changed, deletes stale — only for scoped sources", () => {
    const scoped = new Set(["serhant", "shazier"]);
    const desired = [
      edge("serhant", "ryan-holiday", "thematic-link", { note: "new note" }),
      edge("shazier", "serhant"),
    ];
    const existing = [
      edge("serhant", "ryan-holiday", "thematic-link", { note: "old note" }),
      edge("serhant", "gone-target"),
      // Outside scope — must not appear in delete/update
      edge("ryan-petersen", "graves"),
    ];

    const plan = planRelationshipOps(desired, existing, scoped);
    expect(plan.relInsert).toEqual([edge("shazier", "serhant")]);
    expect(plan.relUpdate).toEqual([
      edge("serhant", "ryan-holiday", "thematic-link", { note: "new note" }),
    ]);
    expect(plan.relDelete).toEqual([edge("serhant", "gone-target")]);
  });

  test("never deletes relationships for sources outside the repo scope", () => {
    const scoped = new Set(["gosling"]);
    const desired = [edge("gosling", "phillippe")];
    const existing = [
      edge("gosling", "phillippe"),
      edge("ryan-petersen", "graves"),
      edge("db-only-ryan", "someone"),
    ];
    const plan = planRelationshipOps(desired, existing, scoped);
    expect(plan.relInsert).toEqual([]);
    expect(plan.relUpdate).toEqual([]);
    expect(plan.relDelete).toEqual([]);
  });
});

describe("formatSeedPlan", () => {
  test("lists insert/update/delete lines", () => {
    const plan: SeedPlan = {
      ryansInsert: ["ryangrowthh"],
      ryansUpdate: ["ryan-cohen"],
      relInsert: [edge("a", "b")],
      relUpdate: [edge("c", "d")],
      relDelete: [edge("e", "f")],
      relSkipMissingTarget: [edge("g", "murphy")],
    };
    const lines = formatSeedPlan(plan, {
      apply: false,
      onlySlugs: ["ryangrowthh", "ryan-cohen"],
    });
    expect(lines).toContain("INSERT ryan ryangrowthh");
    expect(lines).toContain(
      "UPDATE ryan ryan-cohen (replace tags, organizations, education, citations)",
    );
    expect(lines).toContain("INSERT rel a -[thematic-link]-> b");
    expect(lines).toContain("UPDATE rel c -[thematic-link]-> d");
    expect(lines).toContain("DELETE rel e -[thematic-link]-> f");
    expect(lines).toContain(
      "SKIP rel g -[thematic-link]-> murphy (target missing)",
    );
  });
});
