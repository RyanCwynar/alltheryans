import { createDb } from "../../db/client.js";
import { listPublishedRyans } from "../../db/queries.js";
import { handleGet, json, parseSort } from "../_lib/http.js";
import { asVercelHandler, nodeConfig } from "../_lib/vercel.js";

export const config = nodeConfig;

export default asVercelHandler((request) =>
  handleGet(request, async (url) => {
    const { db } = createDb();
    const ryans = await listPublishedRyans(db, {
      tag: url.searchParams.get("tag") || undefined,
      sort: parseSort(url.searchParams.get("sort")),
      q: url.searchParams.get("q") || undefined,
    });
    return json({ count: ryans.length, ryans });
  }),
);
