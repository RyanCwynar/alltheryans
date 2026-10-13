import { createDb } from "../../db/client-web.js";
import { getPublishedRyanBySlug } from "../../db/queries.js";
import { handleGet, json } from "../_lib/http.js";

export const config = { runtime: "edge", regions: ["iad1"] };

export default async function handler(request: Request): Promise<Response> {
  return handleGet(request, "GET /api/ryans/:slug", async (url) => {
    const slug = decodeURIComponent(url.pathname.split("/").pop() || "");
    if (!slug) return json({ error: "not_found" }, 404);
    const { db } = createDb();
    const ryan = await getPublishedRyanBySlug(db, slug);
    if (!ryan) return json({ error: "not_found" }, 404);
    return json({ ryan });
  });
}
