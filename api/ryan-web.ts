import { createDb } from "../db/client-web.js";
import { getRyanWeb } from "../db/queries.js";
import { handleGet, json } from "./_lib/http.js";
import { enrichRyanPhotos } from "./_lib/static-photo.js";

export const config = { runtime: "edge", regions: ["iad1"] };

export default async function handler(request: Request): Promise<Response> {
  return handleGet(request, "GET /api/ryan-web", async (url) => {
    const { db } = createDb();
    const graph = await getRyanWeb(db);
    return json({
      ...graph,
      nodes: await enrichRyanPhotos(graph.nodes, url.origin),
    });
  });
}
