import { createDb } from "../db/client.js";
import { getRyanWeb } from "../db/queries.js";
import { handleGet, json } from "./_lib/http.js";
import { asVercelHandler, nodeConfig } from "./_lib/vercel.js";

export const config = nodeConfig;

export default asVercelHandler((request) =>
  handleGet(request, async () => {
    const { db } = createDb();
    const graph = await getRyanWeb(db);
    return json(graph);
  }),
);
