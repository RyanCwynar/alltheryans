import { createDb } from "../../db/client.js";
import { getPublishedRyanBySlug } from "../../db/queries.js";
import { handleGet, json } from "../_lib/http.js";
import { asVercelHandler, nodeConfig } from "../_lib/vercel.js";

export const config = nodeConfig;

export default asVercelHandler((request) =>
  handleGet(request, async (url) => {
    const slug = decodeURIComponent(url.pathname.split("/").pop() || "");
    if (!slug) return json({ error: "not_found" }, 404);
    const { db } = createDb();
    const ryan = await getPublishedRyanBySlug(db, slug);
    if (!ryan) return json({ error: "not_found" }, 404);
    return json({ ryan });
  }),
);
