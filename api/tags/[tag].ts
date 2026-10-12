import { createDb } from "../../db/client.js";
import { getTagPage } from "../../db/queries.js";
import { handleGet, json, parseSort } from "../_lib/http.js";
import { asVercelHandler, nodeConfig } from "../_lib/vercel.js";

export const config = nodeConfig;

export default asVercelHandler((request) =>
  handleGet(request, async (url) => {
    const tag = decodeURIComponent(url.pathname.split("/").pop() || "");
    if (!tag) return json({ error: "not_found" }, 404);
    const { db } = createDb();
    const page = await getTagPage(db, tag, parseSort(url.searchParams.get("sort"), "number"));
    if (!page) return json({ error: "not_found" }, 404);
    return json(page);
  }),
);
