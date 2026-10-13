import { handleGet, json } from "./_lib/http.js";

export const config = { runtime: "edge", regions: ["iad1"] };

export default async function handler(request: Request): Promise<Response> {
  return handleGet(request, "GET /api/health", async () =>
    json({ ok: true, service: "alltheryans-api", writer: "cli-only" }),
  );
}
