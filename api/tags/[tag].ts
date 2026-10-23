import { createDb } from "../../db/client-web.js";
import { getTagPage } from "../../db/queries.js";
import { handleGet, json, parseSort } from "../_lib/http.js";
import { enrichRyanPhotos } from "../_lib/static-photo.js";

export const config = { runtime: "edge", regions: ["iad1"] };

export default async function handler(request: Request): Promise<Response> {
  return handleGet(request, "GET /api/tags/:tag", async (url) => {
    const tag = decodeURIComponent(url.pathname.split("/").pop() || "");
    if (!tag) return json({ error: "not_found" }, 404);
    const { db } = createDb();
    const page = await getTagPage(db, tag, parseSort(url.searchParams.get("sort"), "number"));
    if (!page) return json({ error: "not_found" }, 404);
    return json({
      ...page,
      ryans: await enrichRyanPhotos(page.ryans, url.origin),
    });
  });
}
