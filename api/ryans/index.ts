import { createDb } from "../../db/client-web.js";
import { listPublishedRyans } from "../../db/queries.js";
import { handleGet, json, parseSort } from "../_lib/http.js";

// Node serverless so vercel.json `regions: ["iad1"]` pins near the Boston VPS DB.
export const config = { runtime: "nodejs" };

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
