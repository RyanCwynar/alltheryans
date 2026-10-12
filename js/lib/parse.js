import { marked } from "marked";
import DOMPurify from "dompurify";

/**
 * Minimal YAML-ish frontmatter parser for our Ryan markdown files.
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
  const data = {};

  for (const line of raw.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#") || !line.includes(":")) continue;
    const idx = line.indexOf(":");
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1).trim();
      if (!inner) {
        data[key] = [];
        continue;
      }
      const items = [];
      let current = "";
      let inQuote = false;
      let quoteChar = "";
      for (const ch of inner) {
        if ((ch === '"' || ch === "'") && !inQuote) {
          inQuote = true;
          quoteChar = ch;
          current += ch;
        } else if (inQuote && ch === quoteChar) {
          inQuote = false;
          current += ch;
        } else if (ch === "," && !inQuote) {
          items.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
      if (current.trim()) items.push(current.trim());
      data[key] = items.map((item) => {
        item = item.trim();
        if (
          item.length >= 2 &&
          item[0] === item[item.length - 1] &&
          (item[0] === '"' || item[0] === "'")
        ) {
          return item.slice(1, -1);
        }
        return item;
      });
      continue;
    }

    if (
      value.length >= 2 &&
      value[0] === value[value.length - 1] &&
      (value[0] === '"' || value[0] === "'")
    ) {
      const inner = value.slice(1, -1);
      data[key] = value[0] === '"' ? inner.replace(/\\(["\\])/g, "$1") : inner;
      continue;
    }

    if (value === "null" || value === "Null" || value === "~" || value === "") {
      data[key] = null;
    } else if (value === "true" || value === "True") {
      data[key] = true;
    } else if (value === "false" || value === "False") {
      data[key] = false;
    } else if (/^-?\d+(\.\d+)?$/.test(value)) {
      data[key] = Number(value);
    } else {
      data[key] = value;
    }
  }

  return { data, content };
}

export function renderMarkdown(md) {
  const html = marked.parse(md || "", { async: false });
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
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
    .map((item) => {
      if (!item) return null;
      if (typeof item === "string") {
        try {
          const url = new URL(item);
          return { title: sourceLabel(url), url: item };
        } catch {
          return { title: item, url: item };
        }
      }
      if (typeof item === "object" && item.url) {
        return { title: item.title || item.url, url: item.url };
      }
      return null;
    })
    .filter(Boolean);
}

export function photoCreditLine(ryan) {
  const credit = (ryan.photo_credit || "").trim();
  const license = (ryan.photo_license || "").trim();
  if (!credit && !license) return "";
  if (credit && license) return `Photo: ${credit} / ${license}`;
  if (credit) return `Photo: ${credit}`;
  return `Photo license: ${license}`;
}

function sourceLabel(url) {
  const host = url.hostname.replace(/^www\./, "");
  const handle = url.pathname.split("/").filter(Boolean)[0];
  if (host.endsWith("wikipedia.org")) return "Wikipedia";
  if ((host === "x.com" || host === "twitter.com") && handle) return `@${handle} on X`;
  return host;
}
