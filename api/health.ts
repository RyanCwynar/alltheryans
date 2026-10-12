import { handleGet, json } from "./_lib/http.js";

export const config = { runtime: "edge" };

export default async function handler(request: Request): Promise<Response> {
  return handleGet(request, async () =>
    json({
      ok: true,
      service: "alltheryans-api",
      writer: "cli-only",
      hasLibsqlUrl: Boolean(process.env.LIBSQL_URL?.trim()),
      hasLibsqlToken: Boolean(process.env.LIBSQL_AUTH_TOKEN?.trim()),
    }),
  );
}
