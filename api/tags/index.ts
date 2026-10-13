import { createDb } from "../../db/client-web.js";
import { listTags } from "../../db/queries.js";
import { handleGet, json } from "../_lib/http.js";

export const config = { runtime: "nodejs" };

export default async function handler(request: Request): Promise<Response> {
  return handleGet(request, "GET /api/tags", async () => {
    const { db } = createDb();
    const tags = await listTags(db);
    return json({ tags });
  });
}
