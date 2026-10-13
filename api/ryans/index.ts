import { createDb } from "../../db/client-web.js";
import { listPublishedRyans } from "../../db/queries.js";
import { handleGet, json, parseSort } from "../_lib/http.js";

// Edge + regions pins near the Boston VPS DB (vercel.json regions kept for Node fallbacks).
export const config = { runtime: "edge", regions: ["iad1"] };

export default async function handler(request: Request): Promise<Response> {
  return handleGet(request, "GET /api/ryans", async (url) => {
    const { db } = createDb();
    const ryans = await listPublishedRyans(db, {
      tag: url.searchParams.get("tag") || undefined,
      sort: parseSort(url.searchParams.get("sort")),
      q: url.searchParams.get("q") || undefined,
    });
    return json({ count: ryans.length, ryans });
  });
}
