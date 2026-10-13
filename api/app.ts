/**
 * Local Bun dev API (scripts/dev-server.ts). Production uses individual
 * Vercel functions under api/*.ts — keep route behavior in sync.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDb, type LibsqlEnv } from "../db/client.js";
import {
  getDirectory,
  getPublishedRyanBySlug,
  getRyanWeb,
  getTagPage,
  listPublishedRyans,
  listTags,
  type SortKey,
} from "../db/queries.js";
import { withRouteTiming } from "../db/timing.js";
import { API_CACHE_TAG, CDN_CACHE } from "./_lib/http.js";

export type AppEnv = {
  Bindings: LibsqlEnv;
};

function dbFromEnv(env: LibsqlEnv) {
  // Prefer explicit bindings, else process.env (never trust unrelated c.env shapes).
  return createDb({
    LIBSQL_URL: typeof env.LIBSQL_URL === "string" ? env.LIBSQL_URL : process.env.LIBSQL_URL,
    LIBSQL_AUTH_TOKEN:
      typeof env.LIBSQL_AUTH_TOKEN === "string" ? env.LIBSQL_AUTH_TOKEN : process.env.LIBSQL_AUTH_TOKEN,
  }).db;
}

function parseSort(value: string | undefined): SortKey {
  if (value === "number" || value === "birth" || value === "connections" || value === "name") {
    return value;
  }
  return "name";
}

function cacheHeaders(): Record<string, string> {
  return {
    "Cache-Control": CDN_CACHE,
    "Vercel-Cache-Tag": API_CACHE_TAG,
  };
}

function noStore(): Record<string, string> {
  return { "Cache-Control": "no-store" };
}

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", cors({ origin: "*" }));

  app.get("/api/health", (c) =>
    c.json({ ok: true, service: "alltheryans-api", writer: "cli-only" }),
  );

  app.get("/api/ryans", async (c) => {
    try {
      return await withRouteTiming("GET /api/ryans", async () => {
        const db = dbFromEnv(c.env ?? {});
        const tag = c.req.query("tag") || undefined;
        const sort = parseSort(c.req.query("sort") || undefined);
        const q = c.req.query("q") || undefined;
        const ryans = await listPublishedRyans(db, { tag, sort, q });
        return c.json({ count: ryans.length, ryans }, 200, cacheHeaders());
      });
    } catch (err) {
      console.error(err);
      return c.json({ error: "internal" }, 500, noStore());
    }
  });

  app.get("/api/ryans/:slug", async (c) => {
    try {
      return await withRouteTiming("GET /api/ryans/:slug", async () => {
        const db = dbFromEnv(c.env ?? {});
        const ryan = await getPublishedRyanBySlug(db, c.req.param("slug"));
        if (!ryan) return c.json({ error: "not_found" }, 404, noStore());
        return c.json({ ryan }, 200, cacheHeaders());
      });
    } catch (err) {
      console.error(err);
      return c.json({ error: "internal" }, 500, noStore());
    }
  });

  app.get("/api/tags", async (c) => {
    try {
      return await withRouteTiming("GET /api/tags", async () => {
        const db = dbFromEnv(c.env ?? {});
        const tags = await listTags(db);
        return c.json({ tags }, 200, cacheHeaders());
      });
    } catch (err) {
      console.error(err);
      return c.json({ error: "internal" }, 500, noStore());
    }
  });

  app.get("/api/tags/:tag", async (c) => {
    try {
      return await withRouteTiming("GET /api/tags/:tag", async () => {
        const db = dbFromEnv(c.env ?? {});
        const sort = parseSort(c.req.query("sort") || "number");
        const page = await getTagPage(db, c.req.param("tag"), sort);
        if (!page) return c.json({ error: "not_found" }, 404, noStore());
        return c.json(page, 200, cacheHeaders());
      });
    } catch (err) {
      console.error(err);
      return c.json({ error: "internal" }, 500, noStore());
    }
  });

  app.get("/api/directory", async (c) => {
    try {
      return await withRouteTiming("GET /api/directory", async () => {
        const db = dbFromEnv(c.env ?? {});
        const data = await getDirectory(db, {
          tag: c.req.query("tag") || undefined,
          sort: parseSort(c.req.query("sort") || undefined),
          q: c.req.query("q") || undefined,
        });
        return c.json(data, 200, cacheHeaders());
      });
    } catch (err) {
      console.error(err);
      return c.json({ error: "internal" }, 500, noStore());
    }
  });

  app.get("/api/ryan-web", async (c) => {
    try {
      return await withRouteTiming("GET /api/ryan-web", async () => {
        const db = dbFromEnv(c.env ?? {});
        const graph = await getRyanWeb(db);
        return c.json(graph, 200, cacheHeaders());
      });
    } catch (err) {
      console.error(err);
      return c.json({ error: "internal" }, 500, noStore());
    }
  });

  app.post("/api/*", (c) =>
    c.json({ error: "read_only", message: "Use the seed CLI (single writer)." }, 405, noStore()),
  );
  app.put("/api/*", (c) =>
    c.json({ error: "read_only", message: "Use the seed CLI (single writer)." }, 405, noStore()),
  );
  app.patch("/api/*", (c) =>
    c.json({ error: "read_only", message: "Use the seed CLI (single writer)." }, 405, noStore()),
  );
  app.delete("/api/*", (c) =>
    c.json({ error: "read_only", message: "Use the seed CLI (single writer)." }, 405, noStore()),
  );

  return app;
}

export default createApp();
