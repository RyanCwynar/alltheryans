import { parseFrontmatter } from "./parse.js";

let indexPromise;

export function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch("/ryans/index.json", { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load index (${res.status})`);
        return res.json();
      })
      .then((data) => data.ryans || []);
  }
  return indexPromise;
}

export async function loadRyanMarkdown(slug) {
  const index = await loadIndex();
  const entry = index.find((r) => r.slug === slug);
  if (!entry) {
    throw new Error(`Ryan not found: ${slug}`);
  }
  const res = await fetch(`/${entry.file}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${entry.file}`);
  const text = await res.text();
  const { data, content } = parseFrontmatter(text);
  return {
    ...entry,
    ...data,
    slug: data.slug || entry.slug,
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

/**
 * Ryan of the day: featured_on for today (America/Sao_Paulo), else
 * deterministic pick from the sorted slug list.
 */
export function pickRyanOfDay(ryans, dateStr = todaySaoPaulo()) {
  const featured = ryans.find((r) => r.featured_on === dateStr);
  if (featured) return featured;
  const sorted = [...ryans].sort((a, b) => a.slug.localeCompare(b.slug));
  if (!sorted.length) return null;
  return sorted[hashDate(dateStr) % sorted.length];
}

export function sortByName(ryans) {
  return [...ryans].sort((a, b) => a.name.localeCompare(b.name));
}

/** Two-digit roll-call number: position in the alphabetical directory. */
export function rollNumber(sorted, slug) {
  const i = sorted.findIndex((r) => r.slug === slug);
  return i === -1 ? "" : String(i + 1).padStart(2, "0");
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
