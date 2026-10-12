import type { SortKey } from "../../db/queries.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

/** JSON response. Success responses may be cached; errors never are. */
export function json(data: unknown, status = 200): Response {
  const ok = status >= 200 && status < 300;
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS,
      "Cache-Control": ok
        ? "public, s-maxage=60, stale-while-revalidate=300"
        : "no-store",
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

/** Run a GET handler; reject writes; never cache thrown errors. */
export async function handleGet(
  request: Request,
  run: (url: URL) => Promise<Response>,
): Promise<Response> {
  if (request.method === "OPTIONS") return options();
  if (request.method !== "GET") return readOnly();
  try {
    return await run(new URL(request.url));
  } catch (err) {
    console.error(err);
    return json({ error: "internal" }, 500);
  }
}
