import { createDb } from "../../db/client-web.js";
import { listPublishedRyans } from "../../db/queries.js";
import { handleGet, json, parseSort } from "../_lib/http.js";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  return handleGet(request, async (url) => {
    const { db } = createDb();
    const ryans = await listPublishedRyans(db, {
      tag: url.searchParams.get("tag") || undefined,
      sort: parseSort(url.searchParams.get("sort")),
      q: url.searchParams.get("q") || undefined,
    });
    return json({ count: ryans.length, ryans });
  });
}
