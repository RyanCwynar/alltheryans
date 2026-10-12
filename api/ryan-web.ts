import { createDb } from "../db/client-web.js";
import { getRyanWeb } from "../db/queries.js";
import { handleGet, json } from "./_lib/http.js";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  return handleGet(request, async () => {
    const { db } = createDb();
    const graph = await getRyanWeb(db);
    return json(graph);
  });
}
