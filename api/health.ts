import { handleGet, json } from "./_lib/http.js";
import { asVercelHandler, nodeConfig } from "./_lib/vercel.js";

export const config = nodeConfig;

export default asVercelHandler((request) =>
  handleGet(request, async () =>
    json({ ok: true, service: "alltheryans-api", writer: "cli-only" }),
  ),
);
