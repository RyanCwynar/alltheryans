import { createDb } from "../db/client-web.js";
import { getDirectory } from "../db/queries.js";
import { handleGet, json, parseSort } from "./_lib/http.js";
import { enrichRyanPhotos } from "./_lib/static-photo.js";

/** Combined list + tags so the archive can do one fetch. */
export const config = { runtime: "edge", regions: ["iad1"] };

export default async function handler(request: Request): Promise<Response> {
  return handleGet(request, "GET /api/directory", async (url) => {
    const { db } = createDb();
    const data = await getDirectory(db, {
      tag: url.searchParams.get("tag") || undefined,
      sort: parseSort(url.searchParams.get("sort")),
      q: url.searchParams.get("q") || undefined,
    });
    const ryans = await enrichRyanPhotos(data.ryans, url.origin);
    return json({ ...data, ryans, count: ryans.length });
  });
}
