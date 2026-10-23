/**
 * HTML shell for /ryan/:slug with per-Ryan OG/Twitter meta.
 * Vercel rewrite: /ryan/:slug → /api/ryan-page/:slug
 * Body is still the Lit SPA (same as index.html).
 */
import {
  applyRyanShareMeta,
  buildRyanShareMeta,
  HTML_CACHE,
  siteOriginFromRequest,
} from "../_lib/ryan-shell.js";
import { loadRyanShare } from "../_lib/load-ryan-share.js";
import { API_CACHE_TAG } from "../_lib/http.js";

export const config = { runtime: "edge", regions: ["iad1"] };

function shellHeaders(ok: boolean): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": ok ? HTML_CACHE : "no-store",
    ...(ok ? { "Vercel-Cache-Tag": API_CACHE_TAG } : {}),
  };
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(request.url);
  // Works for /api/ryan-page/:slug and rewritten /ryan/:slug
  const parts = url.pathname.replace(/\/+$/, "").split("/");
  const slug = decodeURIComponent(parts[parts.length - 1] || "");
  if (!slug || slug === "ryan-page") {
    return new Response("Not found", { status: 404 });
  }

  const origin = siteOriginFromRequest(request);
  const indexRes = await fetch(new URL("/index.html", request.url));
  if (!indexRes.ok) {
    return new Response("Missing index.html", { status: 500, headers: shellHeaders(false) });
  }
  let html = await indexRes.text();

  const ryan = await loadRyanShare(slug, request);
  if (ryan) {
    html = applyRyanShareMeta(html, buildRyanShareMeta(ryan, origin));
  } else {
    // Still serve SPA so client can show its not-published state; fix canonical.
    html = applyRyanShareMeta(
      html,
      buildRyanShareMeta(
        {
          slug,
          name: "Ryan",
          title: "",
          short: "",
          lead_summary: "That Ryan isn’t published on All The Ryans.",
          photo: "",
        },
        origin,
      ),
    );
  }

  if (request.method === "HEAD") {
    return new Response(null, { status: 200, headers: shellHeaders(Boolean(ryan)) });
  }
  return new Response(html, { status: 200, headers: shellHeaders(Boolean(ryan)) });
}
