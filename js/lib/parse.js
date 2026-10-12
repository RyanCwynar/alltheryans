import { marked } from "marked";
import DOMPurify from "dompurify";
import jsyaml from "js-yaml";

/**
 * Parse YAML frontmatter + body from a Ryan markdown file.
 */
export function parseFrontmatter(text) {
  if (!text.startsWith("---")) {
    return { data: {}, content: text };
  }
  const end = text.indexOf("\n---", 3);
  if (end === -1) {
    return { data: {}, content: text };
  }
  const raw = text.slice(4, end);
  const content = text.slice(end + 4).replace(/^\n/, "");
  let data = {};
  try {
    data = jsyaml.load(raw) || {};
  } catch (err) {
    console.warn("Frontmatter YAML parse failed", err);
    data = {};
  }
  if (typeof data !== "object" || Array.isArray(data)) data = {};
  return { data, content };
}

/** Turn [1] / [1][4] citation markers into footnote anchors. */
export function linkCitations(md) {
  return String(md || "").replace(/\[(\d+)\]/g, (_m, n) => `[↗${n}](#cite-${n})`);
}

export function renderMarkdown(md, { citations = true } = {}) {
  const prepared = citations ? linkCitations(md) : md || "";
  const html = marked.parse(prepared, { async: false });
  let clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["id"],
  });
  // Local see-also links ./slug or ./ryan-x -> /ryan/slug
  clean = clean.replace(
    /href="\.\/([a-z0-9-]+)"/gi,
    (_m, slug) => `href="/ryan/${slug}"`,
  );
  // Upgrade citation placeholder links to superscripts
  clean = clean.replace(
    /<a href="#cite-(\d+)">↗\1<\/a>/g,
    '<sup class="cite"><a href="#cite-$1">[$1]</a></sup>',
  );
  return clean;
}

export function cardShort(ryan) {
  const short = (ryan.short || "").trim();
  if (short) return short.slice(0, 25);
  const title = (ryan.title || "").trim();
  if (!title) return "";
  return title.length > 25 ? `${title.slice(0, 24)}…` : title;
}

export function initials(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "R";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function normalizeSources(sources) {
  if (!Array.isArray(sources)) return [];
  return sources
    .map((item, idx) => {
      if (!item) return null;
      if (typeof item === "string") {
        try {
          const url = new URL(item);
          return {
            n: idx + 1,
            title: url.hostname.replace(/^www\./, ""),
            publisher: "",
            date: "",
            url: item,
            access: "",
          };
        } catch {
          return { n: idx + 1, title: item, publisher: "", date: "", url: item, access: "" };
        }
      }
      if (typeof item === "object" && item.url) {
        return {
          n: item.n ?? idx + 1,
          title: item.title || item.publisher || item.url,
          publisher: item.publisher || "",
          date: item.date || "",
          url: item.url,
          access: item.access || "",
        };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.n) - Number(b.n));
}

export function photoCreditLine(ryan) {
  const credit = (ryan.photo_credit || "").trim();
  const license = (ryan.photo_license || "").trim();
  if (!credit && !license) return "";
  if (credit && license) return `Photo: ${credit} / ${license}`;
  if (credit) return `Photo: ${credit}`;
  return `Photo license: ${license}`;
}

export function formatBirth(birth) {
  if (!birth || typeof birth !== "object") return "";
  const date = birth.date || "";
  const place = birth.place || "";
  if (date && place) return `${date}, ${place}`;
  return date || place || "";
}

export function relationshipLabel(type) {
  return String(type || "").replace(/-/g, " ");
}
