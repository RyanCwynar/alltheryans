/**
 * Static JSON built from ryans/*.md by `bun run build:data` (data/api/).
 * Served from the CDN; filtering and sorting happen here in the browser.
 */
import { slugLookupCandidates } from "./slug-alias.js";

const DATA_ROOT = "/data/api";

let directoryPromise;
let graphPromise;

async function getJson(path) {
  const res = await fetch(`${DATA_ROOT}/${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return res.json();
}

function loadAll() {
  if (!directoryPromise) {
    directoryPromise = getJson("directory.json").then((data) => ({
      ryans: data.ryans || [],
      tags: data.tags || [],
    }));
    // Let a later call retry after a failed fetch.
    directoryPromise.catch(() => {
      directoryPromise = undefined;
    });
  }
  return directoryPromise;
}

function matchesQuery(ryan, q) {
  const needle = q.toLowerCase();
  const hay = `${ryan.name} ${ryan.short} ${ryan.title} ${ryan.lead_summary}`.toLowerCase();
  return hay.includes(needle);
}

function applyParams(ryans, params) {
  let list = filterByCluster(ryans, params.tag);
  if (params.q) list = list.filter((r) => matchesQuery(r, params.q));
  return sortRyans(list, params.sort || "name");
}

export async function loadPublishedRyans(params = {}) {
  const { ryans } = await loadAll();
  return applyParams(ryans, params);
}

/** Published list + tags (archive / home). */
export async function loadDirectory(params = {}) {
  const { ryans, tags } = await loadAll();
  return { ryans: applyParams(ryans, params), tags };
}

/** @deprecated use loadPublishedRyans */
export function loadIndex() {
  return loadPublishedRyans();
}

export async function loadTags() {
  return (await loadAll()).tags;
}

export function loadTagPage(slug) {
  return getJson(`tags/${encodeURIComponent(slug)}.json`);
}

export function loadGraph() {
  if (!graphPromise) {
    graphPromise = getJson("ryan-web.json");
  }
  return graphPromise;
}

export async function loadRyan(slug) {
  let lastErr;
  for (const candidate of slugLookupCandidates(slug)) {
    try {
      const data = await getJson(`ryans/${encodeURIComponent(candidate)}.json`);
      return data.ryan;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error(`Ryan not found: ${slug}`);
}

/** Back-compat name used by bio-page */
export async function loadRyanMarkdown(slug) {
  const ryan = await loadRyan(slug);
  return {
    ...ryan,
    bioMarkdown: ryan.body_md || "",
    sources: ryan.sources || [],
    relationships: ryan.relationships || [],
    organizations: ryan.organizations || [],
    education: ryan.education || [],
    birth: ryan.birth || null,
  };
}

export function todaySaoPaulo(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function hashDate(dateStr) {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pickRyanOfDay(ryans, dateStr = todaySaoPaulo()) {
  const featured = ryans.find((r) => r.featured_on === dateStr);
  if (featured) return featured;
  const sorted = [...ryans].sort((a, b) => a.slug.localeCompare(b.slug));
  if (!sorted.length) return null;
  return sorted[hashDate(dateStr) % sorted.length];
}

/**
 * Alphabetize by whichever of the first/last names isn't "Ryan".
 * If both or neither is Ryan, use the last name.
 * e.g. Ryan Fleury → F, Nolan Ryan → N, Ryan Ryan → Ryan.
 */
export function nameSortKey(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const last = parts[parts.length - 1];
  const isRyan = (part) => part.toLowerCase() === "ryan";
  if (isRyan(first) === isRyan(last)) return last;
  return isRyan(first) ? last : first;
}

function compareByRyanName(a, b) {
  const byKey = nameSortKey(a.name).localeCompare(nameSortKey(b.name), undefined, {
    sensitivity: "base",
  });
  if (byKey !== 0) return byKey;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function sortRyans(ryans, sortKey) {
  const list = [...ryans];
  switch (sortKey) {
    case "number":
      return list.sort((a, b) => {
        const an = a.number ?? 9999;
        const bn = b.number ?? 9999;
        if (an !== bn) return an - bn;
        return compareByRyanName(a, b);
      });
    case "birth":
      return list.sort((a, b) => {
        const ay = a.birth_year_min ?? 9999;
        const by = b.birth_year_min ?? 9999;
        if (ay !== by) return ay - by;
        return compareByRyanName(a, b);
      });
    case "connections":
      return list.sort((a, b) => {
        const ac = a.connection_count ?? 0;
        const bc = b.connection_count ?? 0;
        if (ac !== bc) return bc - ac;
        return compareByRyanName(a, b);
      });
    case "name":
    default:
      return list.sort(compareByRyanName);
  }
}

export function filterByCluster(ryans, cluster) {
  if (!cluster) return ryans;
  return ryans.filter((r) => (r.clusters || []).includes(cluster));
}

export function sortByName(ryans) {
  return sortRyans(ryans, "name");
}

/** e.g. "Monday, October 12" in America/Sao_Paulo */
export function todayLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** "Ryan #7" style series label, or "" when unnumbered. */
export function seriesLabel(ryan) {
  return ryan?.number != null ? `No. ${String(ryan.number).padStart(2, "0")}` : "";
}

/** X handle from the social list, if any. */
export function xHandle(ryan) {
  const x = (ryan?.social || []).find((s) => s.platform === "x" || s.platform === "twitter");
  return x ? { handle: x.handle, url: x.url || `https://x.com/${x.handle}` } : null;
}

/** "1981", "1980–1981", or "" */
export function birthLabel(ryan) {
  const min = ryan?.birth?.year_min ?? ryan?.birth_year_min;
  const max = ryan?.birth?.year_max ?? ryan?.birth_year_max;
  if (min == null) return "";
  return max != null && max !== min ? `${min}–${max}` : String(min);
}
