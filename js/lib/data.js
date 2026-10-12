import { parseFrontmatter } from "./parse.js";

let indexPromise;

export function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch("/ryans/index.json", { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load index (${res.status})`);
        return res.json();
      });
  }
  return indexPromise;
}

export async function loadPublishedRyans() {
  const data = await loadIndex();
  return (data.ryans || []).filter((r) => (r.status || "published") === "published");
}

export async function loadTags() {
  const data = await loadIndex();
  return data.tags || [];
}

export async function loadGraph() {
  const data = await loadIndex();
  return data.graph || { nodes: [], links: [] };
}

export async function loadRyanMarkdown(slug) {
  const data = await loadIndex();
  const entry = (data.ryans || []).find((r) => r.slug === slug);
  if (!entry) {
    throw new Error(`Ryan not found or not published: ${slug}`);
  }
  const res = await fetch(`/${entry.file}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${entry.file}`);
  const text = await res.text();
  const { data: fm, content } = parseFrontmatter(text);
  return {
    ...entry,
    ...fm,
    slug: fm.slug || entry.slug,
    status: fm.status || entry.status,
    bioMarkdown: content,
  };
}

/** YYYY-MM-DD in America/Sao_Paulo */
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

export function sortRyans(ryans, sortKey) {
  const list = [...ryans];
  switch (sortKey) {
    case "number":
      return list.sort((a, b) => {
        const an = a.number ?? 9999;
        const bn = b.number ?? 9999;
        if (an !== bn) return an - bn;
        return a.name.localeCompare(b.name);
      });
    case "birth":
      return list.sort((a, b) => {
        const ay = a.birth_year_min ?? 9999;
        const by = b.birth_year_min ?? 9999;
        if (ay !== by) return ay - by;
        return a.name.localeCompare(b.name);
      });
    case "connections":
      return list.sort((a, b) => {
        const ac = a.connection_count ?? 0;
        const bc = b.connection_count ?? 0;
        if (ac !== bc) return bc - ac;
        return a.name.localeCompare(b.name);
      });
    case "name":
    default:
      return list.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export function filterByCluster(ryans, cluster) {
  if (!cluster) return ryans;
  return ryans.filter((r) => (r.clusters || []).includes(cluster));
}
