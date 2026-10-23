/**
 * Per-Ryan HTML <head> for /ryan/:slug share cards (Twitter/X, OG).
 * Injects into the SPA index.html shell so browsers still boot Lit.
 */

export const SITE_ORIGIN_DEFAULT = "https://alltheryans.com";
export const DEFAULT_OG_IMAGE_PATH = "/images/og-default.png";

export type RyanShareInput = {
  slug: string;
  name: string;
  title?: string | null;
  short?: string | null;
  lead_summary?: string | null;
  photo?: string | null;
};

export type RyanShareMeta = {
  slug: string;
  name: string;
  pageTitle: string;
  description: string;
  canonicalUrl: string;
  imageUrl: string;
  imageAlt: string;
};

/** Prefer SITE_ORIGIN; else request host for local/preview; else production. */
export function siteOriginFromRequest(request: Request): string {
  const env = process.env.SITE_ORIGIN?.trim();
  if (env) return env.replace(/\/$/, "");

  const url = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || url.host;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "") ||
    "https";

  if (
    host.startsWith("127.") ||
    host.startsWith("localhost") ||
    host.endsWith(".vercel.app")
  ) {
    return `${proto}://${host}`;
  }
  return SITE_ORIGIN_DEFAULT;
}

/** Strip markdown / cite markers for meta description text. */
export function plainDescription(text: string): string {
  return text
    .replace(/\[\d+\]/g, "")
    .replace(/[*_`~#>]+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(text: string, max = 300): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`;
}

/** Absolute https image URL Twitterbot can fetch (JPG/PNG/WEBP only). */
export function absoluteShareImage(
  photo: string | null | undefined,
  origin: string,
): string {
  const base = origin.replace(/\/$/, "");
  const fallback = `${base}${DEFAULT_OG_IMAGE_PATH}`;
  if (!photo || !String(photo).trim()) return fallback;
  const p = String(photo).trim();

  if (/^https?:\/\//i.test(p)) {
    if (/\.svg(\?|#|$)/i.test(p)) return fallback;
    if (!/\.(jpe?g|png|webp)(\?|#|$)/i.test(p)) return fallback;
    return p;
  }
  if (!p.startsWith("/")) return fallback;
  if (/\.svg(\?|#|$)/i.test(p)) return fallback;
  if (!/\.(jpe?g|png|webp)(\?|#|$)/i.test(p)) return fallback;
  return `${base}${p}`;
}

export function buildRyanShareMeta(
  ryan: RyanShareInput,
  origin: string,
): RyanShareMeta {
  const base = origin.replace(/\/$/, "");
  const role = (ryan.title || ryan.short || "").trim();
  const lead = plainDescription(ryan.lead_summary || "");
  const descParts = [role, lead].filter(Boolean);
  const description = truncate(
    descParts.join(role && lead ? ". " : "") ||
      `Profile of ${ryan.name} on All The Ryans.`,
  );

  return {
    slug: ryan.slug,
    name: ryan.name,
    pageTitle: `${ryan.name} — All The Ryans`,
    description,
    canonicalUrl: `${base}/ryan/${encodeURIComponent(ryan.slug)}`,
    imageUrl: absoluteShareImage(ryan.photo, base),
    imageAlt: ryan.name,
  };
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setTitle(html: string, title: string): string {
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeAttr(title)}</title>`);
  }
  return html.replace(/<\/head>/i, `    <title>${escapeAttr(title)}</title>\n  </head>`);
}

function setCanonical(html: string, href: string): string {
  const tag = `<link rel="canonical" href="${escapeAttr(href)}" />`;
  if (/<link\s+rel=["']canonical["'][^>]*>/i.test(html)) {
    return html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, tag);
  }
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function setMetaByName(html: string, name: string, content: string): string {
  const tag = `<meta name="${name}" content="${escapeAttr(content)}" />`;
  // Matches single- or multi-line <meta ... name="…" … /> (attributes before />).
  const re = new RegExp(
    `<meta\\b[^>]*\\bname=["']${name}["'][^>]*/?>`,
    "i",
  );
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function setMetaByProperty(html: string, property: string, content: string): string {
  const tag = `<meta property="${property}" content="${escapeAttr(content)}" />`;
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<meta\\b[^>]*\\bproperty=["']${escaped}["'][^>]*/?>`,
    "i",
  );
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

/** Rewrite SPA index.html <head> with per-Ryan share metadata. */
export function applyRyanShareMeta(html: string, meta: RyanShareMeta): string {
  let out = html;
  out = setTitle(out, meta.pageTitle);
  out = setCanonical(out, meta.canonicalUrl);
  out = setMetaByName(out, "description", meta.description);
  out = setMetaByProperty(out, "og:type", "profile");
  out = setMetaByProperty(out, "og:title", meta.pageTitle);
  out = setMetaByProperty(out, "og:description", meta.description);
  out = setMetaByProperty(out, "og:url", meta.canonicalUrl);
  out = setMetaByProperty(out, "og:image", meta.imageUrl);
  out = setMetaByProperty(out, "og:image:alt", meta.imageAlt);
  // Compact square avatar card on X (not full-bleed large image).
  out = setMetaByName(out, "twitter:card", "summary");
  out = setMetaByName(out, "twitter:title", meta.pageTitle);
  out = setMetaByName(out, "twitter:description", meta.description);
  out = setMetaByName(out, "twitter:image", meta.imageUrl);
  out = setMetaByName(out, "twitter:image:alt", meta.imageAlt);
  return out;
}

export const HTML_CACHE =
  "public, s-maxage=3600, stale-while-revalidate=86400" as const;
