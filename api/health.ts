import { handleGet, json } from "./_lib/http.js";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  return handleGet(request, async () =>
    json({ ok: true, service: "alltheryans-api", writer: "cli-only" }),
  );
}
