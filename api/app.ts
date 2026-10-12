/**
 * Public read-only Hono API. All writes go through the CLI (single writer).
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb, type LibsqlEnv } from "../db/client.ts";
import {
  getPublishedRyanBySlug,
  getRyanWeb,
  getTagPage,
  listPublishedRyans,
  listTags,
  type SortKey,
} from "../db/queries.ts";

export type AppEnv = {
  Bindings: LibsqlEnv;
};

function dbFromEnv(env: LibsqlEnv) {
  return createDb({
    LIBSQL_URL: env.LIBSQL_URL ?? process.env.LIBSQL_URL,
    LIBSQL_AUTH_TOKEN: env.LIBSQL_AUTH_TOKEN ?? process.env.LIBSQL_AUTH_TOKEN,
  }).db;
}

function parseSort(value: string | undefined): SortKey {
  if (value === "number" || value === "birth" || value === "connections" || value === "name") {
    return value;
  }
  return "name";
}

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", cors({ origin: "*" }));

  app.get("/api/health", (c) =>
    c.json({ ok: true, service: "alltheryans-api", writer: "cli-only" }),
  );

  app.get("/api/ryans", async (c) => {
    const db = dbFromEnv(c.env ?? {});
    const tag = c.req.query("tag") || undefined;
    const sort = parseSort(c.req.query("sort") || undefined);
    const q = c.req.query("q") || undefined;
    const ryans = await listPublishedRyans(db, { tag, sort, q });
    return c.json(
      { count: ryans.length, ryans },
      200,
      cacheHeaders(),
    );
  });

  app.get("/api/ryans/:slug", async (c) => {
    const db = dbFromEnv(c.env ?? {});
    const ryan = await getPublishedRyanBySlug(db, c.req.param("slug"));
    if (!ryan) return c.json({ error: "not_found" }, 404);
    return c.json({ ryan }, 200, cacheHeaders());
  });

  app.get("/api/tags", async (c) => {
    const db = dbFromEnv(c.env ?? {});
    const tags = await listTags(db);
    return c.json({ tags }, 200, cacheHeaders());
  });

  app.get("/api/tags/:tag", async (c) => {
    const db = dbFromEnv(c.env ?? {});
    const sort = parseSort(c.req.query("sort") || "number");
    const page = await getTagPage(db, c.req.param("tag"), sort);
    if (!page) return c.json({ error: "not_found" }, 404);
    return c.json(page, 200, cacheHeaders());
  });

  app.get("/api/ryan-web", async (c) => {
    const db = dbFromEnv(c.env ?? {});
    const graph = await getRyanWeb(db);
    return c.json(graph, 200, cacheHeaders());
  });

  // Explicitly reject writes on the public API
  app.post("/api/*", (c) =>
    c.json({ error: "read_only", message: "Use the seed CLI (single writer)." }, 405),
  );
  app.put("/api/*", (c) =>
    c.json({ error: "read_only", message: "Use the seed CLI (single writer)." }, 405),
  );
  app.patch("/api/*", (c) =>
    c.json({ error: "read_only", message: "Use the seed CLI (single writer)." }, 405),
  );
  app.delete("/api/*", (c) =>
    c.json({ error: "read_only", message: "Use the seed CLI (single writer)." }, 405),
  );

  return app;
}

function cacheHeaders(): Record<string, string> {
  return {
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
  };
}

export default createApp();
