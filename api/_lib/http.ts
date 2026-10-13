import type { SortKey } from "../../db/queries.js";
import { withRouteTiming } from "../../db/timing.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

/** CDN-friendly caching for successful read-only GET responses. */
export const CDN_CACHE =
  "public, s-maxage=3600, stale-while-revalidate=86400" as const;

/** Shared tag so seed can invalidate every API payload after writes. */
export const API_CACHE_TAG = "alltheryans-api" as const;

/** JSON response. Success responses may be cached; errors never are. */
export function json(data: unknown, status = 200): Response {
  const ok = status >= 200 && status < 300;
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS,
      "Cache-Control": ok ? CDN_CACHE : "no-store",
      ...(ok ? { "Vercel-Cache-Tag": API_CACHE_TAG } : {}),
    },
  });
}

export function options(): Response {
  return new Response(null, { status: 204, headers: { ...CORS } });
}

export function readOnly(): Response {
  return json({ error: "read_only", message: "Use the seed CLI (single writer)." }, 405);
}

export function parseSort(value: string | null | undefined, fallback: SortKey = "name"): SortKey {
  if (value === "number" || value === "birth" || value === "connections" || value === "name") {
    return value;
  }
  return fallback;
}

/** Run a GET handler; reject writes; never cache thrown errors; log DB timing. */
export async function handleGet(
  request: Request,
  route: string,
  run: (url: URL) => Promise<Response>,
): Promise<Response> {
  if (request.method === "OPTIONS") return options();
  if (request.method !== "GET") return readOnly();
  try {
    return await withRouteTiming(route, () => run(new URL(request.url)));
  } catch (err) {
    console.error(err);
    return json({ error: "internal" }, 500);
  }
}
