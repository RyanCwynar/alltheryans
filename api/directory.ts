import { createDb } from "../db/client-web.js";
import { getDirectory } from "../db/queries.js";
import { handleGet, json, parseSort } from "./_lib/http.js";

/** Combined list + tags so the archive can do one fetch. */
export const config = { runtime: "nodejs" };

export default async function handler(request: Request): Promise<Response> {
  return handleGet(request, "GET /api/directory", async (url) => {
    const { db } = createDb();
    const data = await getDirectory(db, {
      tag: url.searchParams.get("tag") || undefined,
      sort: parseSort(url.searchParams.get("sort")),
      q: url.searchParams.get("q") || undefined,
    });
    return json(data);
  });
}
